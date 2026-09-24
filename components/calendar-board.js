"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Sparkles, Calendar, ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { POST_TYPES } from "@/lib/constants";

const TYPE_COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", ring: "ring-blue-200 dark:ring-blue-900" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-200 dark:ring-emerald-900" },
  { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-200 dark:ring-amber-900" },
  { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", ring: "ring-rose-200 dark:ring-rose-900" },
  { bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", ring: "ring-violet-200 dark:ring-violet-900" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300", ring: "ring-cyan-200 dark:ring-cyan-900" },
];
const DONUT_HEX = ["#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4"];

function colorFor(type) {
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  return TYPE_COLORS[h % TYPE_COLORS.length];
}
function toISO(d) { return d.toISOString().slice(0, 10); }
function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function fmtMonth(d) { return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }); }

export function CalendarBoard({ entries, clients }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); });
  const [selected, setSelected] = useState(() => toISO(new Date()));
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    client_id: clients[0]?.id || "",
    scheduled_date: toISO(new Date()),
    post_type: "Service",
    topic: "",
  });

  const byDate = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      const key = String(e.scheduled_date).slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(e);
    }
    return m;
  }, [entries]);

  const monthEntries = useMemo(() => {
    const mk = monthKey(cursor);
    return entries.filter((e) => String(e.scheduled_date).slice(0, 7) === mk);
  }, [entries, cursor]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const typeCounts = useMemo(() => {
    const m = new Map();
    for (const e of monthEntries) m.set(e.post_type, (m.get(e.post_type) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [monthEntries]);

  const totalMonth = monthEntries.length;

  function donutGradient() {
    if (!totalMonth) return undefined;
    let acc = 0;
    const stops = typeCounts.map(([, c], i) => {
      const from = acc * 360;
      acc += c / totalMonth;
      return `${DONUT_HEX[i % DONUT_HEX.length]} ${from}deg ${acc * 360}deg`;
    });
    return `conic-gradient(${stops.join(",")})`;
  }

  async function addEntry(e) {
    e.preventDefault();
    setBusy("add"); setMsg("");
    const res = await fetch("/api/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    setBusy("");
    if (!res.ok) return setMsg(data.error);
    setShowAdd(false);
    setForm({ ...form, topic: "" });
    router.refresh();
  }

  async function removeEntry(id) {
    await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function runDay(date) {
    setBusy(date); setMsg("");
    const res = await fetch("/api/ai/nightly", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date }) });
    const data = await res.json();
    setBusy("");
    setMsg(data.error || `${date}: ${data.generated}/${data.scheduled} generated, ${data.ready} ready, ${data.needsReview} need review`);
    router.refresh();
  }

  const selectedEntries = byDate.get(selected) || [];
  const todayISO = toISO(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-md border border-zinc-200 dark:border-zinc-800 p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[170px] text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">{fmtMonth(cursor)}</span>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-md border border-zinc-200 dark:border-zinc-800 p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(todayISO); }}
            className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Today
          </button>
        </div>
        <Button onClick={() => { setForm((f) => ({ ...f, scheduled_date: selected })); setShowAdd(true); }}>
          <Plus className="h-3.5 w-3.5" /> Add Post
        </Button>
      </div>

      {msg ? <p className="rounded-md bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">{msg}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((d, i) => {
              const iso = toISO(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const dayEntries = byDate.get(iso) || [];
              const isToday = iso === todayISO;
              const isSelected = iso === selected;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(iso)}
                  className={`min-h-[92px] border-b border-r border-zinc-100 dark:border-zinc-800/70 p-1.5 text-left align-top transition-colors
                    ${inMonth ? "bg-white dark:bg-zinc-950" : "bg-zinc-50/60 dark:bg-zinc-900/30"}
                    ${isSelected ? "ring-2 ring-inset ring-[#F53236]" : ""}
                    hover:bg-zinc-50 dark:hover:bg-zinc-900`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs
                      ${isToday ? "bg-[#F53236] text-white font-semibold" : inMonth ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-300 dark:text-zinc-700"}`}>
                      {d.getDate()}
                    </span>
                    {dayEntries.length > 0 ? <span className="text-[10px] font-medium text-zinc-400">{dayEntries.length}</span> : null}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEntries.slice(0, 2).map((e) => {
                      const c = colorFor(e.post_type);
                      return <div key={e.id} className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>{e.business_name}</div>;
                    })}
                    {dayEntries.length > 2 ? <div className="text-[10px] text-zinc-400">+{dayEntries.length - 2} more</div> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/40 text-[#F53236]">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Total posts this month</p>
                <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{totalMonth}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Post type" />
            <CardBody>
              {totalMonth ? (
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 shrink-0 rounded-full" style={{ backgroundImage: donutGradient() }}>
                    <div className="absolute inset-[10px] rounded-full bg-white dark:bg-zinc-950" />
                  </div>
                  <ul className="space-y-1.5">
                    {typeCounts.map(([t, c], i) => (
                      <li key={t} className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ background: DONUT_HEX[i % DONUT_HEX.length] }} />
                        <span className="text-zinc-600 dark:text-zinc-300">{t}</span>
                        <span className="ml-auto font-medium text-zinc-400">{Math.round((c / totalMonth) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <p className="text-xs text-zinc-400">No posts this month yet.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Quick actions" />
            <CardBody className="space-y-2">
              <Button className="w-full justify-center" onClick={() => runDay(selected)} disabled={busy === selected}>
                {busy === selected ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Run AI job ({selected})
              </Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => { setForm((f) => ({ ...f, scheduled_date: selected })); setShowAdd(true); }}>
                <Plus className="h-3.5 w-3.5" /> Add post to this day
              </Button>
            </CardBody>
          </Card>

          <div className="rounded-lg border border-rose-100 dark:border-rose-950 bg-rose-50/60 dark:bg-rose-950/20 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#F53236]"><Sparkles className="h-3.5 w-3.5" /> Tip</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Keep your posts consistent for better engagement and visibility.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          title={new Date(selected + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          subtitle={`${selectedEntries.length} scheduled`}
        />
        <CardBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {selectedEntries.map((e) => {
            const c = colorFor(e.post_type);
            return (
              <div key={e.id} className={`rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5 ring-1 ${c.ring}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{e.business_name}</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{e.topic || "AI will choose topic"}</p>
                  </div>
                  <Badge tone={e.status === "GENERATED" ? "emerald" : "slate"}>{e.status}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>{e.post_type}</span>
                  <div className="flex items-center gap-2">
                    {e.task_id ? <Link href={`/gmb/tasks/${e.task_id}`} className="text-xs font-medium text-[#F53236] hover:text-[#e81d22]">View task</Link> : null}
                    {e.status === "SCHEDULED" ? (
                      <button onClick={() => removeEntry(e.id)} className="text-zinc-400 hover:text-red-600" aria-label="Remove entry">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {!selectedEntries.length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing scheduled for this day.</p> : null}
        </CardBody>
      </Card>

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-950 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Schedule a post</h3>
              <button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-zinc-600"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={addEntry} className="space-y-3">
              <Field label="Client">
                <Select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                </Select>
              </Field>
              <Field label="Date">
                <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
              </Field>
              <Field label="Post type">
                <Select value={form.post_type} onChange={(e) => setForm({ ...form, post_type: e.target.value })}>
                  {POST_TYPES.map((t) => <option key={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Topic" hint="Leave empty to let the Topic Agent choose">
                <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="AI picks if empty" />
              </Field>
              <Button type="submit" disabled={busy === "add"} className="w-full justify-center">
                {busy === "add" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}