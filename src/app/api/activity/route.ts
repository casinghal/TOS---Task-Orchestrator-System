// src/app/api/activity/route.ts
// PracticeIQ Section 14 Step 3C - Activity read route.
// GET /api/activity - paginated, filtered list of ActivityLog entries
// scoped to the caller's firm.
//
// Read-only by design: no POST/PATCH/DELETE. ActivityLog writes remain
// the deferred no-op via writeActivityLog() until Step 4 supplies a real
// actorId (per D-2026-04-30-15 Decision 4). This route does not change
// that contract.
//
// Auth: requireAuth() returns 401 in Step 3 because requireSession()
// returns null. When Step 4 wires real Supabase Auth, this route lights
// up with no further code change.
//
// Tenant isolation: every query requires session.firmId; every query
// includes where: { firmId: session.firmId }. Platform Owner without a
// firm context returns 400. Cross-firm read access for Platform Owner
// is deferred to Step 4 with auditing - this route grants no exception.
//
// ARTICLE_STAFF scope: server-side enforces actorId === session.userId,
// regardless of any client-supplied actorId. Other firm roles see
// firm-wide activity within the tenant.
//
// References: MASTER_PROJECT.md Section 14 Step 3C; CHANGE_LOG.md
// C-2026-05-03-01.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  databaseUnavailable,
  err,
  ok,
  requireAuth,
} from "@/lib/api-helpers";
import { Action, FirmRole } from "@/lib/permissions";

// --- Validation -----------------------------------------------------------

const PAGE_DEFAULT = 1;
const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

// ISO 8601 datetime check. Accepts anything Date.parse can interpret.
// Stricter formats (e.g. RFC 3339 only) can be enforced later if the UI
// settles on one input shape.
const isoDatetime = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Must be a valid ISO 8601 datetime.",
  });

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).optional(),
  entityType: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  from: isoDatetime.optional(),
  to: isoDatetime.optional(),
});

// --- GET /api/activity ----------------------------------------------------

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.ACTIVITY_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  // Same tenant contract as 3B clients route. No all-firm escape hatch
  // for PLATFORM_OWNER here; cross-firm activity reads land in Step 4
  // with audited impersonation.
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

  const page = q.page ?? PAGE_DEFAULT;
  const pageSize = q.pageSize ?? PAGE_SIZE_DEFAULT;

  // Build the where clause. firmId is non-negotiable.
  const where: {
    firmId: string;
    actorId?: string;
    entityType?: string;
    action?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { firmId: session.firmId };

  // ARTICLE_STAFF: server-enforced own-actor scope. Any client-supplied
  // actorId is ignored - identity comes from the session and is written
  // here unconditionally. This must remain server-side only per the
  // Step 3C plan.
  if (session.firmRole === FirmRole.ARTICLE_STAFF) {
    where.actorId = session.userId;
  }

  if (q.entityType) where.entityType = q.entityType;
  if (q.action) where.action = q.action;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = new Date(q.from);
    if (q.to) where.createdAt.lte = new Date(q.to);
  }

  try {
    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return ok({
      items,
      pagination: { page, pageSize, total },
    });
  } catch {
    return err("Unable to list activity.", 500);
  }
}
