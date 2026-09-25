"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Mail, Lock, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState("email"); // "email" | "reset" | "done"
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong");
    // Always shown, whether or not the email exists on file - avoids leaking accounts.
    setInfo(data.message);
    setChallenge(data.challenge || "");
    setStep("reset");
  }

  async function submitReset(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match");
    if (!challenge) return setError("This reset session is invalid. Please request a new code.");
    setBusy(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge, code, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not reset password");
    setStep("done");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <form
        onSubmit={step === "reset" ? submitReset : requestCode}
        className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-7 shadow-xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8"
      >
        <Link href="/" className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F53236]">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">GMB AI Cloud</span>
        </Link>

        {step === "done" ? (
          <>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Password updated</h1>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              You can now sign in with your new password.
            </p>
            <Button type="button" onClick={() => router.push("/login")} className="mt-6 flex w-full items-center justify-center gap-2 bg-[#F53236] hover:bg-[#e81d22]">
              Go to sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        ) : step === "reset" ? (
          <>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Check your email</h1>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{info || "Enter the code we emailed you along with a new password."}</p>

            <div className="mt-6 space-y-4">
              <Field label="Verification code">
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="pl-9 tracking-[0.4em] text-center text-lg"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>
              </Field>
              <Field label="New password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9" required minLength={6} />
                </div>
              </Field>
              <Field label="Confirm new password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className="pl-9" required minLength={6} />
                </div>
              </Field>
            </div>

            {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p> : null}

            <Button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 bg-[#F53236] hover:bg-[#e81d22]">
              {busy ? "Updating..." : "Update password"}
            </Button>
            <button type="button" onClick={() => setStep("email")} className="mt-4 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Forgot password?</h1>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">We&apos;ll email you a 6-digit code to reset it.</p>

            <div className="mt-6 space-y-4">
              <Field label="Email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" className="pl-9" required autoFocus />
                </div>
              </Field>
            </div>

            {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p> : null}

            <Button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 bg-[#F53236] hover:bg-[#e81d22]">
              {busy ? "Sending..." : "Send reset code"}
            </Button>
            <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
              <Link href="/login" className="font-medium text-[#F53236] hover:underline">Back to sign in</Link>
            </p>
          </>
        )}
      </form>
    </div>
  );
}
