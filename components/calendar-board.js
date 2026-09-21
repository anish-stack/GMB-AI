"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Play, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { POST_TYPES } from "@/lib/constants";

export function CalendarBoard({ days, clients }) {
  const router = useRouter();
  const [form, setForm] = useState({
    client_id: clients[0]?.id || "",
    scheduled_date: new Date().toISOString().slice(0, 10),
    post_type: "Service",
    topic: "",
  });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function addEntry(e) {
    e.preventDefault();
    setBusy("add");
    setMsg("");
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) return setMsg(data.error);
    setForm({ ...form, topic: "" });
    router.refresh();
  }

  async function removeEntry(id) {
    await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function runDay(date) {
    setBusy(date);
    setMsg("");
    const res = await fetch("/api/ai/nightly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const data = await res.json();
    setBusy("");
    setMsg(data.error || `${date}: ${data.generated}/${data.scheduled} generated, ${data.ready} ready, ${data.needsReview} need review`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Schedule a post" subtitle="The nightly AI job picks up every scheduled entry" />
        <CardBody>
          <form onSubmit={addEntry} className="grid gap-3 sm:grid-cols-5">
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
              <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={busy === "add"} className="w-full">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </form>
          {msg ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{msg}</p> : null}
        </CardBody>
      </Card>

      {days.map((day) => (
        <Card key={day.date}>
          <CardHeader
            title={day.label}
            subtitle={`${day.entries.length} scheduled`}
            action={
              <Button variant="secondary" onClick={() => runDay(day.date)} disabled={busy === day.date}>
                <Play className="h-3.5 w-3.5" /> {busy === day.date ? "Running..." : "Run AI job for this day"}
              </Button>
            }
          />
          <CardBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {day.entries.map((e) => (
              <div key={e.id} className="rounded border border-zinc-200 dark:border-zinc-800 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{e.business_name}</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{e.topic || "Topic chosen by AI"}</p>
                  </div>
                  <Badge tone={e.status === "GENERATED" ? "emerald" : "slate"}>{e.status}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge tone="blue">{e.post_type}</Badge>
                  <div className="flex items-center gap-2">
                    {e.task_id ? (
                      <Link href={`/gmb/tasks/${e.task_id}`} className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">View task</Link>
                    ) : null}
                    {e.status === "SCHEDULED" ? (
                      <button onClick={() => removeEntry(e.id)} className="text-zinc-400 dark:text-zinc-500 hover:text-red-600" aria-label="Remove entry">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {!day.entries.length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing scheduled.</p> : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
