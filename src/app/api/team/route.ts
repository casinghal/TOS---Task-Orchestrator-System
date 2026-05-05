// src/app/api/team/route.ts
// PracticeIQ Section 14 Step 3E-1 - Team routes (collection).
// GET /api/team - paginated, filterable list of FirmMembers scoped to caller's firm.
//
// Auth-gated via requireAuth() and therefore returns 401 in Step 3E-1 until
// Step 4 wires real Supabase Auth into requireSession().
//
// Tenant isolation: every query includes where: { firmId: session.firmId }.
// PLATFORM_OWNER without a firm context returns 400 - no all-firm escape
// hatch in 3E-1.
//
// Response shape (per approved 3E-1 plan, Decision A1):
//   firmMemberId, userId, name, email, firmRole, isActive, joinedAt
// Excluded: passwordHash, platformRole, PlatformUser.isActive, lastLoginAt, firmId.
//
// Query filters:
//   page, pageSize (capped at MAX_TEAM_PAGE_SIZE), firmRole, status, q (name-only)
//
// Decision references:
//   A1: ARTICLE_STAFF sees full firm team list including email
//   B1: inactive hidden by default; ?status=active|inactive|all
//   C1: q search is name-only (no email search) for 3E-1; case-insensitive
//
// References: MASTER_PROJECT.md Section 14 Step 3E; Section 23.4 (inactive
// user handling); Section 25 (route construction security); CHANGE_LOG
// C-2026-05-05-02; DECISION_LOG D-2026-05-05-02.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  databaseUnavailable,
  err,
  ok,
  requireAuth,
} from "@/lib/api-helpers";
import { Action } from "@/lib/permissions";
import {
  DEFAULT_TEAM_PAGE_SIZE,
  DEFAULT_TEAM_STATUS_FILTER,
  FIRM_ROLES,
  MAX_TEAM_PAGE_SIZE,
  TEAM_STATUS_FILTERS,
} from "@/lib/team-constants";

// --- Validation -----------------------------------------------------------

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_TEAM_PAGE_SIZE).optional(),
  firmRole: z.enum(FIRM_ROLES).optional(),
  status: z.enum(TEAM_STATUS_FILTERS).optional(),
  q: z.string().trim().min(1).optional(),
});

// --- Response shape -------------------------------------------------------

type FirmMemberResponse = {
  firmMemberId: string;
  userId: string;
  name: string;
  email: string;
  firmRole: string;
  isActive: boolean;
  joinedAt: Date;
};

type FirmMemberWithUser = {
  id: string;
  userId: string;
  firmRole: string;
  isActive: boolean;
  joinedAt: Date;
  user: { name: string; email: string };
};

function toResponse(member: FirmMemberWithUser): FirmMemberResponse {
  return {
    firmMemberId: member.id,
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    firmRole: member.firmRole,
    isActive: member.isActive,
    joinedAt: member.joinedAt,
  };
}

// --- GET /api/team --------------------------------------------------------

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.TEAM_VIEW);
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

  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? DEFAULT_TEAM_PAGE_SIZE;
  const status = q.status ?? DEFAULT_TEAM_STATUS_FILTER;

  // Build the where clause. firmId is non-negotiable.
  const where: {
    firmId: string;
    firmRole?: string;
    isActive?: boolean;
    user?: { name: { contains: string; mode: "insensitive" } };
  } = { firmId: session.firmId };

  if (q.firmRole) where.firmRole = q.firmRole;

  // Decision B1: status filter resolves to isActive boolean (or absent for "all").
  if (status === "active") where.isActive = true;
  else if (status === "inactive") where.isActive = false;
  // status === "all": no isActive filter

  // Decision C1: q search is name-only for 3E-1. Email search deferred.
  // Case-insensitive substring match via Prisma's `contains` + insensitive mode.
  if (q.q) {
    where.user = { name: { contains: q.q, mode: "insensitive" } };
  }

  try {
    const [items, total] = await Promise.all([
      prisma.firmMember.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { joinedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.firmMember.count({ where }),
    ]);

    return ok({
      items: items.map(toResponse),
      pagination: { page, pageSize, total },
    });
  } catch {
    return err("Unable to list team.", 500);
  }
}
