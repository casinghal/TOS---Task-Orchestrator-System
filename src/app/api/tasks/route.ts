// src/app/api/tasks/route.ts
// PracticeIQ Section 14 Step 3D-1 - Tasks routes (collection).
// GET  /api/tasks  - paginated, filtered list scoped to caller's firm.
// POST /api/tasks  - create task with mandatory client + reviewer + at least
//                    one assignee.
//
// Both routes are auth-gated via requireAuth() and therefore return 401 in
// Step 3 until Step 4 wires real Supabase Auth into requireSession().
//
// Tenant isolation: every query includes where: { firmId: session.firmId }.
// Cross-firm references on POST (clientId, reviewerId, assigneeIds) return
// 404 with a server-side console.warn for future forensics. PLATFORM_OWNER
// without a firm context returns 400 - no all-firm escape hatch in 3D.
//
// ARTICLE_STAFF scope: GET list applies a server-enforced OR-filter
// restricting results to tasks where the caller is creator or assignee
// (Decision C1). No client-supplied query can widen this scope.
//
// Body schemas use Zod .strict() per Decision H locked at Section 25.5;
// unknown fields rejected with 422. Length and count caps consumed from
// task-constants.ts (Decision G locked at Section 25.5).
//
// References: MASTER_PROJECT.md Section 14 Step 3D; Section 23 (task
// operating model); Section 25 (route construction security); CHANGE_LOG
// C-2026-05-04-01; DECISION_LOG D-2026-05-04-01.

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
import {
  DEFAULT_TASK_PAGE_SIZE,
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  MAX_ASSIGNEES_PER_TASK,
  MAX_TASK_DESCRIPTION_LENGTH,
  MAX_TASK_PAGE_SIZE,
  MAX_TASK_TITLE_LENGTH,
  PRIORITIES,
  TASK_STATUSES,
} from "@/lib/task-constants";

// --- Validation -----------------------------------------------------------

// ISO 8601 datetime check. Past dates are explicitly permitted (Section
// 23.5) - firms enter backlog tasks at onboarding and during ad-hoc
// cleanup. Past-due tasks surface as overdue in reports.
const isoDatetime = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Must be a valid ISO 8601 datetime.",
  });

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_TASK_PAGE_SIZE).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  clientId: z.string().trim().min(1).optional(),
  reviewerId: z.string().trim().min(1).optional(),
  from: isoDatetime.optional(),
  to: isoDatetime.optional(),
});

const CreateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Task title is required.")
      .max(
        MAX_TASK_TITLE_LENGTH,
        `Title must be ${MAX_TASK_TITLE_LENGTH} characters or fewer.`,
      ),
    description: z
      .string()
      .trim()
      .max(
        MAX_TASK_DESCRIPTION_LENGTH,
        `Description must be ${MAX_TASK_DESCRIPTION_LENGTH} characters or fewer.`,
      )
      .optional(),
    clientId: z.string().trim().min(1, "clientId is required."),
    reviewerId: z.string().trim().min(1, "reviewerId is required."),
    assigneeIds: z
      .array(z.string().trim().min(1))
      .min(1, "At least one assignee is required.")
      .max(
        MAX_ASSIGNEES_PER_TASK,
        `Maximum ${MAX_ASSIGNEES_PER_TASK} assignees per task.`,
      ),
    dueDate: isoDatetime,
    priority: z.enum(PRIORITIES).optional(),
    // Status is constrained to OPEN at creation. Status transitions go
    // through PATCH (3D-2) or the dedicated /close, /reopen, /cancel
    // endpoints (3D-3).
    status: z.literal("OPEN").optional(),
  })
  .strict();

