// src/app/api/team/[id]/password-reset/route.ts
// PracticeIQ Section 14 Step 5B-3c-1 - Team password reset (BACKEND only).
// POST /api/team/[id]/password-reset - trigger a Supabase email-based
// password recovery for a target FirmMember's underlying PlatformUser.
//
// Option A only (Decision 5B-3c): supabase.auth.resetPasswordForEmail.
// NO service-role key. NO privileged admin auth APIs. NO admin-set
// temporary password.
// The recovery email links back to /auth/reset-password where the user
// sets a new password via supabase.auth.updateUser.
//
// Team UI stays disabled in this wave: TEAM_PASSWORD_RESET_ENABLED remains
// false; only this backend route + the recovery page ship. UI cutover is
// Step 5B-3c-2.
//
// Authorization mirrors the existing 3E-2B team mutations:
//   1. requireAuth(Action.TEAM_VIEW) - authenticated ROUTE ENTRY only.
//   2. requirePermission(session, Action.TEAM_MANAGE) after target lookup -
//      FIRM_ADMIN-only by the firm-role matrix; PLATFORM_OWNER passes via
//      the hasPermission() short-circuit. PARTNER / MANAGER / ARTICLE_STAFF
//      are rejected 403.
//
// Guards (password-reset specific):
//   - self-reset rejected 403 (admin resets own password via normal flow)
//   - PLATFORM_OWNER target rejected 403 (managed separately)
//   - inactive target rejected 422
//   - cross-firm target returns 404 + console.warn (Section 25.4 #4/#15)
//
// Audit: the ActivityLog action records the reset trigger. Metadata carries
// reason, method, targetFirmMemberId, and a DOMAIN-ONLY target email. Never
// the local-part, reset URL, recovery token, or password (5B-3c-1 audit
// rules + Section 25).
//
// References: MASTER_PROJECT.md Section 14 Step 5B-3c; existing 3E-2B routes
// (deactivate / reactivate / PATCH) for the auth + cross-firm pattern.

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
import { createSupabaseServerClient } from "@/lib/supabase-server";

// --- Validation -----------------------------------------------------------

const PasswordResetSchema = z
  .object({
    reason: z.string().trim().min(1, "Reason is required."),
  })
  .strict();

// --- POST /api/team/[id]/password-reset -----------------------------------
//
// FIRST GATE NOTE: requireAuth(Action.TEAM_VIEW) is for AUTHENTICATED ROUTE
// ENTRY ONLY (corrected pattern from D-2026-05-04-02). Mutation
// authorization happens via requirePermission(Action.TEAM_MANAGE) after the
// target FirmMember is loaded - identical to deactivate / reactivate / PATCH.

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
    routeLabel: "POST /api/team/[id]/password-reset",
  });
  if (!ctx.ok) return ctx.response;
  const firmId = ctx.effectiveFirmId;

  const parsed = await parseJson(request, PasswordResetSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const member = await prisma.firmMember.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, platformRole: true } },
      },
    });

    if (!member) {
      return err("Team member not found.", 404);
    }
    if (member.firmId !== firmId) {
      console.warn("Cross-firm team password-reset attempt", {
        effectiveFirmId: firmId,
        attemptedFirmMemberId: id,
        actorId: session.userId,
        route: "POST /api/team/[id]/password-reset",
      });
      return err("Team member not found.", 404);
    }

    // Mutation authorization: TEAM_MANAGE (FIRM_ADMIN-only by matrix;
    // PLATFORM_OWNER via the hasPermission() short-circuit). PARTNER /
    // MANAGER / ARTICLE_STAFF are rejected here even though they passed the
    // TEAM_VIEW auth-entry gate.
    const permCheck = requirePermission(session, Action.TEAM_MANAGE);
    if (!permCheck.ok) return err(permCheck.message, permCheck.status);

    // Self-reset guard. The team panel resets OTHER members' passwords; an
    // admin resets their own via the normal sign-in / forgot flow. Fires
    // before any Supabase Auth call.
    if (member.userId === session.userId) {
      return err("Cannot reset your own password from the team panel.", 403);
    }

    // Platform Owner target guard. PLATFORM_OWNER credentials are managed
    // outside the firm team panel.
    if (member.user.platformRole === "PLATFORM_OWNER") {
      return err("Platform Owner passwords are managed separately.", 403);
    }

    // Inactive target guard. Do not trigger recovery for a deactivated member.
    if (!member.isActive) {
      return err("Cannot reset password for an inactive team member.", 422);
    }

    // Resolve target email + DOMAIN-ONLY audit reference (no local-part).
    const targetEmail = member.user.email;
    const targetEmailDomain = targetEmail.includes("@")
      ? "@" + targetEmail.split("@")[1]
      : null;

    // Redirect target for the Supabase recovery link.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const redirectTo = `${appUrl}/auth/reset-password`;

    // Option A recovery. Anon-key server client only; no service-role and
    // no privileged admin auth APIs. The recovery send does not reveal
    // whether the address exists, which is the intended behaviour.
    const supabase = await createSupabaseServerClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      targetEmail,
      { redirectTo },
    );
    if (resetError) {
      // Server-side forensic log only; do not surface Supabase internals to
      // the caller. No email local-part, token, or reset URL.
      console.error("Team password-reset recovery send failed", {
        firmId,
        actorId: session.userId,
        targetFirmMemberId: member.id,
        error: resetError.message,
      });
      return err(
        "Password reset service temporarily unavailable. Please retry shortly.",
        503,
      );
    }

    // ActivityLog after the recovery email is dispatched. Metadata is
    // DOMAIN-ONLY for the email; never the local-part, reset URL, token, or
    // password. writeActivityLog is fail-open per the established pattern.
    await writeActivityLog({
      firmId,
      actorId: session.userId,
      entityType: "FirmMember",
      entityId: member.id,
      action: "TEAM_MEMBER_PASSWORD_RESET",
      metadataJson: JSON.stringify({
        reason: body.reason,
        method: "email_link",
        targetFirmMemberId: member.id,
        targetEmailDomain,
      }),
    });

    return ok({ sent: true });
  } catch {
    return err("Unable to reset team member password.", 500);
  }
}
