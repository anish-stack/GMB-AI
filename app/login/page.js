"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@hover.in");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-600">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-900">GMB AI Manager</h1>
            <p className="text-xs text-slate-500">Sign in to the review queue</p>
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
        </div>

        {error ? <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

        <Button type="submit" className="mt-4 w-full" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </Button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
          Demo accounts: admin@hover.in / admin123 &middot; ravi@hover.in / seo123
        </p>
      </form>
    </div>
  );
}
