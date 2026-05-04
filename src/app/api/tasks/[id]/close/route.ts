// src/app/api/tasks/[id]/close/route.ts
// PracticeIQ Section 14 Step 3D-3 - Task close action.
// POST /api/tasks/[id]/close - move UNDER_REVIEW -> CLOSED with required
// closureRemarks. Sets closedAt = now(), closedById = session.userId,
// closureRemarks = body.closureRemarks. Auto-creates a TaskNote with the
// closure remark mirrored as the note body. Emits ActivityLog `TASK_CLOSE`
// with `{ noteId }` reference (per Decision I; closureRemarks lives on
// Task only between close and the next reopen, so the noteId reference
// is the durable audit anchor).
//
// FIRST GATE NOTE: requireAuth(Action.TASK_VIEW) below is for AUTHENTICATED
// ROUTE ENTRY ONLY (per the corrected design at D-2026-05-04-02 / 3D-2).
// Mutation authorization happens via requirePermission(TASK_CLOSE) further
// down once isReviewer context is computed from the loaded task.
//
// ARTICLE_STAFF visibility per Decision M1 (D-2026-05-04-03 / 3D-3):
// visibility-then-permission. Visible tasks (creator-or-assignee) yield
// 403 if ARTICLE_STAFF lacks TASK_CLOSE; non-visible tasks return 404 to
// avoid leaking that the id exists.
//
// References: MASTER_PROJECT.md Section 14 Step 3D-3; Section 23.3 (close
// rules); Section 25 (security); CHANGE_LOG C-2026-05-04-05;
// DECISION_LOG D-2026-05-04-03.

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

const CloseTaskSchema = z
  .object({
    closureRemarks: z
      .string()
      .trim()
      .min(1, "Closure remarks are required.")
      .max(
        MAX_TASK_NOTE_LENGTH,
        `Closure remarks must be ${MAX_TASK_NOTE_LENGTH} characters or fewer.`,
      ),
  })
  .strict();

// --- POST /api/tasks/[id]/close -------------------------------------------

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

  const parsed = await parseJson(request, CloseTaskSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });

    if (!task || task.firmId !== session.firmId) {
      if (task && task.firmId !== session.firmId) {
        console.warn("Cross-firm task close attempt", {
          sessionFirmId: session.firmId,
          attemptedTaskId: id,
          route: "POST /api/tasks/[id]/close",
        });
      }
      return err("Task not found.", 404);
    }

    // ARTICLE_STAFF visibility per Decision M1: out-of-scope returns 404
    // (not 403) to avoid leaking that the id exists within the firm.
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

    // Mutation authorization: TASK_CLOSE with isReviewer context.
    // FIRM_ADMIN bypass via existing matrix; PARTNER / MANAGER need
    // isReviewer; ARTICLE_STAFF rejected here (no TASK_CLOSE in any
    // base or context grant).
    const permCheck = requirePermission(session, Action.TASK_CLOSE, {
      isReviewer,
    });
    if (!permCheck.ok) return err(permCheck.message, permCheck.status);

    // Status precondition: only UNDER_REVIEW can be closed.
    if (task.status !== "UNDER_REVIEW") {
      return err(
        "Only tasks in UNDER_REVIEW can be closed.",
        422,
      );
    }

    // Apply mutation in a transaction. The TaskNote captures the durable
    // closure rationale; the Task row holds the current-state closure
    // fields (cleared by reopen if/when that happens).
    const updated = await prisma.$transaction(async (tx) => {
      const closedAt = new Date();
      const t = await tx.task.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedAt,
          closedById: session.userId,
          closureRemarks: body.closureRemarks,
        },
        include: { assignees: { select: { userId: true } } },
      });
      const note = await tx.taskNote.create({
        data: {
          taskId: id,
          authorId: session.userId,
          note: body.closureRemarks,
          oldStatus: "UNDER_REVIEW",
          newStatus: "CLOSED",
        },
      });
      return { task: t, noteId: note.id };
    });

    // ActivityLog (deferred no-op until Step 4). Per Decision I, free-text
    // closure rationale lives on the firm-scoped TaskNote; metadata
    // carries `{ noteId }` reference only.
    await writeActivityLog({
      firmId: session.firmId,
      actorId: session.userId,
      entityType: "Task",
      entityId: id,
      action: "TASK_CLOSE",
      metadataJson: JSON.stringify({ noteId: updated.noteId }),
    });

    return ok(updated.task);
  } catch {
    return err("Unable to close task.", 500);
  }
}
