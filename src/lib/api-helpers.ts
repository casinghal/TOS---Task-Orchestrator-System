// src/lib/api-helpers.ts
// Shared API route helpers for PracticeIQ.
// Provides response envelopes, session resolution placeholder, permission
// gate, JSON parsing with Zod, and a deferred ActivityLog write helper.
// See MASTER_PROJECT.md Section 14 Step 3A and DECISION_LOG D-2026-04-30-15.

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  type ActionCode,
  type PermissionContext,
  type SessionUser,
  requirePermission,
} from "@/lib/permissions";

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

// --- Session resolution placeholder ---------------------------------------
//
// Step 3A: returns null. requireAuth() therefore yields 401 for any caller.
// This is the safety mechanism that prevents new routes (3B-3F) from
// shipping open by construction.
// Step 4 will replace this with real Supabase Auth session resolution.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function requireSession(_request: Request): Promise<SessionUser | null> {
  // TODO Step 4: resolve Supabase Auth session and return SessionUser.
  return null;
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

// --- Deferred ActivityLog write helper ------------------------------------
//
// DEFERRED until Step 4 wires real session identity (D-2026-04-30-15
// Decision 4, recorded 2026-04-30). This helper exists so route code can
// call writeActivityLog(...) without churn when Step 4 lands.
//
// IMPORTANT: this is a NO-OP today. It does NOT write rows to the database.
// Do NOT treat the existence of this helper as evidence of an active audit
// trail. Per Decision 4, we do NOT write ActivityLog rows with null actorId
// because an audit trail without a real actor is misleading.

export type ActivityLogArgs = {
  firmId: string | null;
  actorId: string | null;
  entityType: string;
  entityId?: string;
  action: string;
  metadataJson?: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function writeActivityLog(_args: ActivityLogArgs): Promise<void> {
  // TODO Step 4: implement Prisma write to ActivityLog with real actorId
  // sourced from a verified Supabase Auth session. Until then this remains
  // a deliberate no-op per D-2026-04-30-15 Decision 4.
  return;
}
