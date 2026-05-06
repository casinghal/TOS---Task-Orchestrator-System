// src/lib/api-helpers.ts
// Shared API route helpers for PracticeIQ.
// Provides response envelopes, session resolution, permission gate,
// JSON parsing with Zod, and a deferred ActivityLog write helper.
// See MASTER_PROJECT.md Section 14 Step 4 and DECISION_LOG D-2026-05-06-02.

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  type ActionCode,
  type PermissionContext,
  type SessionUser,
  normalizeFirmRole,
  normalizePlatformRole,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// --- Standard response envelope -------------------------------------------

export type OkResponse<T = unknown> = {
  ok: true;
  data?: T;
};

export type ErrResponse = {
  ok: false;
  message: string;
  details?: unknown;
};

export function ok<T>(data?: T, status = 200) {
  return NextResponse.json<OkResponse<T>>({ ok: true, data }, { status });
}

export function err(message: string, status = 400, details?: unknown) {
  return NextResponse.json<ErrResponse>({ ok: false, message, details }, { status });
}

export function databaseUnavailable() {
  return err("DATABASE_URL is not configured.", 503);
}

// --- Session resolution ---------------------------------------------------
//
// Step 4B-2 (folds 4C role + firm context resolution per Decision 4A-D1):
// resolves the authenticated Supabase user, maps to PlatformUser by
// normalized email, validates active status, and resolves the unique
// active FirmMember to populate firmRole + firmId. Returns SessionUser
// only when every step succeeds. Otherwise returns null, which cascades
// to 401 via requireAuth().
//
// Stage 0 fail-closed rules (per Decision 4A and the 2026-05-06
// PLATFORM_OWNER edit approving option (b)):
//   - No Supabase user / no email                      → null
//   - Unmapped or inactive PlatformUser                 → null
//   - Unknown platformRole / unknown firmRole (corrupt) → null
//   - Zero active FirmMember (applies to PLATFORM_OWNER too;
//     no all-firm escape; impersonation is Step 4F)     → null
//   - Multiple active FirmMember (Stage 0 multi-firm)   → null
//
// The returned firmId comes only from the server-side FirmMember lookup.
// Client-supplied firmId is never trusted (Decision 4A-G1).
//
// SUPABASE_SERVICE_ROLE_KEY is NOT used here (Decision 4A-N1). Session
// resolution uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
// via createSupabaseServerClient(). Service-role usage is reserved for
// separately reviewed admin operations (none today).
//
// Cookie reads are handled inside createSupabaseServerClient() via
// next/headers cookies(); the Request parameter is retained for ABI
// stability with requireAuth(request, ...) callers but not consumed here.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function requireSession(_request: Request): Promise<SessionUser | null> {
  // 1. Build server-side Supabase client. .catch turns an env-config
  //    throw from createSupabaseServerClient() into a fail-closed null.
  const supabase = await createSupabaseServerClient().catch(() => null);
  if (!supabase) return null;

  // 2. Resolve Supabase user. getUser() revalidates the JWT against
  //    Supabase server. getSession() reads the cookie blind and is unsafe
  //    for trust decisions on the server side.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || !user.email) return null;

  // 3. Normalize email per Decision 4A-F1 + I1-NORMALIZE.
  const email = user.email.trim().toLowerCase();
  if (!email) return null;

  // 4. Map Supabase user to PlatformUser by normalized email.
  const platformUser = await prisma.platformUser.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      platformRole: true,
      isActive: true,
    },
  });
  if (!platformUser || !platformUser.isActive) return null;

  // 5. Narrow platformRole. Stored as a String column; bad data → fail closed.
  const platformRole = normalizePlatformRole(platformUser.platformRole);
  if (!platformRole) return null;

  // 6. Resolve active FirmMember rows for this user.
  const memberships = await prisma.firmMember.findMany({
    where: { userId: platformUser.id, isActive: true },
    select: { firmId: true, firmRole: true },
  });

  // 7. Stage 0 fail-closed: exactly one active membership required.
  //    Applies uniformly to STANDARD and PLATFORM_OWNER. Cross-firm access
  //    for PLATFORM_OWNER is Step 4F (audited impersonation), not here.
  if (memberships.length !== 1) return null;

  const membership = memberships[0];

  // 8. Narrow firmRole. Stored as a String column; bad data → fail closed.
  const firmRole = normalizeFirmRole(membership.firmRole);
  if (!firmRole) return null;

  // 9. Build the SessionUser. firmId comes only from the server-side
  //    FirmMember lookup; client-supplied firmId is never trusted.
  return {
    userId: platformUser.id,
    email: platformUser.email,
    platformRole,
    firmRole,
    firmId: membership.firmId,
  };
}

