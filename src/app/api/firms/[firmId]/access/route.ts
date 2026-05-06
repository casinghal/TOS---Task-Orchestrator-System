// src/app/api/firms/[firmId]/access/route.ts
// PracticeIQ Section 14 Step 4D - Deprecated route.
//
// POST /api/firms/[firmId]/access has been removed.
//
// Reason: real `requireSession()` (Step 4B-2, commit `0c47cd7`) now resolves
// firm membership server-side on every authenticated request. There is no
// remaining need for a separate "verify access" endpoint, and the original
// implementation leaked (firmId, userId) probe results to anonymous callers.
//
// The route file is kept as a 410 Gone stub so the URL space registers a
// clear deprecation signal rather than a 404 (which would imply the URL was
// never valid). No active UI/source caller existed at deprecation time
// (verified by mandatory grep at C-2026-05-06-XX implementation).
//
// Migration: remove any caller. The standard auth flow (`requireAuth(...)`)
// fully covers the membership-verification need.
//
// References: MASTER_PROJECT.md Section 14 Step 4D; CHANGE_LOG C-2026-05-06-XX.

import { err } from "@/lib/api-helpers";

export async function POST() {
  return err("This endpoint has been removed. Use the standard auth flow.", 410);
}
