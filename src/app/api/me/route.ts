// src/app/api/me/route.ts
// PracticeIQ Section 14 Step 5B-3a-pre: current-user identity route.
//
// GET /api/me - returns the server-authoritative identity of the signed-in
// principal (the current user only). This is the source of truth for the UI's
// current-user binding (platformRole / firmRole / identity), separate from
// GET /api/team which lists firm members. Read-only; no writes.
//
// Auth: resolved via requireSession() - no specific permission, any valid
// session may read its own identity. Fails closed to 401 when requireSession()
// returns null (no / inactive / zero / multiple active FirmMember).
//
// Response (minimal; current user only):
//   { userId, firmMemberId, name, firmRole, platformRole, firmId }
// Deliberately excluded: email, passwordHash, lastLoginAt, tokens, cookies, and
// any other user's data. No identity values are logged anywhere in this route.
//
// References: api-helpers.ts requireSession() (Step 4B-2); api/team GET (3E-1)
// response/envelope conventions; MASTER_PROJECT.md Section 14 Step 5B.

import { prisma } from "@/lib/prisma";
import {
  databaseUnavailable,
  err,
  ok,
  requireSession,
} from "@/lib/api-helpers";

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const session = await requireSession(request);
  if (!session) return err("Authentication required.", 401);

  try {
    // Minimal extra read: resolve the current active FirmMember id and the
    // user's display name for this session's (userId, firmId). requireSession()
    // already validated exactly one active membership; this re-reads only the
    // id + name needed for the current-user binding. No other fields exposed.
    const member = await prisma.firmMember.findFirst({
      where: {
        userId: session.userId,
        firmId: session.firmId,
        isActive: true,
      },
      select: {
        id: true,
        user: { select: { name: true } },
      },
    });

    // Fail closed if no active workspace profile is found for this session.
    if (!member) return err("No active workspace profile.", 401);

    // Section 14 Step 5B-final (F1): additive active-firm display fields for the
    // session's OWN firm (session.firmId). Read-only; same-firm only; no
    // cross-firm lookup; no writes. Safe display fields only - no secrets and no
    // other firm's data. Plan name is read via the existing Firm->Plan relation
    // (no schema change). All fields are optional/nullable on the client.
    const firmRecord = await prisma.firm.findUnique({
      where: { id: session.firmId },
      select: {
        name: true,
        status: true,
        city: true,
        emailDomain: true,
        plan: { select: { name: true } },
      },
    });

    return ok({
      userId: session.userId,
      firmMemberId: member.id,
      name: member.user.name,
      firmRole: session.firmRole,
      platformRole: session.platformRole,
      firmId: session.firmId,
      firmName: firmRecord?.name ?? null,
      firmStatus: firmRecord?.status ?? null,
      firmPlan: firmRecord?.plan?.name ?? null,
      firmEmailDomain: firmRecord?.emailDomain ?? null,
      firmCity: firmRecord?.city ?? null,
    });
  } catch {
    // Controlled failure; do not leak identity or error internals to the client
    // and do not log identity values.
    return err("Unable to resolve current user.", 500);
  }
}