// --- requireAuth: combined session + permission gate ----------------------
//
// All new API routes (3B-3F) should call this as their first action.
// In 3A, every call yields 401 because requireSession() returns null.
// Routes use the returned discriminated union to short-circuit:
//
//   const auth = await requireAuth(request, Action.CLIENT_MANAGE);
//   if (!auth.ok) return auth.response;
//   const session = auth.session;

export type AuthSuccess = { ok: true; session: SessionUser };
export type AuthFailure = { ok: false; response: NextResponse<ErrResponse> };

export async function requireAuth(
  request: Request,
  action: ActionCode,
  context: PermissionContext = {},
): Promise<AuthSuccess | AuthFailure> {
  const session = await requireSession(request);
  const check = requirePermission(session, action, context);
  if (!check.ok) {
    return { ok: false, response: err(check.message, check.status) };
  }
  return { ok: true, session: session! };
}

// --- Zod parse helper -----------------------------------------------------
//
// Returns a discriminated union the route can short-circuit on:
//
//   const parsed = await parseJson(request, MyZodSchema);
//   if (!parsed.ok) return parsed.response;
//   const payload = parsed.data;

export type ParseSuccess<T> = { ok: true; data: T };
export type ParseFailure = { ok: false; response: NextResponse<ErrResponse> };

export async function parseJson<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<ParseSuccess<T> | ParseFailure> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: err("Invalid JSON payload.", 400) };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: err("Validation failed.", 422, result.error.issues),
    };
  }
  return { ok: true, data: result.data };
}

// --- ActivityLog write helper ---------------------------------------------
//
// Step 4E (`1b88f80`+ runtime; this commit): real Prisma persistence to
// `ActivityLog`. Built on top of real `requireSession()` (Step 4B-2) which
// supplies non-null `firmId` and `actorId` at every existing call site.
//
// Behaviour contract:
//   - Persists `firmId`, `actorId`, `entityType`, `entityId`, `action`,
//     `metadataJson` exactly as the caller supplies them. Optional fields
//     (`entityId`, `metadataJson`) coerce to `null` when omitted.
//   - FAIL OPEN: any DB error during the audit write is caught internally
//     and logged via `console.error`. The function never throws. Audit-log
//     write failures must NOT block the main business mutation, which has
//     already committed by the time this helper runs at the call sites.
//   - If `DATABASE_URL` is missing, returns immediately without throwing
//     (route handlers already returned 503 in that case).
//   - Does NOT log request bodies, headers, IPs, user agents, tokens,
//     cookies, passwords, secrets, environment variables, or full
//     before/after object snapshots. The error-path `console.error` deliberately
//     omits raw `metadataJson` to avoid surfacing free-text fields (e.g.
//     deactivate/reactivate `reason`) into Netlify logs on failure.
//
// References: MASTER_PROJECT.md Section 14 Step 4E; CHANGE_LOG C-2026-05-06-XX
// (this commit); D-2026-04-30-15 Decision 4 (now satisfied).

export type ActivityLogArgs = {
  firmId: string | null;
  actorId: string | null;
  entityType: string;
  entityId?: string;
  action: string;
  metadataJson?: string;
};

export async function writeActivityLog(args: ActivityLogArgs): Promise<void> {
  // Skip if database not configured. Route handlers already returned 503;
  // throwing here would propagate into the route's main try/catch and
  // mask the original 503 with a 500.
  if (!process.env.DATABASE_URL) return;

  try {
    await prisma.activityLog.create({
      data: {
        firmId: args.firmId,
        actorId: args.actorId,
        entityType: args.entityType,
        entityId: args.entityId ?? null,
        action: args.action,
        metadataJson: args.metadataJson ?? null,
      },
    });
  } catch (e) {
    // FAIL OPEN. The mutation has already committed; rethrowing would mask
    // the success and trigger the route's 500 handler, leaving the user
    // looking at an error for an action that actually worked. Log a
    // structured forensic record for operators to monitor and continue.
    //
    // We deliberately do NOT include `metadataJson` in this log line to
    // avoid surfacing free-text fields (e.g. team deactivate/reactivate
    // `reason`) into Netlify logs.
    console.error("writeActivityLog failed", {
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      firmId: args.firmId,
      actorId: args.actorId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
