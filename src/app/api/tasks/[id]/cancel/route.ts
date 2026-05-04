// src/app/api/tasks/[id]/cancel/route.ts
// PracticeIQ Section 14 Step 3D-3 - Task cancel action.
// POST /api/tasks/[id]/cancel - move any non-terminal task -> CANCELLED.
// Reason required. Cannot cancel CLOSED or already CANCELLED tasks.
// Cancel is terminal; no path leaves CANCELLED. Section 23.3.
//
// Cancel does not touch closedAt / closedById / closureRemarks. Per the
// field-clear correction at D-2026-05-04-03, reopen clears these three
// fields. Together this gives the invariant: any task whose status is
// NOT CLOSED has closedAt = null AND closedById = null AND
// closureRemarks = null.
//
// FIRST GATE NOTE: requireAuth(Action.TASK_VIEW) below is for AUTHENTICATED
// ROUTE ENTRY ONLY. Mutation authorization happens via
// requirePermission(TASK_CANCEL) further down.
//
// ARTICLE_STAFF visibility per Decision M1: visibility-then-permission.
// Visible tasks (creator-or-assignee) yield 403 if ARTICLE_STAFF lacks
// TASK_CANCEL; non-visible tasks return 404. Per Section 23.5,
// ARTICLE_STAFF cannot cancel even tasks they created.
//
// References: MASTER_PROJECT.md Section 14 Step 3D-3; Section 23.3
// (cancel rules); Section 23.5 (ARTICLE_STAFF restriction); Section 25
// (security); CHANGE_LOG C-2026-05-04-05; DECISION_LOG D-2026-05-04-03.

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
import { MAX_TASK_NOTE_LENGTH } from "@/lib/task-constants";

// --- Validation -----------------------------------------------------------

const CancelTaskSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Cancellation reason is required.")
      .max(
        MAX_TASK_NOTE_LENGTH,
        `Reason must be ${MAX_TASK_NOTE_LENGTH} characters or fewer.`,
      ),
  })
  .strict();

// --- POST /api/tasks/[id]/cancel ------------------------------------------

export async function POST(
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

  const parsed = await parseJson(request, CancelTaskSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });

    if (!task || task.firmId !== session.firmId) {
      if (task && task.firmId !== session.firmId) {
        console.warn("Cross-firm task cancel attempt", {
          sessionFirmId: session.firmId,
          attemptedTaskId: id,
          route: "POST /api/tasks/[id]/cancel",
        });
      }
      return err("Task not found.", 404);
    }

    // ARTICLE_STAFF visibility per Decision M1. Cancel context is
    // isCreator only (Section 23.3: FIRM_ADMIN, PARTNER, or creator).
    // isReviewer is intentionally NOT computed here.
    const isCreator = task.createdById === session.userId;
    const isAssignee = task.assignees.some(
      (a) => a.userId === session.userId,
    );

    if (session.firmRole === FirmRole.ARTICLE_STAFF) {
      if (!isCreator && !isAssignee) {
        return err("Task not found.", 404);
      }
    }

    // Mutation authorization: TASK_CANCEL with isCreator context.
    // FIRM_ADMIN and PARTNER bypass via existing matrix; MANAGER needs
    // isCreator; ARTICLE_STAFF rejected here (per Section 23.5,
    // ARTICLE_STAFF cannot cancel even tasks they created).
    const permCheck = requirePermission(session, Action.TASK_CANCEL, {
      isCreator,
    });
    if (!permCheck.ok) return err(permCheck.message, permCheck.status);

    // Status precondition: cannot cancel CLOSED or already CANCELLED.
    if (task.status === "CLOSED") {
      return err(
        "Cannot cancel a CLOSED task. Reopen first if needed.",
        422,
      );
    }
    if (task.status === "CANCELLED") {
      return err("Task is already CANCELLED.", 422);
    }

    // Apply mutation in a transaction. Cancel does not touch closedAt /
    // closedById / closureRemarks (these are null on any cancellable task
    // because: never-closed tasks never set them; reopened tasks have
    // them cleared per the field-clear correction at D-2026-05-04-03).
    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id },
        data: {
          status: "CANCELLED",
        },
        include: { assignees: { select: { userId: true } } },
      });
      const note = await tx.taskNote.create({
        data: {
          taskId: id,
          authorId: session.userId,
          note: body.reason,
          oldStatus: task.status,
          newStatus: "CANCELLED",
        },
      });
      return { task: t, noteId: note.id };
    });

    // ActivityLog (deferred no-op until Step 4). Per Decision I, the
    // free-text reason lives on the firm-scoped TaskNote; metadata
    // carries `{ noteId }` reference only.
    await writeActivityLog({
      firmId: session.firmId,
      actorId: session.userId,
      entityType: "Task",
      entityId: id,
      action: "TASK_CANCEL",
      metadataJson: JSON.stringify({ noteId: updated.noteId }),
    });

    return ok(updated.task);
  } catch {
    return err("Unable to cancel task.", 500);
  }
}
