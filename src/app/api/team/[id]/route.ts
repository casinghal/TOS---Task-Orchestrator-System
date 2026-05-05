// src/app/api/team/[id]/route.ts
// PracticeIQ Section 14 Step 3E - Team single-item routes.
// GET   /api/team/[id]  - read one FirmMember (3E-1).
// PATCH /api/team/[id]  - update name and/or firmRole (3E-2A); two-model
//                         transaction; self-role-change rejected;
//                         last-active-FIRM_ADMIN downgrade rejected.
//
// [id] is FirmMember.id, NOT PlatformUser.id. Keeps URLs scoped to the
// firm × user join row and lines up cleanly with 3E-2B mutations
// (deactivate / reactivate use the same key).
//
// Auth-gated via requireAuth() - returns 401 in Step 3 until Step 4 wires
// real Supabase Auth into requireSession().
//
// PATCH permission flow (corrected pattern from D-2026-05-04-02):
//   1. requireAuth(Action.TEAM_VIEW) is the FIRST gate but ONLY establishes
//      authenticated route entry. It does NOT authorize mutation.
//   2. After body parse and target lookup, requirePermission(Action.TEAM_MANAGE)
//      enforces FIRM_ADMIN-only mutation authority.
//   3. PARTNER / MANAGER / ARTICLE_STAFF have TEAM_VIEW and pass step 1
//      (so they get a coherent 404 on cross-firm targets) but are rejected
//      with 403 at step 2.
//
// Cross-firm hits return 404 (no existence leak per Section 25.4 #4) plus a
// server-side console.warn for forensics (Section 25.4 #15).
//
// Response shape mirrors GET /api/team list items (single member shape).
//
// 3E-2A PATCH decisions consumed:
//   D1: role change goes through PATCH body, no /role endpoint
//   F1 (role variant): self-role-change rejected with 422
//   G1 (role variant): last-active-FIRM_ADMIN downgrade rejected with 422
//   H1 (Team taxonomy): TEAM_MEMBER_UPDATE for name; TEAM_MEMBER_ROLE_CHANGE for role
//
// PATCH does NOT accept: email, isActive, passwordHash, platformRole,
// userId, firmId, joinedAt, or any unknown field. Zod `.strict()` rejects
// all of these with 422.
//
// References: MASTER_PROJECT.md Section 14 Step 3E; Section 25 (security);
// CHANGE_LOG C-2026-05-05-05; DECISION_LOG D-2026-05-05-05.

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
import { Action, requirePermission } from "@/lib/permissions";
import {
  FIRM_ROLES,
  MAX_TEAM_NAME_LENGTH,
} from "@/lib/team-constants";

// --- Validation -----------------------------------------------------------

const UpdateTeamMemberSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_TEAM_NAME_LENGTH).optional(),
    firmRole: z.enum(FIRM_ROLES).optional(),
  })
  .strict()
  .refine(
    (d) => d.name !== undefined || d.firmRole !== undefined,
    { message: "At least one field is required." },
  );

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

// --- GET /api/team/[id] ---------------------------------------------------

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const auth = await requireAuth(request, Action.TEAM_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  const { id } = await context.params;

  try {
    const member = await prisma.firmMember.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!member || member.firmId !== session.firmId) {
      if (member && member.firmId !== session.firmId) {
        console.warn("Cross-firm team read attempt", {
          sessionFirmId: session.firmId,
          attemptedMemberId: id,
          route: "GET /api/team/[id]",
        });
      }
      return err("Team member not found.", 404);
    }

    return ok(toResponse(member));
  } catch {
    return err("Unable to read team member.", 500);
  }
}

