// src/app/api/tasks/[id]/route.ts
// PracticeIQ Section 14 Step 3D - Tasks single-item routes.
// GET   /api/tasks/[id]  - read one task; 404 if missing or cross-firm.
// PATCH /api/tasks/[id]  - update task fields and/or status (within the
//                          PATCH-allowed transitions). Status moves that
//                          require a reason text live in dedicated 3D-3
//                          endpoints (close / reopen / cancel).
//
// Auth-gated via requireAuth() - returns 401 in Step 3 until Step 4 wires
// real Supabase Auth into requireSession().
//
// PATCH permission flow (per the corrected 3D-2 plan; D-2026-05-04-02):
//   1. requireAuth(Action.TASK_VIEW) is the FIRST gate but ONLY establishes
//      authenticated route entry. It does NOT authorize mutation.
//   2. After body parse and task lookup, an operation classifier dispatches
//      to the appropriate mutation authorization:
//        - any non-status field edit (with or without status) -> TASK_EDIT
//        - status-only move to UNDER_REVIEW -> TASK_MOVE_TO_REVIEW (isOwnTask)
//        - status-only move to non-UNDER_REVIEW -> TASK_EDIT
//   3. ARTICLE_STAFF passes step 1 (has TASK_VIEW) but is rejected at step 2
//      for everything except status-only move to UNDER_REVIEW on own/assigned
//      tasks (isOwnTask = isCreator OR isAssignee per Decision K1).
//
// ARTICLE_STAFF visibility on task lookup follows Decision C1: out-of-scope
// tasks return 404, not 403, to avoid leaking that the id exists.
//
// Note semantics (per D-2026-05-04-02):
//   - note in PATCH body is allowed only with a status change.
//   - note required when status moves to PENDING_CLIENT, PENDING_INTERNAL,
//     or UNDER_REVIEW (Section 23.5).
//   - note-only PATCH or non-status edit with note -> 422 with redirect to
//     POST /api/tasks/[id]/notes.
//
// References: MASTER_PROJECT.md Section 14 Step 3D; Section 23 (operating
// model); Section 25 (security); CHANGE_LOG C-2026-05-04-01 (3D-1) and
// C-2026-05-04-03 (3D-2); DECISION_LOG D-2026-05-04-01 (A-F) and
// D-2026-05-04-02 (J/K/L + corrected PATCH design).

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  databaseUnavailable,
  err,
  ok,
  parseJson,
  requireAuth,
  writeActivityLog,
} from "@/lib/api-helpers";
import { Action, FirmRole, requirePermission } from "@/lib/permissions";
import {
  isAllowedTransition,
  MAX_TASK_DESCRIPTION_LENGTH,
  MAX_TASK_NOTE_LENGTH,
  MAX_TASK_TITLE_LENGTH,
  PRIORITIES,
  TASK_STATUSES,
  type TaskStatus,
} from "@/lib/task-constants";

// --- Validation -----------------------------------------------------------

const isoDatetime = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Must be a valid ISO 8601 datetime.",
  });

