// src/lib/supabase-server.ts
// PracticeIQ Section 14 Step 4B-1 - Supabase SSR server helper.
//
// IMPORTANT - DO NOT IMPORT THIS FILE FROM ANY ROUTE OR LIB FILE YET.
//
// Step 4B-1 is package + helper preparation only. The locked-by-default
// 401 contract requires `requireSession()` in `src/lib/api-helpers.ts` to
// keep returning null until Step 4B-2 lands. This helper is a future
// dependency for that wave; it must remain unimported in 4B-1.
//
// Usage (Step 4B-2 onward):
//   const supabase = await createSupabaseServerClient();
//   const { data: { user } } = await supabase.auth.getUser();
//
// Architecture decisions consumed:
//   4A-A1: Supabase Auth as identity provider
//   4A-B1: server-managed cookie-based Supabase SSR session via @supabase/ssr;
//          secure cookie settings verified during implementation, not
//          over-locked here.
//   4A-C1: @supabase/ssr is in beta; this helper follows the current API
//          surface (getAll / setAll cookie methods).
//   4A-N1: SUPABASE_SERVICE_ROLE_KEY is NOT used here. Ordinary session
//          resolution uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
//          only. Service-role usage is reserved for separately reviewed
//          server-only admin operations (none in this helper).
//
// References: MASTER_PROJECT.md Section 14 Step 4; DECISION_LOG D-2026-05-06-02;
// CHANGE_LOG C-2026-05-06-03.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a server-side Supabase client bound to the current request's
 * cookies. Each call creates a fresh client; do not memoize across
 * requests because the bound cookie store is request-scoped.
 *
 * Will be consumed by `requireSession()` in `src/lib/api-helpers.ts`
 * when Step 4B-2 lands. NOT imported anywhere yet.
 *
 * Reads env vars at call time (not module load) so that build-time
 * static analysis does not fail when this file is unimported.
 *
 * Throws if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * is missing at runtime. The throw is intentional: callers should treat
 * a missing Supabase config as a deployment-config error, not as a
 * silent auth bypass.
 */
export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase server client cannot be created: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll can be invoked from a Server Component context where
          // setting cookies is not allowed. In a route-handler context
          // (where `requireSession()` runs in 4B-2), this works normally.
          // Silently ignore the disallowed-set error here so Server
          // Components can still create a read-only client without
          // tripping a runtime error.
        }
      },
    },
  });
}