// --- PATCH /api/team/[id] -------------------------------------------------
//
// FIRST GATE NOTE: requireAuth(Action.TEAM_VIEW) below is for AUTHENTICATED
// ROUTE ENTRY ONLY (corrected pattern from D-2026-05-04-02). Mutation
// authorization happens via requirePermission(Action.TEAM_MANAGE) further
// down once the target FirmMember has been loaded.

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  // Auth-entry gate. NOT mutation authorization.
  const auth = await requireAuth(request, Action.TEAM_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }
  const firmId = session.firmId;

  const { id } = await context.params;

  const parsed = await parseJson(request, UpdateTeamMemberSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const member = await prisma.firmMember.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!member || member.firmId !== firmId) {
      if (member && member.firmId !== firmId) {
        console.warn("Cross-firm team PATCH attempt", {
          sessionFirmId: firmId,
          attemptedFirmMemberId: id,
          actorId: session.userId,
          route: "PATCH /api/team/[id]",
        });
      }
      return err("Team member not found.", 404);
    }

    // Mutation authorization: TEAM_MANAGE (FIRM_ADMIN-only by current matrix).
    // PARTNER / MANAGER / ARTICLE_STAFF are rejected here even though they
    // passed the TEAM_VIEW auth-entry gate.
    const permCheck = requirePermission(session, Action.TEAM_MANAGE);
    if (!permCheck.ok) return err(permCheck.message, permCheck.status);

    // Self-role-change protection (F1 role variant).
    if (
      body.firmRole !== undefined &&
      member.userId === session.userId &&
      body.firmRole !== member.firmRole
    ) {
      return err("Cannot change your own role.", 422);
    }

    // Last-active-FIRM_ADMIN protection (G1 role variant).
    // Only fires on actual demotion (FIRM_ADMIN -> non-FIRM_ADMIN). Counts
    // active FIRM_ADMINs in the firm; if <= 1, the demotion would leave
    // the firm with zero active FIRM_ADMINs.
    if (
      body.firmRole !== undefined &&
      member.firmRole === "FIRM_ADMIN" &&
      body.firmRole !== "FIRM_ADMIN"
    ) {
      const adminCount = await prisma.firmMember.count({
        where: {
          firmId,
          firmRole: "FIRM_ADMIN",
          isActive: true,
        },
      });
      if (adminCount <= 1) {
        return err("Cannot demote the last active firm admin.", 422);
      }
    }

    // Capture pre-update state for ActivityLog metadata + idempotency check.
    const oldRole = member.firmRole;
    const oldName = member.user.name;
    const nameChanged =
      body.name !== undefined && body.name !== oldName;
    const roleChanged =
      body.firmRole !== undefined && body.firmRole !== oldRole;

    // Two-model transaction: name updates PlatformUser; firmRole updates
    // FirmMember. Either or both may run depending on what's in the body
    // AND whether the requested values actually differ from current state.
    // Idempotent: if body.name === oldName (or body.firmRole === oldRole),
    // skip that write. ActivityLog only fires on real changes.
    const updated = await prisma.$transaction(async (tx) => {
      if (nameChanged) {
        await tx.platformUser.update({
          where: { id: member.userId },
          data: { name: body.name as string },
        });
      }
      if (roleChanged) {
        await tx.firmMember.update({
          where: { id },
          data: { firmRole: body.firmRole as string },
        });
      }
      return tx.firmMember.findUnique({
        where: { id },
        include: { user: { select: { name: true, email: true } } },
      });
    });

    if (!updated) {
      // Defensive: should not happen because we just confirmed the member
      // exists. Guard against an upstream race that deleted the row
      // between lookup and update.
      return err("Team member not found.", 404);
    }

    // ActivityLog calls (deferred no-op until Step 4). Multi-event allowed
    // per Section 23.6 pattern: TEAM_MEMBER_UPDATE for name; TEAM_MEMBER_ROLE_CHANGE
    // for role. Both fire if both changed; neither fires if the PATCH was
    // a no-op (idempotent same-value request).
    if (nameChanged) {
      await writeActivityLog({
        firmId,
        actorId: session.userId,
        entityType: "FirmMember",
        entityId: id,
        action: "TEAM_MEMBER_UPDATE",
        metadataJson: JSON.stringify({ fields: ["name"] }),
      });
    }
    if (roleChanged) {
      await writeActivityLog({
        firmId,
        actorId: session.userId,
        entityType: "FirmMember",
        entityId: id,
        action: "TEAM_MEMBER_ROLE_CHANGE",
        metadataJson: JSON.stringify({
          oldRole,
          newRole: body.firmRole,
        }),
      });
    }

    return ok(toResponse(updated));
  } catch {
    return err("Unable to update team member.", 500);
  }
}
