// src/app/api/tasks/[id]/reopen/route.ts
// PracticeIQ Section 14 Step 3D-3 - Task reopen action.
// POST /api/tasks/[id]/reopen - move CLOSED -> IN_PROGRESS via the only
// approved reopen path. Reason required. Clears closedAt = null,
// closedById = null, AND closureRemarks = null (per the field-clear
// correction approved at D-2026-05-04-03). The historical closure
// rationale is preserved in the auto-created TaskNote from the original
// close event plus the TASK_CLOSE ActivityLog entry's `{ noteId }`
// reference; clearing closureRemarks on Task only resets the current-
// state column so an IN_PROGRESS task does not carry a stale closure
// remark.
//
// REOPENED is NOT a status. Reopen is an action that returns the task
// to IN_PROGRESS (Section 23.1 / 23.3).
//
// FIRST GATE NOTE: requireAuth(Action.TASK_VIEW) below is for AUTHENTICATED
// ROUTE ENTRY ONLY. Mutation authorization happens via
// requirePermission(TASK_REOPEN) further down.
//
// ARTICLE_STAFF visibility per Decision M1: visibility-then-permission.
// Visible (creator-or-assignee) tasks yield 403 if ARTICLE_STAFF lacks
// TASK_REOPEN; non-visible tasks return 404.
//
// References: MASTER_PROJECT.md Section 14 Step 3D-3; Section 23.3
// (reopen rules); Section 25 (security); CHANGE_LOG C-2026-05-04-05;
// DECISION_LOG D-2026-05-04-03 (Decision M + reopen field-clear correction).

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

const ReopenTaskSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Reopen reason is required.")
      .max(
        MAX_TASK_NOTE_LENGTH,
        `Reason must be ${MAX_TASK_NOTE_LENGTH} characters or fewer.`,
      ),
  })
  .strict();

// --- POST /api/tasks/[id]/reopen ------------------------------------------

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

  const parsed = await parseJson(request, ReopenTaskSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });

    if (!task || task.firmId !== session.firmId) {
      if (task && task.firmId !== session.firmId) {
        console.warn("Cross-firm task reopen attempt", {
          sessionFirmId: session.firmId,
          attemptedTaskId: id,
          route: "POST /api/tasks/[id]/reopen",
        });
      }
      return err("Task not found.", 404);
    }

    // ARTICLE_STAFF visibility per Decision M1.
    const isCreator = task.createdById === session.userId;
    const isReviewer = task.reviewerId === session.userId;
    const isAssignee = task.assignees.some(
      (a) => a.userId === session.userId,
    );

    if (session.firmRole === FirmRole.ARTICLE_STAFF) {
      if (!isCreator && !isAssignee) {
        return err("Task not found.", 404);
      }
    }

    // Mutation authorization: TASK_REOPEN with isReviewer context.
    // FIRM_ADMIN bypass via existing matrix; PARTNER / MANAGER need
    // isReviewer; ARTICLE_STAFF rejected here.
    const permCheck = requirePermission(session, Action.TASK_REOPEN, {
      isReviewer,
    });
    if (!permCheck.ok) return err(permCheck.message, permCheck.status);

    // Status precondition: only CLOSED can be reopened.
    if (task.status !== "CLOSED") {
      return err("Only CLOSED tasks can be reopened.", 422);
    }

    // Apply mutation in a transaction. Per the field-clear correction
    // (D-2026-05-04-03), all three current-state closure fields are
    // cleared. Historical closure rationale lives in the TaskNote chain
    // and the original TASK_CLOSE ActivityLog entry.
    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          closedAt: null,
          closedById: null,
          closureRemarks: null,
        },
        include: { assignees: { select: { userId: true } } },
      });
      const note = await tx.taskNote.create({
        data: {
          taskId: id,
          authorId: session.userId,
          note: body.reason,
          oldStatus: "CLOSED",
          newStatus: "IN_PROGRESS",
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
      action: "TASK_REOPEN",
      metadataJson: JSON.stringify({ noteId: updated.noteId }),
    });

    return ok(updated.task);
  } catch {
    return err("Unable to reopen task.", 500);
  }
}
