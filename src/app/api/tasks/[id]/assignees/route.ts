// src/app/api/tasks/[id]/assignees/route.ts
// PracticeIQ Section 14 Step 3D-2 - Task assignees set-semantics mutation.
// PATCH /api/tasks/[id]/assignees - add / remove assignees (set semantics).
//
// Body: { add?: string[], remove?: string[] }. At least one non-empty.
// Set semantics: add ignores duplicates / already-assignees; remove
// ignores non-members. Final assignee count must remain in [1,
// MAX_ASSIGNEES_PER_TASK] - else 422.
//
// FIRST GATE NOTE: requireAuth(Action.TASK_VIEW) below is for AUTHENTICATED
// ROUTE ENTRY ONLY (consistent with the corrected PATCH design at
// D-2026-05-04-02). Mutation authorization happens via requirePermission
// (TASK_EDIT) further down. ARTICLE_STAFF is rejected unconditionally at
// the route layer (per Section 23.5: "ARTICLE_STAFF cannot reassign")
// regardless of creator / reviewer context.
//
// References: MASTER_PROJECT.md Section 14 Step 3D-2; Section 23.5
// (assignee rules); Section 25 (security); Decision F1 (assigneeIds
// rejected in PATCH /api/tasks/[id]; mutation goes through this endpoint);
// CHANGE_LOG C-2026-05-04-03; DECISION_LOG D-2026-05-04-02.

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
import { MAX_ASSIGNEES_PER_TASK } from "@/lib/task-constants";

// --- Validation -----------------------------------------------------------

const UpdateAssigneesSchema = z
  .object({
    add: z.array(z.string().trim().min(1)).optional(),
    remove: z.array(z.string().trim().min(1)).optional(),
  })
  .strict()
  .refine(
    (data) =>
      (data.add !== undefined && data.add.length > 0) ||
      (data.remove !== undefined && data.remove.length > 0),
    { message: "At least one of 'add' or 'remove' must be non-empty." },
  );

// --- PATCH /api/tasks/[id]/assignees --------------------------------------

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  // Auth-entry gate. NOT mutation authorization. Mutation auth is
  // requirePermission(TASK_EDIT, ...) further down.
  const auth = await requireAuth(request, Action.TASK_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  // ARTICLE_STAFF cannot reassign per Section 23.5. Reject early at the
  // route layer regardless of context (creator, reviewer, or otherwise).
  if (session.firmRole === FirmRole.ARTICLE_STAFF) {
    return err("You do not have permission for this action.", 403);
  }

  const { id } = await context.params;

  const parsed = await parseJson(request, UpdateAssigneesSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignees: { select: { userId: true } } },
    });

    if (!task || task.firmId !== session.firmId) {
      if (task && task.firmId !== session.firmId) {
        console.warn("Cross-firm assignees PATCH attempt", {
          sessionFirmId: session.firmId,
          attemptedTaskId: id,
          route: "PATCH /api/tasks/[id]/assignees",
        });
      }
      return err("Task not found.", 404);
    }

    // Mutation authorization: TASK_EDIT with isCreator / isReviewer
    // context. FIRM_ADMIN bypass via existing matrix; PARTNER / MANAGER
    // need creator-or-reviewer context.
    const isCreator = task.createdById === session.userId;
    const isReviewer = task.reviewerId === session.userId;
    const editCheck = requirePermission(session, Action.TASK_EDIT, {
      isCreator,
      isReviewer,
    });
    if (!editCheck.ok) return err(editCheck.message, editCheck.status);

    const addList = parsed.data.add ?? [];
    const removeList = parsed.data.remove ?? [];

    // Validate every add[i] as active FirmMember of caller's firm.
    if (addList.length > 0) {
      const addMemberships = await prisma.firmMember.findMany({
        where: {
          firmId: session.firmId,
          userId: { in: addList },
          isActive: true,
        },
        select: { userId: true },
      });
      const validAddIds = new Set(addMemberships.map((m) => m.userId));
      const invalidAdds = addList.filter((u) => !validAddIds.has(u));
      if (invalidAdds.length > 0) {
        console.warn("Cross-firm or inactive assigneeId add attempt", {
          sessionFirmId: session.firmId,
          attemptedAssigneeIds: invalidAdds,
          route: "PATCH /api/tasks/[id]/assignees",
        });
        return err("One or more assignees not found.", 404);
      }
    }

    // Compute resulting set: (current ∪ add) \ remove. Set semantics: add
    // ignores duplicates / already-assignees; remove ignores non-members.
    const current = new Set(task.assignees.map((a) => a.userId));
    const addSet = new Set(addList);
    const removeSet = new Set(removeList);
    const resulting = new Set<string>();
    current.forEach((u) => {
      if (!removeSet.has(u)) resulting.add(u);
    });
    addSet.forEach((u) => {
      if (!removeSet.has(u)) resulting.add(u);
    });

    // Final-count sanity per Section 25.5 / Decision G.
    if (resulting.size < 1) {
      return err("Task must have at least one assignee.", 422);
    }
    if (resulting.size > MAX_ASSIGNEES_PER_TASK) {
      return err(
        `Maximum ${MAX_ASSIGNEES_PER_TASK} assignees per task.`,
        422,
      );
    }

    // Compute net actual changes (what truly gets added or removed).
    const netAdded = Array.from(addSet).filter((u) => !current.has(u));
    const netRemoved = Array.from(removeSet).filter((u) => current.has(u));

    // Apply the mutation in a transaction. createMany is safe because
    // netAdded only contains IDs not already present in current.
    const updated = await prisma.$transaction(async (tx) => {
      if (netRemoved.length > 0) {
        await tx.taskAssignee.deleteMany({
          where: {
            taskId: id,
            userId: { in: netRemoved },
          },
        });
      }
      if (netAdded.length > 0) {
        await tx.taskAssignee.createMany({
          data: netAdded.map((userId) => ({ taskId: id, userId })),
        });
      }
      return tx.task.findUnique({
        where: { id },
        include: { assignees: { select: { userId: true } } },
      });
    });

    // ActivityLog calls (deferred no-op until Step 4). Two distinct events
    // for add and remove; either or both may fire depending on net changes
    // (Section 23.6).
    if (netAdded.length > 0) {
      await writeActivityLog({
        firmId: session.firmId,
        actorId: session.userId,
        entityType: "Task",
        entityId: id,
        action: "TASK_ASSIGNEE_ADD",
        metadataJson: JSON.stringify({ added: netAdded }),
      });
    }
    if (netRemoved.length > 0) {
      await writeActivityLog({
        firmId: session.firmId,
        actorId: session.userId,
        entityType: "Task",
        entityId: id,
        action: "TASK_ASSIGNEE_REMOVE",
        metadataJson: JSON.stringify({ removed: netRemoved }),
      });
    }

    return ok(updated);
  } catch {
    return err("Unable to update assignees.", 500);
  }
}
