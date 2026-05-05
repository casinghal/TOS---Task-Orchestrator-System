// src/app/api/team/route.ts
// PracticeIQ Section 14 Step 3E - Team routes (collection).
// GET  /api/team  - paginated, filterable list of FirmMembers scoped to caller's firm (3E-1).
// POST /api/team  - add a new firm member (3E-2A): creates PlatformUser
//                   when email is new, plus FirmMember; transactional;
//                   no silent cross-firm linking.
//
// Auth-gated via requireAuth() and therefore returns 401 in Step 3 until
// Step 4 wires real Supabase Auth into requireSession().
//
// Tenant isolation: every read filters by firmId; POST creates with
// firmId = session.firmId. PLATFORM_OWNER without a firm context returns
// 400 - no all-firm escape hatch.
//
// Response shape (per Decision A1):
//   firmMemberId, userId, name, email, firmRole, isActive, joinedAt
// Excluded: passwordHash, platformRole, PlatformUser.isActive, lastLoginAt, firmId.
//
// 3E-1 GET decisions consumed:
//   A1: ARTICLE_STAFF sees full firm team list including email
//   B1: inactive hidden by default; ?status=active|inactive|all
//   C1: q search is name-only (no email search) for 3E-1; case-insensitive
//
// 3E-2A POST decisions consumed:
//   A1: POST creates PlatformUser + FirmMember in transaction; new email only
//   A-CORRECTION: cross-firm existing PlatformUser returns 422; no silent linking
//   I1: PlatformUser.email globally unique (schema-enforced)
//   I1-NORMALIZE: email trim + lowercase before any DB lookup or store
//   J1: placeholder passwordHash sentinel-prefixed + crypto random
//   K1: defer allowed-domain enforcement to Step 4
//   3E-2-O1: new PlatformUser always platformRole = "STANDARD"
//   D-3E-DUPLICATE-422: Prisma P2002 unique conflict mapped to 422 (race backstop)
//
// References: MASTER_PROJECT.md Section 14 Step 3E; Section 23.4 (inactive
// user handling); Section 25 (route construction security); CHANGE_LOG
// C-2026-05-05-05; DECISION_LOG D-2026-05-05-05.

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  databaseUnavailable,
  err,
  ok,
  parseJson,
  requireAuth,
  writeActivityLog,
} from "@/lib/api-helpers";
import { Action } from "@/lib/permissions";
import {
  DEFAULT_TEAM_PAGE_SIZE,
  DEFAULT_TEAM_STATUS_FILTER,
  FIRM_ROLES,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAM_PAGE_SIZE,
  TEAM_STATUS_FILTERS,
  generatePlaceholderPasswordHash,
} from "@/lib/team-constants";

// --- Validation -----------------------------------------------------------

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_TEAM_PAGE_SIZE).optional(),
  firmRole: z.enum(FIRM_ROLES).optional(),
  status: z.enum(TEAM_STATUS_FILTERS).optional(),
  q: z.string().trim().min(1).optional(),
});

const AddTeamMemberSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_TEAM_NAME_LENGTH),
    email: z.string().trim().email(),
    firmRole: z.enum(FIRM_ROLES),
  })
  .strict();

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

// --- POST /api/team -------------------------------------------------------
//
// 3E-2A wave. Creates a new firm member.
//
// Three-branch resolution (per Decision A1 + A-CORRECTION):
//   Branch A (email new): create PlatformUser + FirmMember in transaction.
//   Branch B (email exists in this firm): 422 duplicate.
//   Branch C (email exists in another firm only): 422 generic; no silent
//     linking; console.warn for forensics. Multi-firm membership deferred
//     to Step 4 / Stage 1 unless explicitly approved.
//
// Email is normalized (trim + lowercase) before any DB lookup or store
// per Decision I1-NORMALIZE.

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.TEAM_MANAGE);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }
  const firmId = session.firmId;

  const parsed = await parseJson(request, AddTeamMemberSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Normalize email (Decision I1-NORMALIZE). Zod already trimmed; lowercase
  // here so the same form is used for lookup and store.
  const normalizedEmail = body.email.toLowerCase();

  try {
    // Pre-lookup: detect collision before any insert.
    const existingUser = await prisma.platformUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // Branch B or C: existing PlatformUser. Check whether a FirmMember
      // already exists for (this firm, this user).
      const existingMembership = await prisma.firmMember.findUnique({
        where: {
          firmId_userId: {
            firmId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMembership) {
        // Branch B: same-firm duplicate. Normal user error; no console.warn.
        return err(
          "A team member with this email already exists in your firm.",
          422,
        );
      }

      // Branch C: cross-firm existing PlatformUser. 422 generic; no silent
      // linking; console.warn for forensic visibility. Per the 3E-2A
      // ChatGPT-review correction, multi-firm membership is deferred to
      // Step 4 / Stage 1; do NOT create a FirmMember here. Do NOT reveal
      // the other firm's identity in the response.
      console.warn("Cross-firm PlatformUser collision rejected", {
        sessionFirmId: firmId,
        attemptedEmail: normalizedEmail,
        actorId: session.userId,
        route: "POST /api/team",
      });
      return err(
        "This email is already registered. Multi-firm membership is deferred.",
        422,
      );
    }

    // Branch A: email is new. Create PlatformUser + FirmMember in one
    // transaction. New PlatformUser gets a sentinel-prefixed placeholder
    // passwordHash (Decision J1) and platformRole = "STANDARD" (Decision
    // 3E-2-O1).
    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.platformUser.create({
        data: {
          name: body.name,
          email: normalizedEmail,
          passwordHash: generatePlaceholderPasswordHash(),
          platformRole: "STANDARD",
          isActive: true,
        },
      });
      const newMember = await tx.firmMember.create({
        data: {
          firmId,
          userId: newUser.id,
          firmRole: body.firmRole,
          isActive: true,
        },
        include: { user: { select: { name: true, email: true } } },
      });
      return newMember;
    });

    // ActivityLog (deferred no-op until Step 4). Per Section 23.6 Team
    // taxonomy: TEAM_MEMBER_ADD with { userId, firmRole } metadata.
    await writeActivityLog({
      firmId,
      actorId: session.userId,
      entityType: "FirmMember",
      entityId: created.id,
      action: "TEAM_MEMBER_ADD",
      metadataJson: JSON.stringify({
        userId: created.userId,
        firmRole: created.firmRole,
      }),
    });

    return ok(toResponse(created), 201);
  } catch (e) {
    // Race-condition backstop (Decision D-3E-DUPLICATE-422): if two
    // simultaneous POSTs slip past the pre-lookup and the second insert
    // violates PlatformUser.email @unique, Prisma throws P2002. Map to
    // 422 with the same generic cross-firm message - the second caller
    // sees the same outcome they would have seen had they arrived after
    // the first POST committed.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return err(
        "This email is already registered. Multi-firm membership is deferred.",
        422,
      );
    }
    return err("Unable to add team member.", 500);
  }
}
