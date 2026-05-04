// src/app/api/tasks/[id]/notes/route.ts
// PracticeIQ Section 14 Step 3D-2 - Status-less progress note.
// POST /api/tasks/[id]/notes - add a progress note (no status change).
//
// For status-attached notes, use PATCH /api/tasks/[id] with both status
// and note in the same request. PATCH auto-creates a TaskNote with
// oldStatus / newStatus when status changes (Section 23.5).
//
// Auth: requireAuth(Action.TASK_ADD_NOTE) returns 401 in Step 3 until
// Step 4 wires real Supabase Auth into requireSession(). TASK_ADD_NOTE is
// granted to all firm roles (Section 10) so the gate covers both
// authentication and permission for this endpoint.
//
// Tenant + ARTICLE_STAFF visibility scope per Decision C1: ARTICLE_STAFF
// can add notes only to tasks where they are creator or assignee. Cross-
// firm hits AND out-of-scope hits both return 404 to avoid leaking that
// the id exists.
//
// References: MASTER_PROJECT.md Section 14 Step 3D-2; Section 23.5
// (note rules); Section 25 (security); CHANGE_LOG C-2026-05-04-03;
// DECISION_LOG D-2026-05-04-02.

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
import { Action, FirmRole } from "@/lib/permissions";
import { MAX_TASK_NOTE_LENGTH } from "@/lib/task-constants";

// --- Validation -----------------------------------------------------------

const AddNoteSchema = z
  .object({
    note: z
      .string()
      .trim()
      .min(1, "Note cannot be empty.")
      .max(
        MAX_TASK_NOTE_LENGTH,
        `Note must be ${MAX_TASK_NOTE_LENGTH} characters or fewer.`,
      ),
  })
  .strict();

// --- POST /api/tasks/[id]/notes -------------------------------------------

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.TASK_ADD_NOTE);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  const { id } = await context.params;

  const parsed = await parseJson(request, AddNoteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });

    if (!task || task.firmId !== session.firmId) {
      if (task && task.firmId !== session.firmId) {
        console.warn("Cross-firm task note-add attempt", {
          sessionFirmId: session.firmId,
          attemptedTaskId: id,
          route: "POST /api/tasks/[id]/notes",
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

    // Status-less note: oldStatus and newStatus default to null when
    // omitted from the create payload (both are String? in the schema).
    // Status-attached notes are created by PATCH /api/tasks/[id] when
    // status changes; this endpoint is reserved for status-less notes.
    const note = await prisma.taskNote.create({
      data: {
        taskId: id,
        authorId: session.userId,
        note: parsed.data.note,
      },
    });

    // Deferred no-op per D-2026-04-30-15 Decision 4. Call site preserved
    // so Step 4 can light up the audit trail without route churn.
    await writeActivityLog({
      firmId: session.firmId,
      actorId: session.userId,
      entityType: "Task",
      entityId: id,
      action: "TASK_NOTE_ADD",
    });

    return ok(note, 201);
  } catch {
    return err("Unable to add note.", 500);
  }
}
