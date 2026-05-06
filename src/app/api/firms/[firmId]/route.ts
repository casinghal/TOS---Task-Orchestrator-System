// src/app/api/firms/[firmId]/route.ts
// PracticeIQ Section 14 Step 4D - Firm update route.
// PATCH /api/firms/[firmId] - update a Firm record.
//
// Auth model (4D-locked):
//   - requireAuth(Action.FIRM_UPDATE).
//   - FIRM_ADMIN of the same firm and PLATFORM_OWNER (via the existing
//     hasPermission() short-circuit) hold this action.
//   - URL `firmId` MUST equal session.firmId. Cross-firm hits (including
//     PLATFORM_OWNER not in that firm's active membership) return 404 to
//     hide cross-tenant existence; a console.warn records the attempt for
//     forensics per Section 25.4 #15.
//   - PLATFORM_OWNER cross-firm access is Step 4F impersonation scope,
//     not granted here.
//
// Status codes:
//   401 - unauthenticated
//   403 - authenticated, lacks Action.FIRM_UPDATE
//   400 - missing required fields, or no firm context for session
//   404 - cross-firm hit (hidden) or firm record not found
//   422 - invalid emailDomain
//   503 - DATABASE_URL not configured
//   500 - unexpected Prisma/runtime failure
//
// References: MASTER_PROJECT.md Section 14 Step 4D; Section 25.4 #15;
// CHANGE_LOG C-2026-05-06-XX.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { databaseUnavailable, err, requireAuth, writeActivityLog } from "@/lib/api-helpers";
import { Action } from "@/lib/permissions";
import { normalizeDomain, validateFirmDomain } from "@/lib/tenant-guard";

type UpdateFirmPayload = {
  name: string;
  city: string;
  plan: string;
  status: "Trial" | "Active" | "Paused";
  emailDomain?: string;
};

export async function PATCH(request: Request, context: { params: Promise<{ firmId: string }> }) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  // Auth gate: requires Action.FIRM_UPDATE (FIRM_ADMIN base array;
  // PLATFORM_OWNER short-circuit). Cross-firm tenant isolation is enforced
  // below after we know session.firmId.
  const auth = await requireAuth(request, Action.FIRM_UPDATE);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { firmId } = await context.params;

  if (!session.firmId) {
    return err("No firm context for this session.", 400);
  }

  // Cross-firm 404 + console.warn per Section 25.4 #15.
  // PLATFORM_OWNER without an active membership in [firmId] also lands here
  // because requireSession() resolves session.firmId from the unique active
  // FirmMember; cross-firm impersonation is Step 4F scope.
  if (firmId !== session.firmId) {
    console.warn(
      `Cross-firm hit prevented: session.firmId=${session.firmId} target.firmId=${firmId} route=PATCH /api/firms/[firmId]`,
    );
    return err("Firm not found.", 404);
  }

  try {
    const payload = await request.json() as UpdateFirmPayload;
    const name = payload.name?.trim();
    const city = payload.city?.trim();
    const plan = payload.plan?.trim();
    const emailDomain = normalizeDomain(payload.emailDomain ?? "");
    const status = payload.status ?? "Trial";

    if (!name || !city || !plan) {
      return NextResponse.json({ ok: false, message: "Firm name, city, and plan are required." }, { status: 400 });
    }

    const domainCheck = validateFirmDomain(emailDomain);
    if (!domainCheck.ok) {
      return NextResponse.json(domainCheck, { status: 422 });
    }

    const updated = await prisma.firm.update({
      where: { id: firmId },
      data: {
        name,
        city,
        status: status.toUpperCase(),
        emailDomain: emailDomain || null,
      },
    });

    // Audit emit (Step 4E follow-on; fail-open via writeActivityLog per
    // Step 4E). firmId = session.firmId (server-resolved; route already
    // enforced session.firmId === firmId above). metadataJson lists the
    // field NAMES this PATCH writes — no values, no raw body, no full
    // before/after snapshot. The four fields below match the prisma.firm.update
    // data block exactly; if that block changes, this list must too.
    await writeActivityLog({
      firmId: session.firmId,
      actorId: session.userId,
      entityType: "FIRM",
      entityId: updated.id,
      action: "FIRM_UPDATE",
      metadataJson: JSON.stringify({
        fields: ["name", "city", "status", "emailDomain"],
      }),
    });

    return NextResponse.json({
      ok: true,
      firm: {
        id: updated.id,
        name: updated.name,
        city: updated.city ?? city,
        plan,
        status,
        emailDomain: updated.emailDomain ?? "",
        onboardingCompleted: true,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to update firm." }, { status: 500 });
  }
}
