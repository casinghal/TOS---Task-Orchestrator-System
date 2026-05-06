// src/lib/cross-firm.ts
// PracticeIQ Section 14 Step 4F-1 - Cross-firm impersonation helper.
// Audited PLATFORM_OWNER cross-firm access per Section 25.6.
//
// Behaviour contract:
//   - If `candidateFirmId` is null/empty: fall back to `session.firmId`.
//     Return 400 if `session.firmId` is also missing (defense in depth;
//     `requireSession()` per 4B-2 already fails closed if no active FirmMember).
//   - If `candidateFirmId` matches `session.firmId`: same-firm path,
//     no impersonation, no audit.
//   - If `candidateFirmId` differs from `session.firmId`:
//       - Non-PLATFORM_OWNER → 404 (cross-firm hit hidden; matches the
//         project-wide cross-firm-leak prevention pattern).
//       - PLATFORM_OWNER → verify target Firm exists (404 if not), then
//         FAIL-CLOSED audit-first-then-grant. Write a CROSS_FIRM_IMPERSONATE
//         ActivityLog row inline (NOT via writeActivityLog() which is
//         fail-open per 4E). If the audit write fails, return 503 and DENY
//         access. Only after the audit row commits do we return a successful
//         resolution.
//
// Audit payload:
//   - firmId: TARGET firm (the audit's tenant scope)
//   - actorId: IMPERSONATOR's userId (server-resolved; the operator's actual identity)
//   - entityType: caller-supplied (route's entity type)
//   - entityId: caller-supplied (the specific entity id, if known)
//   - action: "CROSS_FIRM_IMPERSONATE"
//   - metadataJson: { impersonatorFirmId: session.firmId, route: routeLabel }
//
// Privacy guardrails (must hold at every call site):
//   - No raw request body, no headers, no cookies, no tokens, no passwords,
//     no secrets, no env vars, no IP, no user-agent, no full snapshots,
//     no emails / names / phone numbers, no arbitrary PII.
//   - Caller is responsible for the entityType/entityId/routeLabel values
//     they pass; this helper does not introspect the request.
//
// References: MASTER_PROJECT.md Section 14 Step 4F; Section 25.6;
// CHANGE_LOG C-2026-05-06-XX (this commit); D-2026-05-06-02.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, type ErrResponse } from "@/lib/api-helpers";
import { type SessionUser, PlatformRole } from "@/lib/permissions";

export type CrossFirmResolution =
  | { ok: true; effectiveFirmId: string; isImpersonation: boolean }
  | { ok: false; response: NextResponse<ErrResponse> };

export type CrossFirmContext = {
  request: Request;
  session: SessionUser;
  candidateFirmId: string | null;
  entityType: string;
  entityId?: string;
  routeLabel: string;
};

export async function resolveCrossFirmContext(
  ctx: CrossFirmContext,
): Promise<CrossFirmResolution> {
  const { session, candidateFirmId, entityType, entityId, routeLabel } = ctx;
  // `request` is accepted for API symmetry with requireAuth/requireSession;
  // not currently consumed inside the helper. Routes parse the impersonate
  // query parameter from `request` themselves and pass `candidateFirmId`.

  // Case 1: No candidate firm id supplied → use the operator's own firm.
  if (!candidateFirmId) {
    if (!session.firmId) {
      return {
        ok: false,
        response: err("No firm context for this session.", 400),
      };
    }
    return {
      ok: true,
      effectiveFirmId: session.firmId,
      isImpersonation: false,
    };
  }

  // Case 2: Candidate matches operator's own firm → same-firm, no audit.
  if (candidateFirmId === session.firmId) {
    return {
      ok: true,
      effectiveFirmId: candidateFirmId,
      isImpersonation: false,
    };
  }

  // Case 3: Cross-firm grant requested. Only PLATFORM_OWNER allowed.
  if (session.platformRole !== PlatformRole.PLATFORM_OWNER) {
    console.warn("Cross-firm hit prevented", {
      sessionFirmId: session.firmId,
      candidateFirmId,
      route: routeLabel,
      actorId: session.userId,
    });
    return { ok: false, response: err("Not found.", 404) };
  }

  // Verify target firm exists. We do not check Firm.status here (existence
  // only per the 4F-1 D4 decision); inactive-firm gating can layer on later
  // without changing this helper signature.
  const firm = await prisma.firm.findUnique({
    where: { id: candidateFirmId },
    select: { id: true },
  });
  if (!firm) {
    return { ok: false, response: err("Not found.", 404) };
  }

  // Audit-first-then-grant. FAIL-CLOSED for impersonation.
  // We deliberately do NOT use writeActivityLog() here (which is fail-open
  // per 4E for routine post-mutation audits). Cross-firm grants must record
  // a row before access is granted; if the row cannot be written, the
  // request fails with 503 and access is denied.
  try {
    await prisma.activityLog.create({
      data: {
        firmId: candidateFirmId,
        actorId: session.userId,
        entityType,
        entityId: entityId ?? null,
        action: "CROSS_FIRM_IMPERSONATE",
        metadataJson: JSON.stringify({
          impersonatorFirmId: session.firmId,
          route: routeLabel,
        }),
      },
    });
  } catch (e) {
    console.error("CROSS_FIRM_IMPERSONATE audit write failed; access denied", {
      candidateFirmId,
      actorId: session.userId,
      route: routeLabel,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      response: err(
        "Cross-firm audit write failed; access denied.",
        503,
      ),
    };
  }

  return {
    ok: true,
    effectiveFirmId: candidateFirmId,
    isImpersonation: true,
  };
}
