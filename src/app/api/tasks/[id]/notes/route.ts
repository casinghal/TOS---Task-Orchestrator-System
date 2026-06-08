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
import { resolveCrossFirmContext } from "@/lib/cross-firm";
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

  const { id } = await context.params;

  // Step 4F-2: cross-firm impersonation.
  const url = new URL(request.url);
  const impersonateFirmId = url.searchParams.get("impersonateFirmId");
  const ctx = await resolveCrossFirmContext({
    request,
    session,
    candidateFirmId: impersonateFirmId,
    entityType: "Task",
    entityId: id,
    routeLabel: "POST /api/tasks/[id]/notes",
  });
  if (!ctx.ok) return ctx.response;
  const { effectiveFirmId, isImpersonation } = ctx;

  const parsed = await parseJson(request, AddNoteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });

    if (!task) {
      return err("Task not found.", 404);
    }
    if (task.firmId !== effectiveFirmId) {
      console.warn("Cross-firm task note-add attempt", {
        effectiveFirmId,
        attemptedTaskId: id,
        actorId: session.userId,
        route: "POST /api/tasks/[id]/notes",
      });
      return err("Task not found.", 404);
    }

    // ARTICLE_STAFF visibility per Decision C1.
    // Step 4F-2 D2: PLATFORM_OWNER cross-firm impersonation bypasses the
    // home-firm ARTICLE_STAFF visibility self-scope.
    if (
      !isImpersonation &&
      session.firmRole === FirmRole.ARTICLE_STAFF
    ) {
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

    // Routine post-mutation audit. firmId reflects effective tenant scope;
    // actorId remains the impersonator's userId.
    await writeActivityLog({
      firmId: effectiveFirmId,
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

// --- GET /api/tasks/[id]/notes --------------------------------------------
// Section 14 Step 5B-4d-2a: notes-read API. Returns the task's progress notes
// (status-less + lifecycle-attached) so the UI can render notes from the API
// instead of local state. Read-only: no ActivityLog is written. Auth / cross-
// firm 404 / ARTICLE_STAFF self-scope mirror GET /api/tasks/[id] exactly. The
// task-list GET is intentionally NOT changed (no notes over-fetch there).

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.TASK_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await context.params;

  // Step 4F-2: cross-firm impersonation.
  const url = new URL(request.url);
  const impersonateFirmId = url.searchParams.get("impersonateFirmId");
  const ctx = await resolveCrossFirmContext({
    request,
    session,
    candidateFirmId: impersonateFirmId,
    entityType: "Task",
    entityId: id,
    routeLabel: "GET /api/tasks/[id]/notes",
  });
  if (!ctx.ok) return ctx.response;
  const { effectiveFirmId, isImpersonation } = ctx;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });

    if (!task) {
      return err("Task not found.", 404);
    }
    if (task.firmId !== effectiveFirmId) {
      console.warn("Cross-firm task notes-read attempt", {
        effectiveFirmId,
        attemptedTaskId: id,
        actorId: session.userId,
        route: "GET /api/tasks/[id]/notes",
      });
      return err("Task not found.", 404);
    }

    // ARTICLE_STAFF visibility per Decision C1: only own (creator) or
    // assigned tasks; out-of-scope returns 404 (not 403) to avoid leaking
    // that the id exists. Step 4F-2 D2: PLATFORM_OWNER cross-firm
    // impersonation bypasses the home-firm self-scope.
    if (
      !isImpersonation &&
      session.firmRole === FirmRole.ARTICLE_STAFF
    ) {
      const isCreator = task.createdById === session.userId;
      const isAssignee = task.assignees.some(
        (a) => a.userId === session.userId,
      );
      if (!isCreator && !isAssignee) {
        return err("Task not found.", 404);
      }
    }

    // Read-only (no audit). Newest-first for drawer presentation.
    const items = await prisma.taskNote.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        taskId: true,
        authorId: true,
        note: true,
        oldStatus: true,
        newStatus: true,
        createdAt: true,
      },
    });

    return ok({ items });
  } catch {
    return err("Unable to load notes.", 500);
  }
}
