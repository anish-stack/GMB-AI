"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

export function GoogleIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.85A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.44.35-2.11V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.04l3.66 2.85C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

/** Full-width "Continue with Google" button (sign in AND sign up). */
export function GoogleButton({ label = "Continue with Google", next = null }) {
  return (
    <a
      href={`/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <GoogleIcon />
      {label}
    </a>
  );
}

const MESSAGES = {
  not_configured: "Google sign-in isn't configured yet (GOOGLE_CLIENT_ID / SECRET).",
  cancelled: "Google sign-in was cancelled.",
  state: "Sign-in session expired. Please try again.",
  no_account: "No account for this Google email, and sign-ups are closed.",
  blocked: "This account is disabled or closed. Contact support.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  failed: "Google sign-in failed. Please try again.",
};

function ErrorInner() {
  const code = useSearchParams().get("google_error");
  if (!code) return null;
  return (
    <p role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
      {MESSAGES[code] || MESSAGES.failed}
    </p>
  );
}

/** Shows ?google_error=... coming back from the OAuth callback. */
export function GoogleAuthError() {
  return (
    <Suspense fallback={null}>
      <ErrorInner />
    </Suspense>
  );
}
