// src/app/api/tenant/validate/route.ts
// PracticeIQ Section 14 Step 4D - Stateless validation route.
// POST /api/tenant/validate - validate an email/firm-domain pair, OR a domain.
//
// INTENTIONALLY PUBLIC. Do NOT add `requireAuth()` here without first
// re-architecting the pre-login UI flow.
//
// Why public:
//   - Pure stateless format validator. Runs `validateUserForFirm()` and
//     `validateFirmDomain()` from `tenant-guard.ts` only.
//   - No DB read. No DB write. No PII access. No firm-existence leak.
//     The route never touches Prisma; it only runs regex/format checks.
//   - Useful for pre-login / pre-auth UI flows that need to validate a
//     firm-domain or email-vs-domain pair BEFORE the user has a session.
//     Gating it would create a chicken-and-egg problem.
//   - The endpoint reveals nothing beyond "is this a syntactically-valid
//     email?" and "does this email's domain match this domain?". Both are
//     facts the caller already knows by construction.
//
// If a future bug or abuse vector is discovered, revisit per the Section 25
// platform-hardening checklist before changing the auth posture.
//
// References: MASTER_PROJECT.md Section 14 Step 4D; CHANGE_LOG C-2026-05-06-XX.

import { NextResponse } from "next/server";
import { validateFirmDomain, validateUserForFirm } from "@/lib/tenant-guard";

type UserPayload = {
  email: string;
  firmDomain: string;
  isPlatformOwner?: boolean;
};

type DomainPayload = {
  domain: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as
      | { kind: "user"; payload: UserPayload }
      | { kind: "domain"; payload: DomainPayload };

    if (body.kind === "user") {
      const result = validateUserForFirm(
        body.payload.email,
        body.payload.firmDomain,
        Boolean(body.payload.isPlatformOwner),
      );
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }

    if (body.kind === "domain") {
      const result = validateFirmDomain(body.payload.domain);
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }

    return NextResponse.json({ ok: false, message: "Unsupported validation request." }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid validation payload." }, { status: 400 });
  }
}
