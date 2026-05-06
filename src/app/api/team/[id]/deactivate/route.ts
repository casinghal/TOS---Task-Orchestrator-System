// src/app/api/team/[id]/deactivate/route.ts
// PracticeIQ Section 14 Step 3E-2B - Team deactivate action.
// POST /api/team/[id]/deactivate - move active FirmMember -> isActive=false.
// Reason required. Cannot deactivate self. Cannot deactivate the last
// active FIRM_ADMIN of a firm. Already-inactive returns 422.
//
// Touches FirmMember.isActive only. NEVER touches PlatformUser.isActive
// (per Decision 3E-2-M1: a deactivated firm member may remain an active
// platform identity for use in other firms in Stage 1+; firm-scoped
// deactivation is the operational mental model). No task reassignment;
// existing assignments survive per Section 23.4. No deletion.
//
// FIRST GATE NOTE: requireAuth(Action.TEAM_VIEW) below is for AUTHENTICATED
// ROUTE ENTRY ONLY (corrected pattern from D-2026-05-04-02). Mutation
// authorization happens via requirePermission(Action.TEAM_MANAGE) further
// down once the target FirmMember has been loaded.
//
// Cross-firm hits return 404 (no existence leak per Section 25.4 #4) plus
// a server-side console.warn for forensics (Section 25.4 #15).
//
// Response shape mirrors GET /api/team list items (single member shape).
//
// 3E-2B deactivate decisions consumed:
//   F1 (deactivate variant): self-deactivation rejected with 422
//   G1 (deactivate variant): last-active-FIRM_ADMIN deactivation rejected with 422
//   H1 (Team taxonomy): TEAM_MEMBER_DEACTIVATE action string
//   3E-2-M1: deactivate touches FirmMember.isActive only; never PlatformUser.isActive
//   3E-2-N1: already-inactive returns 422
//   3E-2B-P (post-ChatGPT review): reason field is REQUIRED (not optional)
//
// References: MASTER_PROJECT.md Section 14 Step 3E; Section 23.4 (inactive
// user handling); Section 25 (security); CHANGE_LOG C-2026-05-05-07;
// DECISION_LOG D-2026-05-05-06.

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
import { Action, requirePermission } from "@/lib/permissions";
import { MAX_TEAM_NOTE_LENGTH } from "@/lib/team-constants";

// --- Validation -----------------------------------------------------------

const DeactivateMemberSchema = z
  .object({
    reason: z.string().trim().min(1).max(MAX_TEAM_NOTE_LENGTH),
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

// --- POST /api/team/[id]/deactivate ---------------------------------------

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  // Auth-entry gate. NOT mutation authorization.
  const auth = await requireAuth(request, Action.TEAM_VIEW);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await context.params;

  // Step 4F-2: cross-firm impersonation. `firmId` below is the effective
  // firm scope (target under impersonation, own firm otherwise).
  const url = new URL(request.url);
  const impersonateFirmId = url.searchParams.get("impersonateFirmId");
  const ctx = await resolveCrossFirmContext({
    request,
    session,
    candidateFirmId: impersonateFirmId,
    entityType: "FirmMember",
    entityId: id,
    routeLabel: "POST /api/team/[id]/deactivate",
  });
  if (!ctx.ok) return ctx.response;
  const firmId = ctx.effectiveFirmId;

  const parsed = await parseJson(request, DeactivateMemberSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const member = await prisma.firmMember.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!member) {
      return err("Team member not found.", 404);
    }
    if (member.firmId !== firmId) {
      console.warn("Cross-firm team deactivate attempt", {
        effectiveFirmId: firmId,
        attemptedFirmMemberId: id,
        actorId: session.userId,
        route: "POST /api/team/[id]/deactivate",
      });
      return err("Team member not found.", 404);
    }

    // Mutation authorization: TEAM_MANAGE (FIRM_ADMIN-only by current matrix).
    // PARTNER / MANAGER / ARTICLE_STAFF are rejected here even though they
    // passed the TEAM_VIEW auth-entry gate.
    const permCheck = requirePermission(session, Action.TEAM_MANAGE);
    if (!permCheck.ok) return err(permCheck.message, permCheck.status);

    // Self-deactivation protection (F1 deactivate variant). Prevents
    // accidental lockout: the deactivating actor cannot remove their own
    // active access in a single request.
    if (member.userId === session.userId) {
      return err("Cannot deactivate yourself.", 422);
    }

    // Last-active-FIRM_ADMIN protection (G1 deactivate variant). Only
    // fires when the target is an active FIRM_ADMIN; deactivating an
    // already-inactive FIRM_ADMIN cannot reduce the active-admin count.
    // Prevents accidental firm-lockout (firm with zero active admins).
    if (member.firmRole === "FIRM_ADMIN" && member.isActive) {
      const adminCount = await prisma.firmMember.count({
        where: {
          firmId,
          firmRole: "FIRM_ADMIN",
          isActive: true,
        },
      });
      if (adminCount <= 1) {
        return err("Cannot deactivate the last active firm admin.", 422);
      }
    }

    // State precondition (3E-2-N1). Already-inactive returns 422 — no-op
    // is rejected explicitly so the audit trail captures every state
    // transition cleanly, mirroring the cancel-already-cancelled pattern
    // from 3D-3.
    if (!member.isActive) {
      return err("Member is already inactive.", 422);
    }

    // Apply mutation. Touches FirmMember.isActive ONLY per Decision 3E-2-M1.
    // PlatformUser.isActive remains untouched. No task reassignment per
    // Section 23.4 (existing assignments survive). No deletion.
    const updated = await prisma.firmMember.update({
      where: { id },
      data: { isActive: false },
      include: { user: { select: { name: true, email: true } } },
    });

    // ActivityLog (deferred no-op until Step 4). Per Section 23.4 + Decision H1
    // taxonomy: TEAM_MEMBER_DEACTIVATE with `{ reason }` metadata. Reason is
    // always populated (REQUIRED on 3E-2B per Decision 3E-2B-P).
    await writeActivityLog({
      firmId,
      actorId: session.userId,
      entityType: "FirmMember",
      entityId: id,
      action: "TEAM_MEMBER_DEACTIVATE",
      metadataJson: JSON.stringify({ reason: body.reason }),
    });

    return ok(toResponse(updated));
  } catch {
    return err("Unable to deactivate team member.", 500);
  }
}
