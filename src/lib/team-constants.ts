// src/lib/team-constants.ts
// PracticeIQ Section 14 Step 3E foundation.
// Canonical FirmRole tuple (Zod-friendly), team status filter set,
// pagination caps, name-length cap, and placeholder passwordHash
// scaffolding consumed by the Team route group.
//
// Naming note:
// - `permissions.ts` owns the canonical `FirmRole` const + `FirmRoleCode`
//   type for use across the matrix. This file does NOT redefine them.
// - `FIRM_ROLES` here is the tuple form needed by `z.enum()` at the route
//   layer. It satisfies `readonly FirmRoleCode[]` so the two stay aligned.
//
// Decision references:
// - 3E-1-B (B1): inactive members hidden by default; ?status=active|inactive|all.
// - 3E-1-D (D1): create this constants file during 3E-1 implementation.
// - 3E-2A (D-2026-05-05-05): MAX_TEAM_NAME_LENGTH = 100;
//   PLACEHOLDER_PASSWORD_HASH_PREFIX = "STEP4_MIGRATE_DISABLED:" with
//   crypto-random suffix; placeholder digest must never collide with a
//   real SHA-256 password hash.
//
// Note on 3E-2B: MAX_TEAM_NOTE_LENGTH (deactivate / reactivate reason cap)
// is NOT added in this file in 3E-2A. It belongs to 3E-2B and lands when
// the deactivate / reactivate routes are implemented.
//
// References:
// - MASTER_PROJECT.md Section 14 Step 3E (team route group).
// - MASTER_PROJECT.md Section 10 (FirmRole canonical set).
// - DECISION_LOG D-2026-05-05-02 (3E-1 plan: A1/B1/C1/D1 locked).
// - DECISION_LOG D-2026-05-05-05 (3E-2A implementation decisions).
// - CHANGE_LOG C-2026-05-05-02 (3E-1 implementation wave).
// - CHANGE_LOG C-2026-05-05-05 (3E-2A implementation wave).

import { randomUUID } from "node:crypto";

import type { FirmRoleCode } from "@/lib/permissions";

// --- Canonical sets -------------------------------------------------------

// Tuple form for Zod `z.enum(FIRM_ROLES)`. Aligned with permissions.ts via
// the `satisfies` clause - adding a role here without adding it to
// permissions.ts (or vice versa) is a TypeScript error.
export const FIRM_ROLES = [
  "FIRM_ADMIN",
  "PARTNER",
  "MANAGER",
  "ARTICLE_STAFF",
] as const satisfies readonly FirmRoleCode[];

// --- Team status filter (Decision B1) -------------------------------------
//
// `active`   (default): isActive = true
// `inactive`         : isActive = false
// `all`              : no isActive filter
export const TEAM_STATUS_FILTERS = ["active", "inactive", "all"] as const;
export type TeamStatusFilter = (typeof TEAM_STATUS_FILTERS)[number];

// --- Pagination caps (mirror tasks for cross-route consistency) -----------

export const DEFAULT_TEAM_PAGE_SIZE = 50;
export const MAX_TEAM_PAGE_SIZE = 200;

// --- Defaults -------------------------------------------------------------

export const DEFAULT_TEAM_STATUS_FILTER: TeamStatusFilter = "active";

// --- 3E-2A constants ------------------------------------------------------

// Maximum length of `name` in POST /api/team and PATCH /api/team/[id]
// bodies. Enforced via Zod at the route layer.
export const MAX_TEAM_NAME_LENGTH = 100;

// Sentinel prefix for placeholder PlatformUser.passwordHash values created
// by POST /api/team (3E-2A) when a new PlatformUser row is created. Step 4
// migration script identifies these rows by prefix and migrates them onto
// Supabase Auth.
//
// Format: PLACEHOLDER_PASSWORD_HASH_PREFIX + crypto.randomUUID()
//   - Prefix is a fixed string (~24 chars) for cheap grep / filter.
//   - Suffix is a v4 UUID (36 chars). Cryptographically random; cannot
//     collide with any real SHA-256 hex digest (which is 64 chars of
//     0-9a-f only). The sentinel format (mixed case, hyphens, prefix)
//     guarantees no collision with the existing pre-Step-4 login digest
//     comparison.
//   - Total length ~60 chars; well within typical password hash storage.
//
// Critical invariant: this value MUST NEVER successfully authenticate a
// login attempt. The existing pre-Step-4 login flow compares user-typed
// passwords against fixed SHA-256 hex digests; the sentinel format cannot
// collide.
export const PLACEHOLDER_PASSWORD_HASH_PREFIX = "STEP4_MIGRATE_DISABLED:";

// Generates a fresh placeholder passwordHash for use in POST /api/team
// when a new PlatformUser is created. Returns a string of the form
// `STEP4_MIGRATE_DISABLED:<v4-uuid>`. Cryptographically random per call.
// Single-sourced here so Step 4 migration tooling has a stable anchor.
export function generatePlaceholderPasswordHash(): string {
  return `${PLACEHOLDER_PASSWORD_HASH_PREFIX}${randomUUID()}`;
}