// description: undefined = skip; "" = clear to null; non-empty = set
// (mirrors 3B clients PATCH semantics).
const updatableDescription = z
  .string()
  .transform((v, ctx) => {
    const t = v.trim();
    if (t.length > MAX_TASK_DESCRIPTION_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Description must be ${MAX_TASK_DESCRIPTION_LENGTH} characters or fewer.`,
      });
      return z.NEVER;
    }
    return t === "" ? null : t;
  })
  .optional();

const UpdateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty.")
      .max(
        MAX_TASK_TITLE_LENGTH,
        `Title must be ${MAX_TASK_TITLE_LENGTH} characters or fewer.`,
      )
      .optional(),
    description: updatableDescription,
    dueDate: isoDatetime.optional(),
    priority: z.enum(PRIORITIES).optional(),
    reviewerId: z.string().trim().min(1).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    note: z
      .string()
      .trim()
      .min(1, "Note cannot be empty.")
      .max(
        MAX_TASK_NOTE_LENGTH,
        `Note must be ${MAX_TASK_NOTE_LENGTH} characters or fewer.`,
      )
      .optional(),
  })
  .strict();

// --- GET /api/tasks/[id] --------------------------------------------------

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.TASK_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  const { id } = await context.params;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });

    if (!task || task.firmId !== session.firmId) {
      if (task && task.firmId !== session.firmId) {
        console.warn("Cross-firm task read attempt", {
          sessionFirmId: session.firmId,
          attemptedTaskId: id,
          route: "GET /api/tasks/[id]",
        });
      }
      return err("Task not found.", 404);
    }

    // ARTICLE_STAFF visibility per Decision C1: only own (creator) or
    // assigned tasks. Out-of-scope returns 404 (not 403) to avoid leaking
    // that the id exists within the firm.
    if (session.firmRole === FirmRole.ARTICLE_STAFF) {
      const isCreator = task.createdById === session.userId;
      const isAssignee = task.assignees.some(
        (a) => a.userId === session.userId,
      );
      if (!isCreator && !isAssignee) {
        return err("Task not found.", 404);
      }
    }

    return ok(task);
  } catch {
    return err("Unable to read task.", 500);
  }
}

// --- PATCH /api/tasks/[id] ------------------------------------------------
//
// FIRST GATE NOTE: requireAuth(Action.TASK_VIEW) below is for AUTHENTICATED
// ROUTE ENTRY ONLY. It does NOT authorize mutation. Mutation authorization
// happens at the operation classifier further down (TASK_EDIT or
// TASK_MOVE_TO_REVIEW per the corrected design at D-2026-05-04-02).

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  // Auth-entry gate. NOT mutation authorization.
  const auth = await requireAuth(request, Action.TASK_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  const { id } = await context.params;

  const parsed = await parseJson(request, UpdateTaskSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });

    if (!task || task.firmId !== session.firmId) {
      if (task && task.firmId !== session.firmId) {
        console.warn("Cross-firm task PATCH attempt", {
          sessionFirmId: session.firmId,
          attemptedTaskId: id,
          route: "PATCH /api/tasks/[id]",
        });
      }
      return err("Task not found.", 404);
    }

    // ARTICLE_STAFF visibility per Decision C1.
    const isCreator = task.createdById === session.userId;
    const isReviewer = task.reviewerId === session.userId;
    const isAssignee = task.assignees.some(
      (a) => a.userId === session.userId,
    );
    // Decision K1: isOwnTask = isCreator OR isAssignee.
    const isOwnTask = isCreator || isAssignee;

    if (session.firmRole === FirmRole.ARTICLE_STAFF) {
      if (!isCreator && !isAssignee) {
        return err("Task not found.", 404);
      }
    }

    // Operation classification.
    const hasStatus = body.status !== undefined;
    const hasOtherFields =
      body.title !== undefined ||
      body.description !== undefined ||
      body.dueDate !== undefined ||
      body.priority !== undefined ||
      body.reviewerId !== undefined;
    const hasNote = body.note !== undefined;

    // Body-shape sanity: empty PATCH or note-only PATCH.
    if (!hasStatus && !hasOtherFields) {
      if (hasNote) {
        return err(
          "Use POST /api/tasks/[id]/notes to add a progress note.",
          422,
        );
      }
      return err("At least one field is required.", 422);
    }

    // Note-without-status semantics enforcement (D-2026-05-04-02).
    // A note attached to a non-status edit is rejected to keep the route
    // surface clean - users add notes via the dedicated /notes endpoint.
    if (hasNote && !hasStatus) {
      return err(
        "Use POST /api/tasks/[id]/notes to add a progress note.",
        422,
      );
    }

    // Mutation authorization dispatch (corrected design per D-2026-05-04-02).
    if (hasOtherFields) {
      // Any non-status field edit (with or without status) requires
      // TASK_EDIT. ARTICLE_STAFF rejected here since they lack TASK_EDIT.
      const check = requirePermission(session, Action.TASK_EDIT, {
        isCreator,
        isReviewer,
      });
      if (!check.ok) return err(check.message, check.status);
    } else if (hasStatus && body.status === "UNDER_REVIEW") {
      // Status-only move to UNDER_REVIEW uses TASK_MOVE_TO_REVIEW with
      // isOwnTask context (Decision K1: isOwnTask = isCreator OR isAssignee).
      // ARTICLE_STAFF passes only when isOwnTask is true.
      const check = requirePermission(session, Action.TASK_MOVE_TO_REVIEW, {
        isOwnTask,
      });
      if (!check.ok) return err(check.message, check.status);
    } else if (hasStatus) {
      // Status-only move to non-UNDER_REVIEW (e.g., OPEN -> IN_PROGRESS,
      // PENDING_* -> IN_PROGRESS) requires TASK_EDIT. ARTICLE_STAFF
      // rejected here since they lack TASK_EDIT.
      const check = requirePermission(session, Action.TASK_EDIT, {
        isCreator,
        isReviewer,
      });
      if (!check.ok) return err(check.message, check.status);
    }

    // Status transition validation (only if status is being changed).
    const currentStatus = task.status as TaskStatus;
    if (hasStatus) {
      const newStatus = body.status as TaskStatus;

      // Reject transitions that belong to dedicated 3D-3 endpoints. These
      // endpoints carry required reason / closureRemarks text that PATCH
      // does not capture cleanly.
      if (newStatus === "CLOSED") {
        return err(
          "Use POST /api/tasks/[id]/close to close a task.",
          422,
        );
      }
      if (newStatus === "CANCELLED") {
        return err(
          "Use POST /api/tasks/[id]/cancel to cancel a task.",
          422,
        );
      }
      if (currentStatus === "CLOSED") {
        return err(
          "Use POST /api/tasks/[id]/reopen to reopen a closed task.",
          422,
        );
      }

      // Validate transition matrix per MASTER Section 23.2.
      if (!isAllowedTransition(currentStatus, newStatus)) {
        return err(
          `Invalid transition from ${currentStatus} to ${newStatus}.`,
          422,
        );
      }

      // Note required for moves to PENDING_*/UNDER_REVIEW per Section 23.5.
      const requiresNote =
        newStatus === "PENDING_CLIENT" ||
        newStatus === "PENDING_INTERNAL" ||
        newStatus === "UNDER_REVIEW";
      if (requiresNote && !hasNote) {
        return err(
          `A progress note is required when moving to ${newStatus}.`,
          422,
        );
      }
    }

    // Reviewer change cross-firm validation.
    const reviewerChanged =
      body.reviewerId !== undefined && body.reviewerId !== task.reviewerId;
    if (reviewerChanged) {
      const reviewerMembership = await prisma.firmMember.findUnique({
        where: {
          firmId_userId: {
            firmId: session.firmId,
            userId: body.reviewerId as string,
          },
        },
      });
      if (!reviewerMembership || !reviewerMembership.isActive) {
        console.warn("Cross-firm or inactive reviewerId attempt", {
          sessionFirmId: session.firmId,
          attemptedReviewerId: body.reviewerId,
          route: "PATCH /api/tasks/[id]",
        });
        return err("Reviewer not found.", 404);
      }
    }

    // Capture pre-update state for ActivityLog metadata.
    const oldStatus = task.status;
    const oldReviewerId = task.reviewerId;

    // Build Prisma update payload. undefined = skip; null = clear; value = set.
    const updateData: {
      title?: string;
      description?: string | null;
      dueDate?: Date;
      priority?: string;
      reviewerId?: string;
      status?: string;
    } = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.dueDate !== undefined)
      updateData.dueDate = new Date(body.dueDate);
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.reviewerId !== undefined) updateData.reviewerId = body.reviewerId;
    if (body.status !== undefined) updateData.status = body.status;

    const statusChanged = hasStatus && body.status !== oldStatus;

    // Apply mutation in a transaction. Auto-create TaskNote if status
    // changed AND a note was supplied. Notes are optional for revert
    // transitions (e.g., UNDER_REVIEW -> IN_PROGRESS) per Section 23.5.
    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id },
        data: updateData,
        include: { assignees: { select: { userId: true } } },
      });
      if (statusChanged && hasNote) {
        await tx.taskNote.create({
          data: {
            taskId: id,
            authorId: session.userId,
            note: body.note as string,
            oldStatus,
            newStatus: body.status as string,
          },
        });
      }
      return t;
    });

    // ActivityLog calls (deferred no-op until Step 4 lights up
    // writeActivityLog). Each distinct event emits its own call; multiple
    // events per PATCH are allowed (Section 23.6 / Section 25).
    if (statusChanged) {
      await writeActivityLog({
        firmId: session.firmId,
        actorId: session.userId,
        entityType: "Task",
        entityId: id,
        action: "TASK_STATUS_CHANGE",
        metadataJson: JSON.stringify({
          oldStatus,
          newStatus: body.status,
        }),
      });
    }
    if (reviewerChanged) {
      await writeActivityLog({
        firmId: session.firmId,
        actorId: session.userId,
        entityType: "Task",
        entityId: id,
        action: "TASK_REVIEWER_CHANGE",
        metadataJson: JSON.stringify({
          oldReviewerId,
          newReviewerId: body.reviewerId,
        }),
      });
    }
    const otherFieldsChanged =
      body.title !== undefined ||
      body.description !== undefined ||
      body.dueDate !== undefined ||
      body.priority !== undefined;
    if (otherFieldsChanged) {
      const fields: string[] = [];
      if (body.title !== undefined) fields.push("title");
      if (body.description !== undefined) fields.push("description");
      if (body.dueDate !== undefined) fields.push("dueDate");
      if (body.priority !== undefined) fields.push("priority");
      await writeActivityLog({
        firmId: session.firmId,
        actorId: session.userId,
        entityType: "Task",
        entityId: id,
        action: "TASK_UPDATE",
        metadataJson: JSON.stringify({ fields }),
      });
    }

    return ok(updated);
  } catch {
    return err("Unable to update task.", 500);
  }
}
