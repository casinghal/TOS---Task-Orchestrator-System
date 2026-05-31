"use client";

// src/app/auth/reset-password/page.tsx
// PracticeIQ Section 14 Step 5B-3c-1 - password recovery landing page.
//
// Supabase email-based recovery (Option A) lands the user here after they
// click the reset link. The user sets a new password via
// supabase.auth.updateUser, after which we sign them out and send them back
// to the LoginScreen to sign in with the new password.
//
// Recovery detection is LOCKED: the ONLY authoritative recovery signal is the
// onAuthStateChange event "PASSWORD_RECOVERY". getSession() is used solely to
// tell an already-signed-in user apart from an expired/invalid link; it is
// NEVER used to infer or confirm recovery.
//
// No secrets are logged: no hash, token, session, password, or recovery state
// is written to the console.

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ResetState = "loading" | "recovery" | "no_session" | "success";
type NoSessionVariant = "expired" | "signed_in";

const NO_SESSION_TITLE = "This reset link is invalid or has expired.";
const EXPIRED_BODY =
  "Please ask your Firm Admin to trigger a fresh password reset, or sign in if you remember your current password.";
const SIGNED_IN_BODY =
  "You are already signed in. Sign out first, then click the reset link again.";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [state, setState] = useState<ResetState>("loading");
  const [noSessionVariant, setNoSessionVariant] =
    useState<NoSessionVariant>("expired");
  const [detail, setDetail] = useState<string | null>(null);

  // Recovery form fields.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // `resolved` guards against double-resolution between the auth event,
    // the 3s timeout, and the getSession() fallback.
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // 1. Authoritative recovery signal. PASSWORD_RECOVERY is the ONLY event
    //    we treat as proof of a valid recovery context.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        setState("recovery");
      }
    });

    // 2. Inspect URL markers in both the query string and the hash fragment.
    const search = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith("#")
      ? new URLSearchParams(window.location.hash.slice(1))
      : new URLSearchParams("");
    const marker = (key: string) => search.get(key) ?? hash.get(key);

    const errorParam = marker("error");
    const errorDescription = marker("error_description");
    const typeParam = marker("type");
    const codeParam = marker("code");

    if (errorParam || errorDescription) {
      // 3. Explicit error on the link → expired/invalid. Do not proceed to
      //    recovery. Show the provider description as supplementary context.
      //    State writes are deferred out of the effect body via a microtask
      //    to satisfy react-hooks/set-state-in-effect; behaviour is unchanged
      //    (resolved is still set synchronously so the timeout/getSession
      //    paths cannot also fire).
      resolved = true;
      queueMicrotask(() => {
        if (errorDescription) setDetail(errorDescription);
        setNoSessionVariant("expired");
        setState("no_session");
      });
    } else if (typeParam === "recovery" || codeParam) {
      // 4. Recovery markers present and no error → wait briefly for the
      //    authoritative PASSWORD_RECOVERY event. If it does not arrive, the
      //    link is treated as expired/invalid.
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          setNoSessionVariant("expired");
          setState("no_session");
        }
      }, 3000);
    } else {
      // 5/6. No recovery markers. getSession() ONLY distinguishes a normal
      //      signed-in user from an expired/invalid link — never to infer
      //      recovery.
      supabase.auth.getSession().then(({ data }) => {
        if (resolved) return;
        resolved = true;
        setNoSessionVariant(data.session ? "signed_in" : "expired");
        setState("no_session");
      });
    }

    // 7. Cleanup.
    return () => {
      sub.subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!password || !confirmPassword) {
      setFormError("Both fields are required.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    // Success: clear the recovery session unconditionally, then return the
    // user to the LoginScreen to sign in with the new password.
    setState("success");
    await supabase.auth.signOut();
    setTimeout(() => {
      router.replace("/");
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-slate-950 font-login flex items-center justify-center px-4 py-12 text-slate-100">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">PracticeIQ</h1>
            <p className="mt-1 text-sm text-slate-300">Reset your password</p>
          </div>

          {state === "loading" ? (
            <p className="mt-8 text-center text-sm text-slate-300">
              Checking your reset link...
            </p>
          ) : null}

          {state === "recovery" ? (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-slate-200"
                >
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-slate-200"
                >
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="Re-enter the new password"
                />
              </div>

              {formError ? (
                <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-400 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Updating..." : "Set new password"}
              </button>
            </form>
          ) : null}

          {state === "no_session" ? (
            <div className="mt-8 space-y-4 text-center">
              <h2 className="text-base font-semibold text-slate-100">
                {NO_SESSION_TITLE}
              </h2>
              <p className="text-sm text-slate-300">
                {noSessionVariant === "signed_in" ? SIGNED_IN_BODY : EXPIRED_BODY}
              </p>
              {detail ? (
                <p className="text-xs text-slate-500">{detail}</p>
              ) : null}
              <button
                type="button"
                onClick={() => router.replace("/")}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-400 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                Go to sign in
              </button>
            </div>
          ) : null}

          {state === "success" ? (
            <p className="mt-8 text-center text-sm text-slate-200">
              Password updated. Redirecting...
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
