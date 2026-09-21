"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    router.push(data.redirect || "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F53236]">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">GMB AI Cloud</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Sign in to your workspace</p>
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
        </div>

        {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}

        <Button type="submit" className="mt-4 w-full" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </Button>

        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          No account yet? <Link href="/signup" className="font-medium text-[#F53236]">Create a workspace</Link>
          <br />
          <Link href="/pricing" className="hover:underline">See plans and pricing</Link>
        </p>
      </form>
    </div>
  );
}
