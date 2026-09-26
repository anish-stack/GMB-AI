"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Card, Button, Field, Input, Textarea, Select, Alert, Skeleton, Badge, Modal } from "@/components/ui";
import { useApi, apiFetch } from "@/lib/hooks/use-api";
import { formatDate } from "@/lib/utils";

const empty = { slug: "", title: "", content: "", seo_title: "", seo_description: "", status: "DRAFT", show_in_footer: 0, sort_order: 0 };
const publicUrl = (slug) => (["terms", "privacy", "disclaimer"].includes(slug) ? `/${slug}` : `/p/${slug}`);

export function CmsAdmin() {
  const { data, error, loading, reload } = useApi("/api/admin/cms");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function open(id) {
    setMsg("");
    setEdit(id ? { ...(await apiFetch(`/api/admin/cms/${id}`)).page } : { ...empty });
  }
  async function save() {
    setBusy(true);
    setMsg("");
    try {
      if (edit.id) await apiFetch(`/api/admin/cms/${edit.id}`, { method: "PUT", body: edit });
      else await apiFetch("/api/admin/cms", { body: edit });
      setEdit(null);
      reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm("Delete this page?")) return;
    try {
      await apiFetch(`/api/admin/cms/${edit.id}`, { method: "DELETE" });
      setEdit(null);
      reload();
    } catch (e) {
      setMsg(e.message);
    }
  }
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.type === "checkbox" ? (e.target.checked ? 1 : 0) : e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"><FileText className="h-5 w-5" /> CMS pages</h1>
        <Button onClick={() => open(null)}><Plus className="h-4 w-4" /> New page</Button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <Card className="overflow-x-auto">
        {loading && !data ? <Skeleton className="m-4 h-32" /> : (
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-800"><th className="px-4 py-2">Title</th><th>Slug</th><th>Status</th><th>Footer</th><th>Created</th><th>Updated</th></tr></thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(data?.items || []).map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => open(p.id)}>
                  <td className="px-4 py-2.5 font-medium">{p.title}</td>
                  <td className="font-mono text-xs"><a href={publicUrl(p.slug)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="hover:underline">{publicUrl(p.slug)}</a></td>
                  <td><Badge tone={p.status === "PUBLISHED" ? "emerald" : "slate"}>{p.status}</Badge></td>
                  <td className="text-xs">{p.show_in_footer ? "Yes" : "-"}</td>
                  <td className="text-xs text-zinc-500">{formatDate(p.created_at)}</td>
                  <td className="text-xs text-zinc-500">{formatDate(p.updated_at, true)}{p.updated_by ? ` · ${p.updated_by}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? "Edit page" : "New page"} size="lg"
        footer={<>{edit?.id ? <Button variant="dangerGhost" onClick={remove}>Delete</Button> : null}<Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}>
        {edit ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title"><Input value={edit.title} onChange={set("title")} /></Field>
              <Field label="Slug" hint={`URL: ${publicUrl(edit.slug || "slug")}`}><Input value={edit.slug} onChange={set("slug")} /></Field>
            </div>
            <Field label="Content (Markdown: ## heading, - list, **bold**, [link](https://…))"><Textarea value={edit.content || ""} onChange={set("content")} rows={14} className="font-mono text-xs" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="SEO title"><Input value={edit.seo_title || ""} onChange={set("seo_title")} maxLength={200} /></Field>
              <Field label="SEO description"><Input value={edit.seo_description || ""} onChange={set("seo_description")} maxLength={320} /></Field>
              <Field label="Status"><Select value={edit.status} onChange={set("status")}><option value="DRAFT">Draft (unpublished)</option><option value="PUBLISHED">Published</option></Select></Field>
              <Field label="Sort order"><Input type="number" value={edit.sort_order} onChange={set("sort_order")} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(Number(edit.show_in_footer))} onChange={set("show_in_footer")} className="accent-[#F53236]" /> Show link in the public footer</label>
            {msg ? <Alert>{msg}</Alert> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
