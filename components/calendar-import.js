"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import { Button, Select, Alert, Modal } from "@/components/ui";

/** Bulk-schedule posts from Excel/CSV: date, time, topic, keywords, button. */
export function CalendarImport({ clients = [] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");

  async function send(commit) {
    setBusy(commit ? "save" : "check");
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (clientId) fd.append("client_id", clientId);
      if (commit) fd.append("commit", "1");
      const r = await fetch("/api/calendar/import", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Import failed");
      setRes(j);
      if (j.committed) router.refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => { setOpen(true); setRes(null); setFile(null); setErr(""); }}>
        <FileSpreadsheet className="h-4 w-4" /> Import Excel
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import posts from Excel" size="xl">
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            One row per post: <b>date</b>, time, post type, topic, primary / secondary / tertiary keywords and button.
            Empty topic or keywords = AI agents choose. Posting-plan limits are checked before anything is saved.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/api/calendar/import" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-sky-600 ring-1 ring-inset ring-sky-200 hover:bg-sky-50">
              <Download className="h-3.5 w-3.5" /> Download template
            </a>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="!w-auto">
              <option value="">Client from the &ldquo;client&rdquo; column</option>
              {clients.map((c) => <option key={c.id} value={c.id}>All rows for: {c.business_name}</option>)}
            </Select>
            <input type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setRes(null); }} className="text-xs" />
          </div>
          {err ? <Alert>{err}</Alert> : null}
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!file || Boolean(busy)} onClick={() => send(false)}>
              {busy === "check" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Check file
            </Button>
            <Button disabled={!file || Boolean(busy) || !res || res.summary.invalid > 0 || res.committed} onClick={() => send(true)}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import {res?.summary.valid || ""} posts
            </Button>
          </div>
          {res ? (
            <>
              <Alert tone={res.committed ? "green" : res.summary.invalid ? "red" : "blue"}>
                {res.committed ? `${res.summary.inserted} posts added to the calendar.` : res.summary.invalid ? `${res.summary.invalid} row(s) have errors - fix them in the file and check again. Nothing was saved.` : `${res.summary.valid} rows are valid. Click Import to save them.`}
              </Alert>
              <div className="max-h-80 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="sticky top-0 bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
                    <tr><th className="px-2 py-2">Row</th><th>Client</th><th>Date</th><th>Time</th><th>Type</th><th>Topic</th><th>Primary keyword</th><th>Button</th><th>Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {res.rows.map((r) => (
                      <tr key={r.row} className={r.errors.length ? "bg-rose-50/60 dark:bg-rose-950/20" : ""}>
                        <td className="px-2 py-1.5">{r.row}</td><td>{r.client}</td><td>{r.date || "-"}</td><td>{r.scheduled_time || "-"}</td><td>{r.post_type}</td>
                        <td className="max-w-40 truncate">{r.topic || "AI"}</td><td className="max-w-40 truncate">{r.primary_keyword || "AI"}</td><td>{r.cta || "AI"}</td>
                        <td>{r.errors.length ? <span className="flex items-center gap-1 text-rose-600"><XCircle className="h-3 w-3" />{r.errors.join("; ")}</span> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
