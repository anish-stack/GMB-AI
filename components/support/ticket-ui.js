"use client";

import { useRef, useState } from "react";
import { Paperclip, Send, X, Loader2 } from "lucide-react";
import { Badge, Button, Textarea } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const STATUS_TONE = { OPEN: "amber", IN_PROGRESS: "indigo", WAITING_FOR_CLIENT: "violet", RESOLVED: "emerald", CLOSED: "slate" };
export const PRIORITY_TONE = { LOW: "slate", MEDIUM: "indigo", HIGH: "amber", URGENT: "red" };
export const label = (s) => String(s || "").replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || "slate"}>{label(status)}</Badge>;
}

export function Thread({ messages }) {
  return (
    <ol className="space-y-3">
      {messages.map((m) => (
        <li key={m.id} className={`rounded-2xl border p-4 ${m.is_internal ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20" : m.author_role === "ADMIN" ? "border-sky-100 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"}`}>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">{m.author_name}{m.author_role === "ADMIN" ? " · Support team" : ""}{m.is_internal ? " · internal note" : ""}</span>
            <span className="text-zinc-400">{formatDate(m.created_at, true)}</span>
          </div>
          <p className="whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-300">{m.body}</p>
          {m.attachments?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {m.attachments.map((a) => (
                <a key={a.key} href={`/api/support/attachments/${a.key}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200">
                  <Paperclip className="h-3 w-3" /> {a.name} <span className="text-zinc-400">{Math.round(a.size / 1024)} KB</span>
                </a>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Message box with attachments; onSend(formData) must throw on error. */
export function Composer({ onSend, placeholder = "Write a reply…", extra = null, disabled = false }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("message", text.trim());
      files.forEach((f) => fd.append("files", f));
      await onSend(fd);
      setText("");
      setFiles([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={placeholder} disabled={disabled} maxLength={10000} />
      {files.length ? (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
              {f.name}
              <button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label="Remove"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" className="hidden"
          onChange={(e) => { setFiles((l) => [...l, ...Array.from(e.target.files || [])].slice(0, 3)); e.target.value = ""; }} />
        <Button type="button" variant="secondary" disabled={disabled || files.length >= 3} onClick={() => input.current?.click()}><Paperclip className="h-4 w-4" /> Attach</Button>
        <span className="text-[11px] text-zinc-400">PNG, JPG, GIF, WEBP, PDF · 5 MB · max 3</span>
        {extra}
        <Button type="button" className="ml-auto" disabled={busy || disabled || !text.trim()} onClick={send}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
        </Button>
      </div>
    </div>
  );
}

export async function postForm(url, fd, method = "POST") {
  const res = await fetch(url, { method, body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || "Request failed");
  return json;
}
