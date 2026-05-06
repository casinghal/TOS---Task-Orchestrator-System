// src/app/api/firms/route.ts
// PracticeIQ Section 14 Step 4D - Firm creation route.
// POST /api/firms - create a Firm record.
//
// Auth model (4D-locked):
//   - Authentication required (real Supabase session via requireSession()).
//   - Authorization: PLATFORM_OWNER only at Stage 0. Inline platformRole
//     check rather than a new Action.FIRM_CREATE; the matrix gains nothing
//     from a code that only PLATFORM_OWNER ever holds via its short-circuit.
//   - No Action.FIRM_CREATE is introduced.
//
// Status codes:
//   401 - unauthenticated
//   403 - authenticated non-PLATFORM_OWNER
//   400 - missing required fields
//   422 - invalid emailDomain
//   503 - DATABASE_URL not configured
//   500 - unexpected Prisma/runtime failure
//
// References: MASTER_PROJECT.md Section 14 Step 4D; CHANGE_LOG C-2026-05-06-XX.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { databaseUnavailable, err, requireSession } from "@/lib/api-helpers";
import { PlatformRole } from "@/lib/permissions";
import { normalizeDomain, validateFirmDomain } from "@/lib/tenant-guard";

type CreateFirmPayload = {
  name: string;
  city: string;
  plan: string;
  status: "Trial" | "Active" | "Paused";
  emailDomain?: string;
};

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  // Auth gate: PLATFORM_OWNER only. Inline check per the 4D-locked decision
  // (no Action.FIRM_CREATE; PLATFORM_OWNER is the only role that creates firms
  // at Stage 0; cross-firm impersonation is Step 4F scope, not relevant here
  // because firm creation does not target a specific existing firm).
  const session = await requireSession(request);
  if (!session) return err("Authentication required.", 401);
  if (session.platformRole !== PlatformRole.PLATFORM_OWNER) {
    return err("You do not have permission for this action.", 403);
  }

  try {
    const payload = await request.json() as CreateFirmPayload;
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

    const firm = await prisma.firm.create({
      data: {
        name,
        city,
        status: status.toUpperCase(),
        emailDomain: emailDomain || null,
      },
    });

    return NextResponse.json({
      ok: true,
      firm: {
        id: firm.id,
        name: firm.name,
        city: firm.city ?? city,
        plan,
        status: status,
        emailDomain: firm.emailDomain ?? "",
        onboardingCompleted: true,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to create firm." }, { status: 500 });
  }
}
