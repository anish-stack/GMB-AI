"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Star,
  Quote,
} from "lucide-react";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState("credentials"); // "credentials" | "otp"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // OTP step state
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Sign in failed");

    if (data.otpRequired) {
      setChallenge(data.challenge);
      setMaskedEmail(data.maskedEmail || email);
      setStep("otp");
      return;
    }
    router.push(data.redirect || "/dashboard");
    router.refresh();
  }

  async function submitOtp(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge, code }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Verification failed");
    router.push(data.redirect || "/dashboard");
    router.refresh();
  }

  async function resendOtp() {
    setResendBusy(true);
    setResendMsg("");
    setError("");
    const res = await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge }),
    });
    const data = await res.json();
    setResendBusy(false);
    if (!res.ok) return setError(data.error || "Could not resend code");
    setChallenge(data.challenge);
    setResendMsg("A new code has been sent.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — brand panel */}
      <div className="relative hidden overflow-hidden bg-zinc-950 lg:flex lg:flex-col lg:p-12 xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 450px at 15% 10%, rgba(245,50,54,0.35), transparent 60%), radial-gradient(600px 450px at 90% 85%, rgba(168,85,247,0.25), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 flex h-full flex-col">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F53236] shadow-lg shadow-rose-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <span className="text-lg font-semibold text-white">
              GMB AI Cloud
            </span>
          </Link>

          <div className="grid flex-1 items-center gap-10 xl:grid-cols-[1fr_320px]">
            {/* text column */}
            <div>
              <h2 className="max-w-lg text-3xl font-semibold leading-tight text-white xl:text-[2.5rem]">
                Turn 30 minutes of GMB post work into a{" "}
                <span className="text-rose-400">two-minute review</span>
              </h2>
              <p className="mt-4 max-w-md text-sm text-zinc-400">
                Sign in to keep your clients&apos; Google Business Profiles
                fresh — research, copy, visuals and QA, fully automated.
              </p>

              <div className="mt-9 space-y-4">
                {[
                  {
                    icon: Zap,
                    text: "AI writes and designs every post for you",
                  },
                  {
                    icon: ShieldCheck,
                    text: "80+ point QA before anything ships",
                  },
                  {
                    icon: BarChart3,
                    text: "Track performance across every client",
                  },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-rose-300 backdrop-blur">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <p className="text-sm text-zinc-300">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-9 max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <Quote className="h-5 w-5 text-rose-400" />
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                  We manage 50+ locations and this tool makes it effortless.
                  Highly recommended.
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Priya Sharma
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Multi-location Business
                    </p>
                  </div>
                  <div className="flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-current" />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6">
                <div>
                  <p className="text-lg font-semibold text-white">10,000+</p>
                  <p className="text-[11px] text-zinc-500">Posts generated</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">500+</p>
                  <p className="text-[11px] text-zinc-500">Agencies</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">4.9/5</p>
                  <p className="text-[11px] text-zinc-500">Rating</p>
                </div>
              </div>
            </div>

            {/* decorative mockup column — fills the right-side gap, hidden below xl */}
            <div className="relative hidden xl:block">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
                  <p className="text-xs font-semibold text-white">
                    Create Post
                  </p>
                  <span className="rounded-full bg-[#F53236] px-2 py-0.5 text-[9px] font-medium text-white">
                    Publish
                  </span>
                </div>
                <div
                  className="mt-3 flex h-28 flex-col justify-end rounded-xl bg-cover bg-center p-3"
                  style={{
                    backgroundImage:
                      "linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.6)), url(/illustrations/coffee.jpg)",
                  }}
                >
                  <p className="text-xs font-semibold leading-tight text-white">
                    Good Food Brings People Together
                  </p>
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="flex-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 py-1.5 text-center text-[10px] font-medium text-emerald-300">
                    ✓ Approved
                  </span>
                  <span className="flex-1 rounded-lg bg-[#F53236] py-1.5 text-center text-[10px] font-medium text-white">
                    ✓ Published
                  </span>
                </div>
              </div>

              <div className="absolute -bottom-6 -right-4 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-zinc-900/90 px-4 py-3 shadow-xl backdrop-blur">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F53236]/15 text-[#F53236]">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold leading-none text-white">
                    1,200+
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-400">
                    Posts this month
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-8 text-xs text-zinc-500">
            <span>© {new Date().getFullYear()} GMB AI Cloud</span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <Link href="/pricing" className="hover:text-zinc-300">
              Plans &amp; pricing
            </Link>
          </div>
        </div>
      </div>
      {/* Right — form panel */}
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 p-4 dark:bg-zinc-950 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(650px 450px at 90% -10%, rgba(245,50,54,0.10), transparent 60%), radial-gradient(500px 400px at 5% 105%, rgba(124,58,237,0.10), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.4] [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_70%)]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <form
          onSubmit={step === "otp" ? submitOtp : submit}
          className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-7 shadow-xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8"
        >
          {/* mobile-only logo */}
          <Link href="/" className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F53236]">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              GMB AI Cloud
            </span>
          </Link>

          {step === "otp" ? (
            <>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Verify it&apos;s you
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                We emailed a 6-digit code to <strong>{maskedEmail}</strong>.
                Enter it below to finish signing in.
              </p>

              <div className="mt-6 space-y-4">
                <Field label="Verification code">
                  <div className="relative">
                    <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
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
              </div>

              {error ? (
                <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  {error}
                </p>
              ) : null}
              {resendMsg ? (
                <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {resendMsg}
                </p>
              ) : null}

              <Button
                type="submit"
                className="mt-5 flex w-full items-center justify-center gap-2 bg-[#F53236] hover:bg-[#e81d22]"
                disabled={busy || code.length !== 6}
              >
                {busy ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify &amp; sign in <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="mt-5 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setCode("");
                    setError("");
                    setResendMsg("");
                  }}
                  className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={resendBusy}
                  className="font-medium text-[#F53236] hover:underline disabled:opacity-50"
                >
                  {resendBusy ? "Sending..." : "Resend code"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Welcome back
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                Sign in to your workspace to keep posts flowing.
              </p>

              <div className="mt-6 space-y-4">
                <Field label="Email">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@agency.com"
                      className="pl-9"
                      required
                      autoFocus
                    />
                  </div>
                </Field>

                <Field label="Password">
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 pr-9"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-zinc-300 text-[#F53236] focus:ring-[#F53236] dark:border-zinc-700"
                    />
                    Remember me
                  </label>
                  <Link
                    href="/forgot-password"
                    className="font-medium text-[#F53236] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {error ? (
                <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                className="mt-5 flex w-full items-center justify-center gap-2 bg-[#F53236] hover:bg-[#e81d22]"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                <span className="text-[11px] text-zinc-400">or</span>
                <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>

              <button
                type="button"
                onClick={() => setError("Google sign-in isn't set up yet - use email and password for now.")}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.85A11 11 0 0 0 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.11A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.44.35-2.11V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.04l3.66 2.85C6.71 7.3 9.14 5.38 12 5.38z"
                  />
                </svg>
                Continue with Google
              </button>

              <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                No account yet?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-[#F53236] hover:underline"
                >
                  Create a workspace
                </Link>
              </p>
              <p className="mt-1.5 text-center text-xs text-zinc-400 dark:text-zinc-500">
                <Link href="/pricing" className="hover:underline">
                  See plans and pricing
                </Link>
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
