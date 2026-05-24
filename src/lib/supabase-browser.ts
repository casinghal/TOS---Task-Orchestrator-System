import { createBrowserClient } from "@supabase/ssr";

// Section 14 Step 5A: browser-side Supabase client singleton.
// Sets the SSR-compatible auth cookie that src/lib/api-helpers.ts reads
// server-side. Auth/session enablement only - no data access here.

type BrowserClient = ReturnType<typeof createBrowserClient>;

let cached: BrowserClient | null = null;

export function getSupabaseBrowserClient(): BrowserClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser client is not configured. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set at build time.",
    );
  }

  cached = createBrowserClient(url, anonKey);
  return cached;
}
