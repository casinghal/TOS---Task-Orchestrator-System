// src/app/api/team/[id]/route.ts
// PracticeIQ Section 14 Step 3E-1 - Team single-item route.
// GET /api/team/[id] - read one FirmMember; 404 if missing or cross-firm.
//
// [id] is FirmMember.id, NOT PlatformUser.id. Keeps URLs scoped to the
// firm × user join row and lines up cleanly with 3E-2 mutation routes
// (PATCH / deactivate / reactivate will use the same key).
//
// Auth-gated via requireAuth() - returns 401 in Step 3E-1 until Step 4 wires
// real Supabase Auth into requireSession().
//
// Cross-firm hits return 404 (no existence leak per Section 25.4 #4) plus a
// server-side console.warn for forensics (Section 25.4 #15), mirroring the
// 3D pattern.
//
// Response shape mirrors GET /api/team list items (single member shape).
//
// References: MASTER_PROJECT.md Section 14 Step 3E; Section 25 (security);
// CHANGE_LOG C-2026-05-05-02; DECISION_LOG D-2026-05-05-02.

import { prisma } from "@/lib/prisma";
import {
  databaseUnavailable,
  err,
  ok,
  requireAuth,
} from "@/lib/api-helpers";
import { Action } from "@/lib/permissions";

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