// --- GET /api/tasks -------------------------------------------------------

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.TASK_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  const url = new URL(request.url);
  const queryRaw = Object.fromEntries(url.searchParams.entries());
  const parsed = QuerySchema.safeParse(queryRaw);
  if (!parsed.success) {
    return err("Validation failed.", 422, parsed.error.issues);
  }
  const q = parsed.data;

  // Date range sanity. Both bounds present and inverted -> 422.
  if (q.from && q.to && new Date(q.from).getTime() > new Date(q.to).getTime()) {
    return err("'from' must be before or equal to 'to'.", 422);
  }

  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? DEFAULT_TASK_PAGE_SIZE;

  // Build the where clause. firmId is non-negotiable.
  const where: {
    firmId: string;
    status?: string;
    priority?: string;
    clientId?: string;
    reviewerId?: string;
    createdAt?: { gte?: Date; lte?: Date };
    OR?: Array<
      | { createdById: string }
      | { assignees: { some: { userId: string } } }
    >;
  } = { firmId: session.firmId };

  if (q.status) where.status = q.status;
  if (q.priority) where.priority = q.priority;
  if (q.clientId) where.clientId = q.clientId;
  if (q.reviewerId) where.reviewerId = q.reviewerId;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = new Date(q.from);
    if (q.to) where.createdAt.lte = new Date(q.to);
  }

  // ARTICLE_STAFF self-scope per Decision C1: own (creator) OR assigned.
  // Server-enforced; ignores any client-supplied filter that would attempt
  // to widen the scope. This must remain server-side only.
  if (session.firmRole === FirmRole.ARTICLE_STAFF) {
    where.OR = [
      { createdById: session.userId },
      { assignees: { some: { userId: session.userId } } },
    ];
  }

  try {
    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: { assignees: { select: { userId: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return ok({
      items,
      pagination: { page, pageSize, total },
    });
  } catch {
    return err("Unable to list tasks.", 500);
  }
}

// --- POST /api/tasks ------------------------------------------------------

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.TASK_CREATE);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  const parsed = await parseJson(request, CreateTaskSchema);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.data;

  try {
    // Cross-firm validation: clientId must belong to firm AND be ACTIVE.
    // 404 on firmId mismatch (does not leak existence); 422 on inactive
    // (existence already known to caller in this case).
    const client = await prisma.client.findUnique({
      where: { id: payload.clientId },
    });
    if (!client || client.firmId !== session.firmId) {
      console.warn("Cross-firm clientId attempt", {
        sessionFirmId: session.firmId,
        attemptedClientId: payload.clientId,
        route: "POST /api/tasks",
      });
      return err("Client not found.", 404);
    }
    if (client.status !== "ACTIVE") {
      return err("Client is not active.", 422);
    }

    // Cross-firm validation: reviewerId must be an active FirmMember of
    // the caller's firm.
    const reviewerMembership = await prisma.firmMember.findUnique({
      where: {
        firmId_userId: {
          firmId: session.firmId,
          userId: payload.reviewerId,
        },
      },
    });
    if (!reviewerMembership || !reviewerMembership.isActive) {
      console.warn("Cross-firm or inactive reviewerId attempt", {
        sessionFirmId: session.firmId,
        attemptedReviewerId: payload.reviewerId,
        route: "POST /api/tasks",
      });
      return err("Reviewer not found.", 404);
    }

    // Cross-firm validation: every assigneeId must be an active FirmMember
    // of the caller's firm.
    const assigneeMemberships = await prisma.firmMember.findMany({
      where: {
        firmId: session.firmId,
        userId: { in: payload.assigneeIds },
        isActive: true,
      },
      select: { userId: true },
    });
    const validAssigneeUserIds = new Set(
      assigneeMemberships.map((m) => m.userId),
    );
    const invalidAssignees = payload.assigneeIds.filter(
      (id) => !validAssigneeUserIds.has(id),
    );
    if (invalidAssignees.length > 0) {
      console.warn("Cross-firm or inactive assigneeId attempt", {
        sessionFirmId: session.firmId,
        attemptedAssigneeIds: invalidAssignees,
        route: "POST /api/tasks",
      });
      return err("One or more assignees not found.", 404);
    }

    // De-duplicate assigneeIds (set semantics; @@unique([taskId, userId])
    // on TaskAssignee would otherwise raise a unique-constraint error).
    const dedupedAssigneeIds = Array.from(new Set(payload.assigneeIds));

    const created = await prisma.task.create({
      data: {
        firmId: session.firmId,
        clientId: payload.clientId,
        title: payload.title,
        description: payload.description ?? null,
        status: payload.status ?? DEFAULT_TASK_STATUS,
        priority: payload.priority ?? DEFAULT_TASK_PRIORITY,
        dueDate: new Date(payload.dueDate),
        reviewerId: payload.reviewerId,
        createdById: session.userId,
        assignees: {
          create: dedupedAssigneeIds.map((userId) => ({ userId })),
        },
      },
      include: { assignees: { select: { userId: true } } },
    });

    // Deferred no-op per D-2026-04-30-15 Decision 4. Call site preserved
    // so Step 4 can light up the audit trail without route churn.
    await writeActivityLog({
      firmId: session.firmId,
      actorId: session.userId,
      entityType: "Task",
      entityId: created.id,
      action: "TASK_CREATE",
    });

    return ok(created, 201);
  } catch {
    return err("Unable to create task.", 500);
  }
}
