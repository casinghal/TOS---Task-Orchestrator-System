// src/lib/team-constants.ts
// PracticeIQ Section 14 Step 3E-1 foundation.
// Canonical FirmRole tuple (Zod-friendly), team status filter set, and
// pagination caps consumed by the Team route group.
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
//
// References:
// - MASTER_PROJECT.md Section 14 Step 3E (team route group).
// - MASTER_PROJECT.md Section 10 (FirmRole canonical set).
// - DECISION_LOG D-2026-05-05-02 (3E-1 plan: A1/B1/C1/D1 locked).
// - CHANGE_LOG C-2026-05-05-02 (3E-1 implementation wave).

import type { FirmRoleCode } from "@/lib/permissions";

// --- Canonical sets -------------------------------------------------------

// Tuple form for Zod `z.enum(FIRM_ROLES)`. Aligned with permissions.ts via
// the `satisfies` clause — adding a role here without adding it to
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
