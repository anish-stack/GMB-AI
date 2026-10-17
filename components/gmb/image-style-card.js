"use client";

import { useState } from "react";
import { CheckCircle2, ImageIcon, Loader2 } from "lucide-react";
import { Card, Alert, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

const MODE = { BRANDED_PHOTO: "Photo + your overlay", AI_POSTER: "AI-designed poster", PHOTO_ONLY: "Photo only" };

/** GMB profile: which admin-made image style this client's posts use. */
export function ImageStyleCard({ clientId }) {
  const styles = useApi("/api/image-styles");
  const current = useApi(`/api/clients/${clientId}/image-style`);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const items = styles.data?.items || [];
  const sel = current.data ? current.data.style_id : undefined;
  async function pick(id) {
    setBusy(id ?? "def");
    setErr("");
    try {
      current.mutate(await apiFetch(`/api/clients/${clientId}/image-style`, { method: "PUT", body: { style_id: id } }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }
  if (!items.length) return null;
  const def = items.find((s) => s.is_default);
  const options = [{ id: null, name: `Platform default${def ? ` (${def.name})` : ""}`, description: "Follows whatever style the platform sets as default.", mode: def?.mode }, ...items];
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/30"><ImageIcon className="h-5 w-5" /></span>
        <div>
          <p className="font-semibold text-zinc-900 dark:text-white">Post image style</p>
          <p className="text-xs text-zinc-500">How AI images are made for this profile. You can still pick another style for a single post while reviewing it.</p>
        </div>
      </div>
      {err ? <Alert className="mb-3">{err}</Alert> : null}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {options.map((s) => {
          const on = (sel ?? null) === s.id;
          return (
            <button key={s.id ?? "def"} type="button" onClick={() => pick(s.id)} disabled={busy !== null || sel === undefined}
              className={`relative rounded-xl border-2 p-3 text-left transition ${on ? "border-brand-500 bg-brand-50/40 dark:bg-brand-950/10" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"}`}>
              {s.preview_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.preview_url} alt="" className="mb-2 aspect-[4/3] w-full rounded-lg object-cover" />
              ) : null}
              <p className="pr-6 text-sm font-semibold">{s.name}</p>
              {s.mode ? <Badge className="mt-1">{MODE[s.mode]}</Badge> : null}
              <p className="mt-1 text-[11px] leading-4 text-zinc-500">{s.description}</p>
              {on ? <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-brand-500" /> : busy === (s.id ?? "def") ? <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin" /> : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
