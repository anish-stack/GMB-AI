"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Palette, RotateCcw } from "lucide-react";
import { Card, CardBody, CardHeader, Button, Input, Alert } from "@/components/ui";
import { useThemeColor, PRESETS, DEFAULT_COLOR, palette } from "@/components/theme-color";

/** Settings -> Appearance: pick the panel's accent colour (live preview, saved per workspace). */
export function AppearanceCard({ canEdit }) {
  const router = useRouter();
  const { color, saved, setPreview } = useThemeColor();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const dirty = color.toLowerCase() !== saved.toLowerCase();
  const pick = (c) => /^#[0-9a-f]{6}$/i.test(c) && setPreview(c);

  async function save(c) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/theme", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color: c }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setPreview(null);
      setMsg({ tone: "green", text: "Colour saved for everyone in this workspace." });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "red", text: e.message });
    } finally {
      setBusy(false);
    }
  }
  const shades = palette(color);

  return (
    <Card>
      <CardHeader title="Appearance" subtitle="Panel colour for your whole workspace - buttons, highlights and links" />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((c) => (
            <button key={c} type="button" onClick={() => pick(c)} disabled={!canEdit} aria-label={`Use ${c}`}
              className="relative h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-white transition hover:scale-110 disabled:opacity-50 dark:ring-offset-zinc-900"
              style={{ background: c, "--tw-ring-color": color.toLowerCase() === c.toLowerCase() ? c : "transparent" }}>
              {color.toLowerCase() === c.toLowerCase() ? <Check className="absolute inset-0 m-auto h-4 w-4 text-white" /> : null}
            </button>
          ))}
          <label className="flex items-center gap-2 rounded-full border border-zinc-200 py-1 pl-1 pr-3 dark:border-zinc-700">
            <input type="color" value={color} onChange={(e) => pick(e.target.value)} disabled={!canEdit} className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0" />
            <Input value={color} onChange={(e) => pick(e.target.value)} disabled={!canEdit} className="!h-7 !w-24 !border-0 !p-0 !shadow-none !ring-0" />
          </label>
        </div>
        <div className="flex overflow-hidden rounded-xl">
          {Object.entries(shades).map(([k, v]) => <div key={k} className="h-8 flex-1" style={{ background: v }} title={`brand-${k} ${v}`} />)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!canEdit || !dirty || busy} onClick={() => save(color)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />} Save colour</Button>
          {dirty ? <Button variant="ghost" onClick={() => setPreview(null)}>Cancel preview</Button> : null}
          <Button variant="ghost" disabled={!canEdit || busy || saved.toLowerCase() === DEFAULT_COLOR.toLowerCase()} onClick={() => save(null)}><RotateCcw className="h-4 w-4" /> Default</Button>
          <span className="text-xs text-zinc-500">{dirty ? "Previewing - not saved yet" : "Live across the panel"}</span>
        </div>
        {!canEdit ? <p className="text-xs text-zinc-400">Only the workspace owner / manager can change the colour.</p> : null}
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      </CardBody>
    </Card>
  );
}
