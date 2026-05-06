// src/app/api/firms/[firmId]/members/route.ts
// PracticeIQ Section 14 Step 4D - Deprecated route.
//
// POST /api/firms/[firmId]/members has been removed.
//
// Reason: this endpoint duplicated `POST /api/team` (canonical 3E-2A path,
// shipped at commit `f94027d`) and used a weaker shape — empty
// `passwordHash: ""` instead of the sentinel `STEP4_MIGRATE_DISABLED:<uuid>`,
// human-string firmRole values like "Firm Admin" instead of canonical codes,
// no cross-firm collision detection, no ActivityLog call sites. Maintaining
// two add-member routes invites drift; consolidation onto `/api/team` keeps
// the auth + tenant + audit semantics single-sourced.
//
// The route file is kept as a 410 Gone stub so the URL space registers a
// clear deprecation signal. No active UI/source caller existed at
// deprecation time (verified by mandatory grep at C-2026-05-06-XX).
//
// Migration: any caller should switch to `POST /api/team`. The team route
// is auth-gated via requireAuth(Action.TEAM_MANAGE), validates payload via
// Zod, normalizes email, runs the create transaction, handles cross-firm
// collisions with 422, and queues ActivityLog events for Step 4E.
//
// ActivityLog is intentionally NOT written from this stub: activity logging
// is Step 4E scope and the deprecation itself is not an audit-worthy event.
//
// References: MASTER_PROJECT.md Section 14 Step 4D; Section 14 Step 3E-2A;
// CHANGE_LOG C-2026-05-06-XX.

import { err } from "@/lib/api-helpers";

export async function POST() {
  return err("This endpoint has been removed. Use POST /api/team.", 410);
}
