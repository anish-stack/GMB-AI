"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";

export function ImpersonationBanner({ admin, tenantName }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function exit() {
    setBusy(true);
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm text-amber-950">
      <span className="flex items-center gap-2 font-medium">
        <ShieldAlert className="h-4 w-4" />
        Viewing {tenantName} as a tenant user. Signed in as {admin.name}.
      </span>
      <button onClick={exit} disabled={busy} className="rounded-lg bg-amber-950/90 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-950">
        {busy ? "Leaving..." : "Back to admin"}
      </button>
    </div>
  );
}
