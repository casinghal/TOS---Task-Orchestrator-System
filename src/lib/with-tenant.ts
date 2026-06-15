// src/lib/with-tenant.ts
// PracticeIQ - RLS Gate 1-B1 - tenant-context transaction wrapper.
//
// Standalone primitive: wraps a Prisma interactive transaction and sets the
// three transaction-local Postgres GUCs that the `app`-schema RLS helper
// functions read, BEFORE any tenant-scoped query runs:
//
//   app.firm_id        -> read by app.current_firm_id()
//   app.actor_user_id  -> read by app.current_actor()
//   app.platform_role  -> read by app.is_platform_owner()
//                         (tests current_setting('app.platform_role', true) = 'PLATFORM_OWNER')
//
// GUC keys and semantics were confirmed by read-only DB introspection
// (Gate 1-B0 / Batch 1, 2026-06-15): the app.* functions resolve/gate only and
// do NOT set GUCs, so the application owns context-setting. set_config(..., true)
// makes each value transaction-local (SET LOCAL semantics) - required under
// Supabase's transaction-pooled connections so context never leaks across
// pooled sessions.
//
// STATUS (Gate 1-B1): library primitive only. UNUSED by design - no route is
// wired, requireSession is unchanged, cross-firm.ts / begin_impersonation are
// not wired, and no audit migration is performed. The app still connects as
// `postgres` (BYPASSRLS), so these GUCs are inert-but-correct until a
// constrained runtime role + RLS policies land in a later, separately approved
// DB/security gate.
//
// References: MASTER_PROJECT.md Section 14; RLS Gate 1-A1a (app.* functions);
// Gate 1-B0 plan.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PlatformRoleCode } from "@/lib/permissions";

/**
 * Server-resolved tenant context. Every field is resolved server-side
 * (e.g. requireSession / cross-firm resolution); never client-supplied.
 *
 * `platformRole` is the role STRING written verbatim to the `app.platform_role`
 * GUC. `app.is_platform_owner()` derives the boolean in-database. Do not pass a
 * boolean here.
 */
export type TenantContext = {
  /** Effective firm id. Under PLATFORM_OWNER impersonation this is the TARGET firm. */
  firmId: string;
  /** Real operator's PlatformUser.id (the audit actor). */
  actorUserId: string;
  /** 'PLATFORM_OWNER' | 'STANDARD'. Written to app.platform_role. */
  platformRole: PlatformRoleCode;
};

/** Optional pass-through to Prisma's interactive-transaction options. */
export type WithTenantOptions = {
  timeout?: number;
  maxWait?: number;
};

/**
 * Run `fn` inside a Prisma interactive transaction whose first statements set
 * the three transaction-local tenant GUCs. `fn` receives the same `tx` and must
 * perform all tenant-scoped reads/writes on it so they observe the context.
 *
 * The set_config calls are issued via $queryRaw (set_config is invoked through
 * SELECT and returns a row). The tagged-template ${} bindings are parameterized
 * by Prisma - values are bound, never string-interpolated.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: WithTenantOptions,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.firm_id', ${ctx.firmId}, true)`;
    await tx.$queryRaw`SELECT set_config('app.actor_user_id', ${ctx.actorUserId}, true)`;
    await tx.$queryRaw`SELECT set_config('app.platform_role', ${ctx.platformRole}, true)`;
    return fn(tx);
  }, options);
}
