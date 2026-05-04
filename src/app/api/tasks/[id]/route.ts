// src/app/api/tasks/[id]/route.ts
// PracticeIQ Section 14 Step 3D-1 - Tasks single-item routes.
// GET /api/tasks/[id] - read one task; 404 if missing or cross-firm.
//
// PATCH ships in Step 3D-2 (mutations). close / reopen / cancel ship in
// 3D-3 (lifecycle actions) as dedicated POST endpoints.
//
// Auth-gated via requireAuth() and therefore returns 401 in Step 3 until
// Step 4 wires real Supabase Auth into requireSession().
//
// ARTICLE_STAFF visibility is server-enforced per Decision C1: ARTICLE_STAFF
// can read only tasks where they are creator or assignee. Cross-firm hits
// AND out-of-scope hits both return 404 to avoid leaking that the id
// exists.
//
// References: MASTER_PROJECT.md Section 14 Step 3D; Section 23 (task
// operating model); Section 25 (route construction security); CHANGE_LOG
// C-2026-05-04-01; DECISION_LOG D-2026-05-04-01.

import { prisma } from "@/lib/prisma";
import {
  databaseUnavailable,
  err,
  ok,
  requireAuth,
} from "@/lib/api-helpers";
import { Action, FirmRole } from "@/lib/permissions";

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
      // Cross-firm hits return 404 to avoid leaking that the id exists.
      // Log cross-firm attempts (task exists but belongs to another firm)
      // server-side for future forensics per Section 25.4 #15.
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
