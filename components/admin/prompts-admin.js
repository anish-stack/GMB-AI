"use client";

import { useMemo, useState } from "react";
import { Bot, Loader2, RotateCcw, Save, Search } from "lucide-react";
import { Card, Button, Input, Textarea, Alert, Skeleton, Badge } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";

const KIND = { system: ["System prompt", "violet"], extra: ["Extra instructions", "blue"], block: ["Shared block", "amber"] };

function PromptEditor({ item, onSaved }) {
  const [val, setVal] = useState(item.value);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const dirty = val !== item.value;
  async function save() {
    setBusy("save");
    setErr("");
    try {
      await apiFetch("/api/admin/prompts", { method: "PUT", body: { key: item.key, content: val } });
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  async function reset() {
    if (!window.confirm("Go back to the built-in default for this prompt?")) return;
    setBusy("reset");
    try {
      await apiFetch(`/api/admin/prompts?key=${encodeURIComponent(item.key)}`, { method: "DELETE" });
      setVal(item.default);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  const [label, tone] = KIND[item.kind];
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.label}</p>
        <Badge tone={tone}>{label}</Badge>
        {item.overridden ? <Badge tone="emerald">Customised</Badge> : <Badge>Default</Badge>}
        <span className="ml-auto text-[11px] text-zinc-400">{val.length.toLocaleString()} chars{item.updated_by ? ` · edited by ${item.updated_by}` : ""}</span>
      </div>
      <p className="mb-2 text-xs text-zinc-500">{item.help}</p>
      <Textarea rows={item.kind === "extra" ? 4 : Math.min(18, Math.max(5, Math.ceil(val.length / 110)))} value={val} onChange={(e) => setVal(e.target.value)} className="font-mono text-xs leading-5"
        placeholder={item.kind === "extra" ? "e.g. Always mention free home visit. Write in simple Hinglish." : ""} />
      {err ? <Alert className="mt-2">{err}</Alert> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {dirty ? <span className="mr-auto text-xs text-amber-600">Unsaved changes</span> : <span className="mr-auto" />}
        {dirty ? <Button variant="ghost" onClick={() => setVal(item.value)}>Discard</Button> : null}
        {item.overridden ? <Button variant="secondary" onClick={reset} disabled={Boolean(busy)}>{busy === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reset to default</Button> : null}
        <Button onClick={save} disabled={!dirty || Boolean(busy)}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
      </div>
    </div>
  );
}

/** Admin -> AI prompts: every agent's system prompt, extra instructions and shared rule blocks. */
export function PromptsAdmin() {
  const { data, error, loading, reload } = useApi("/api/admin/prompts");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const groups = useMemo(() => [...new Set((data?.items || []).map((i) => i.group))], [data]);
  const active = group || groups[0];
  const items = (data?.items || []).filter((i) => (q ? `${i.group} ${i.label} ${i.value}`.toLowerCase().includes(q.toLowerCase()) : i.group === active));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"><Bot className="h-5 w-5 text-brand-500" /> AI prompts</h1>
          <p className="text-sm text-zinc-500">Edit what every AI agent is told. Changes apply to all workspaces within 30 seconds. Keep the JSON output instructions intact - the app reads them.</p>
        </div>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all prompts" className="pl-9" />
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {loading && !data ? <Skeleton className="h-96" /> : (
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <nav className="space-y-1 lg:sticky lg:top-4 lg:self-start">
            {groups.map((g) => {
              const n = data.items.filter((i) => i.group === g && i.overridden).length;
              return (
                <button key={g} type="button" onClick={() => { setGroup(g); setQ(""); }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium ${!q && active === g ? "bg-brand-500 text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
                  {g}{n ? <span className={`rounded-full px-1.5 text-[10px] ${!q && active === g ? "bg-white/25" : "bg-emerald-100 text-emerald-700"}`}>{n}</span> : null}
                </button>
              );
            })}
          </nav>
          <Card className="space-y-4 p-4 sm:p-5">
            {items.length ? items.map((i) => <PromptEditor key={`${i.key}:${i.updated_at || "d"}:${i.overridden}`} item={i} onSaved={reload} />) : <p className="text-sm text-zinc-500">Nothing matches.</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
