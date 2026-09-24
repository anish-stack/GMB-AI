"use client";

import { Fragment, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check, X, RefreshCw, Send, Save, AlertTriangle, CheckCircle2, ImageIcon, ArrowLeft, Trash2,
} from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, ScoreRing, Select, Textarea } from "@/components/ui";
import { StatusBadge, MockBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/utils";
import { POST_TYPES, IMAGE_REGEN_LIMIT } from "@/lib/constants";

const CHECK_LABELS = {
  business_accuracy: "Business verified",
  service_accuracy: "Service verified",
  keyword_relevance: "Keyword verified",
  location_relevance: "Location verified",
  grammar: "Grammar checked",
  cta: "Call to action present",
  keyword_stuffing: "Keyword stuffing",
  keyword_coverage: "Keyword used in text",
  duplicate_risk: "Duplicate risk",
  unsupported_claims: "Unsupported claims",
};
const NEGATIVE = ["keyword_stuffing", "duplicate_risk", "unsupported_claims"];

export function TaskReview({ task: initial, backHref = "/gmb/tasks", backLabel = "Back to queue", toolbar = null }) {
  const router = useRouter();
  const [task, setTask] = useState(initial);
  const [form, setForm] = useState({
    title: initial.title || "",
    description: initial.description || "",
    cta: initial.cta || "",
    primary_keyword: initial.primary_keyword || "",
    hashtags: (initial.hashtags || []).join(" "),
    post_type: initial.post_type || "Service",
    topic: initial.topic || "",
    image_concept: initial.image_concept || "",
    image_url: initial.image_url || "",
    scheduled_date: initial.scheduled_date || "",
  });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const review = task.review;
  const checks = review?.checks || {};
  const dirty =
    form.title !== (task.title || "") ||
    form.description !== (task.description || "") ||
    form.cta !== (task.cta || "") ||
    form.primary_keyword !== (task.primary_keyword || "") ||
    form.hashtags !== (task.hashtags || []).join(" ") ||
    form.post_type !== (task.post_type || "Service") ||
    form.topic !== (task.topic || "") ||
    form.image_concept !== (task.image_concept || "") ||
    form.image_url !== (task.image_url || "") ||
    form.scheduled_date !== (task.scheduled_date || "");

  const fields = () => ({
    title: form.title,
    description: form.description,
    cta: form.cta,
    primary_keyword: form.primary_keyword,
    hashtags: form.hashtags.split(/\s+/).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`)),
    post_type: form.post_type,
    topic: form.topic,
    image_concept: form.image_concept,
    image_url: form.image_url,
    scheduled_date: form.scheduled_date || null,
  });

  async function act(action, extra = {}, busyKey = action) {
    setBusy(busyKey);
    setNotice(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      if (data.task) {
        setTask(data.task);
        setForm({
          title: data.task.title || "",
          description: data.task.description || "",
          cta: data.task.cta || "",
          primary_keyword: data.task.primary_keyword || "",
          hashtags: (data.task.hashtags || []).join(" "),
          post_type: data.task.post_type || "Service",
          topic: data.task.topic || "",
          image_concept: data.task.image_concept || "",
          image_url: data.task.image_url || "",
          scheduled_date: data.task.scheduled_date || "",
        });
      }
      if (action === "publish") {
        setNotice({
          tone: "success",
          text: `Published ${formatDate(new Date(), true)} to ${task.business_name}${task.city ? " - " + task.city : ""}`,
          mock: data.published?.is_mock,
        });
      } else if (action === "update_post") {
        setNotice({ tone: "success", text: "Live post updated on Google.", mock: data.updated?.is_mock });
      } else if (action === "delete_post") {
        setNotice({ tone: "success", text: "Post deleted from Google.", mock: data.deleted?.is_mock });
      } else if (action === "regenerate_image") {
        setNotice({ tone: "success", text: "Image regenerated." });
      } else if (action === "generate_image_options") {
        setNotice({ tone: "success", text: `${data.candidates?.length || 0} image option(s) ready - pick one below.` });
      } else if (action === "select_image") {
        setNotice({ tone: "success", text: "Image selected. The other options were deleted." });
      } else {
        setNotice({ tone: "success", text: `${action} done` });
      }
      router.refresh();
    } catch (err) {
      setNotice({ tone: "error", text: err.message });
    } finally {
      setBusy("");
    }
  }

  async function uploadImage(file) {
    if (!file) return;
    setUploadingImage(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("taskId", task.id);
      const res = await fetch(`/api/tasks/${task.id}/image`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setTask(data.task);
      setForm((f) => ({ ...f, image_url: data.task.image_url || "" }));
      setNotice({ tone: "success", text: "Image replaced with your upload" });
      router.refresh();
    } catch (err) {
      setNotice({ tone: "error", text: err.message });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const canPublish = ["APPROVED", "PUBLISHED"].includes(task.status);
  const isPublished = task.status === "PUBLISHED";
  const isPostDeleted = task.status === "POST_DELETED";
  const livePostRemoved = task.post?.status === "DELETED";

  async function deleteLivePost() {
    if (!window.confirm("Delete this post from Google Business Profile? This cannot be undone.")) return;
    await act("delete_post");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-300">
            <ArrowLeft className="h-3 w-3" /> {backLabel}
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{task.business_name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {task.city} &middot; {task.business_category} &middot; task #{task.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={task.status} />
          <Badge>{task.post_type}</Badge>
          {task.published_at ? <MockBadge>Mock publish</MockBadge> : null}
        </div>
      </div>

      {toolbar}

      {notice ? (
        <div className={notice.tone === "error"
          ? "rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
          : "rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200"}>
          {notice.tone === "error" ? notice.text : (
            <div>
              <p className="font-medium">Published</p>
              <p className="text-xs">{notice.text}</p>
              {notice.mock ? <p className="mt-1 text-xs font-medium">Prototype / mock publishing - this post was not sent to Google.</p> : null}
            </div>
          )}
        </div>
      ) : null}

      {isPostDeleted ? (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          <p className="font-medium">Post deleted from Google</p>
          <p className="mt-1 text-xs">This post was removed from Google Business Profile and can no longer be edited or re-published from here.</p>
        </div>
      ) : null}

      {task.status === "FAILED" && task.error_message ? (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          <p className="font-medium">AI generation failed</p>
          <p className="mt-1 text-xs">{task.error_message}</p>
          <Button variant="secondary" className="mt-2" onClick={() => act("regenerate")} disabled={busy === "regenerate"}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Post content" subtitle={`Topic: ${task.topic || "-"}`} />
            <CardBody className="space-y-3">
              <Field label="Title">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Description">
                <Textarea
                  className="min-h-44"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Primary keyword">
                  <Input value={form.primary_keyword} onChange={(e) => setForm({ ...form, primary_keyword: e.target.value })} />
                </Field>
                <Field label="Call to action">
                  <Input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} />
                </Field>
              </div>
              <Field label="Hashtags" hint="Space separated">
                <Input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} />
              </Field>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300"
              >
                {showAdvanced ? "Hide advanced fields" : "Edit post type, topic, image & schedule"}
              </button>

              {showAdvanced ? (
                <div className="grid gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 sm:grid-cols-2">
                  <Field label="Post type">
                    <Select value={form.post_type} onChange={(e) => setForm({ ...form, post_type: e.target.value })}>
                      {POST_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="Scheduled date">
                    <Input
                      type="date"
                      value={form.scheduled_date ? String(form.scheduled_date).slice(0, 10) : ""}
                      onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                    />
                  </Field>
                  <Field label="Topic" className="sm:col-span-2">
                    <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
                  </Field>
                  <Field label="Image concept" hint="Brief the AI used to generate the image" className="sm:col-span-2">
                    <Textarea value={form.image_concept} onChange={(e) => setForm({ ...form, image_concept: e.target.value })} />
                  </Field>
                  <Field label="Image URL" hint="Paste a direct image link to replace the generated one" className="sm:col-span-2">
                    <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
                  </Field>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                {isPublished ? (
                  <>
                    <Button variant="secondary" onClick={() => act("update_post", { fields: fields() })} disabled={!dirty || busy || livePostRemoved}>
                      <Save className="h-3.5 w-3.5" /> {busy === "update_post" ? "Updating..." : "Update live post"}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={deleteLivePost}
                      disabled={busy || livePostRemoved}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {livePostRemoved ? "Already deleted" : "Delete live post"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" onClick={() => act("edit", { fields: fields() })} disabled={!dirty || busy || isPostDeleted}>
                      <Save className="h-3.5 w-3.5" /> Save edits
                    </Button>
                    <Button variant="success" onClick={() => act("approve", dirty ? { fields: fields() } : {})} disabled={busy || isPostDeleted}>
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button variant="secondary" onClick={() => act("regenerate")} disabled={busy || isPostDeleted}>
                      <RefreshCw className={busy === "regenerate" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Regenerate
                    </Button>
                    <Button variant="danger" onClick={() => act("reject", { reason: "Rejected by employee" })} disabled={busy || isPostDeleted}>
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button onClick={() => act("publish")} disabled={busy || !canPublish || isPostDeleted} title={canPublish ? "" : "Approve the post first"}>
                      <Send className="h-3.5 w-3.5" /> Publish to GMB
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isPublished
                  ? "This post is live on Google - edits and the delete button here are pushed straight to GMB."
                  : isPostDeleted
                  ? "This post was deleted from Google and can no longer be edited or re-published from here."
                  : "Approve the post, then publish it to GMB."}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="AI research and keywords" subtitle="What the agents used to write this post" />
            <CardBody className="space-y-3 text-sm">
              {task.research ? (
                <>
                  <p className="text-zinc-700 dark:text-zinc-300">{task.research.summary}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{task.research.local_context}</p>
                </>
              ) : <p className="text-zinc-500 dark:text-zinc-400">No research stored.</p>}

              {task.keyword_data ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(task.keyword_data).map(([group, list]) => (
                    <div key={group}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {group.replaceAll("_", " ")}
                      </p>
                      <ul className="space-y-1">
                        {(list || []).map((k) => (
                          <li key={k.keyword} className="rounded border border-zinc-200 dark:border-zinc-800 px-2 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-zinc-700 dark:text-zinc-300">{k.keyword}</span>
                              <Badge tone="blue">AI suggested</Badge>
                            </div>
                            {k.reason ? <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{k.reason}</p> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                No search-volume source is connected, so all keyword suggestions are labelled AI suggested.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="AI execution log" subtitle="Every agent call for this task" />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    {["Agent", "Provider", "Model", "Tokens", "Duration", "Status"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(task.executions || []).map((e) => (
                    <Fragment key={e.id}>
                    <tr>
                      <td className="px-4 py-1.5 font-medium text-zinc-700 dark:text-zinc-300">{e.agent}</td>
                      <td className="px-4 py-1.5 text-zinc-600 dark:text-zinc-400">{e.provider}</td>
                      <td className="px-4 py-1.5 text-zinc-500 dark:text-zinc-400">{e.model}</td>
                      <td className="px-4 py-1.5 text-zinc-600 dark:text-zinc-400">{(e.input_tokens || 0) + " / " + (e.output_tokens || 0)}</td>
                      <td className="px-4 py-1.5 text-zinc-600 dark:text-zinc-400">{e.duration_ms} ms</td>
                      <td className="px-4 py-1.5">
                        <Badge tone={e.status === "SUCCESS" ? "emerald" : e.status === "FAILED" ? "red" : "amber"}>{e.status}</Badge>
                      </td>
                    </tr>
                    {e.status !== "SUCCESS" && e.error ? (
                      <tr>
                        <td colSpan={6} className="bg-red-50 px-4 py-1.5 text-[11px] text-red-700">{e.error}</td>
                      </tr>
                    ) : null}
                    </Fragment>
                  ))}
                  {!task.executions?.length ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">No AI calls recorded.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="AI quality check" subtitle={review ? `Reviewed ${formatDate(review.created_at, true)}` : "Not reviewed yet"} />
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <ScoreRing score={task.qa_score || 0} />
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {task.qa_score >= 80 ? "Ready for employee review" : "Needs human review"}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Similarity to previous posts: {(Number(task.duplicate_score || 0) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              <ul className="space-y-1 text-xs">
                {Object.entries(checks).map(([key, value]) => {
                  const good = NEGATIVE.includes(key) ? !value : value;
                  return (
                    <li key={key} className="flex items-center gap-2">
                      {good ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                      <span className={good ? "text-zinc-600 dark:text-zinc-400" : "text-amber-700"}>{CHECK_LABELS[key] || key}</span>
                    </li>
                  );
                })}
              </ul>

              {review?.issues?.length ? (
                <div className="rounded bg-red-50 p-2 text-xs text-red-700">
                  <p className="font-medium">Issues</p>
                  <ul className="mt-1 list-disc pl-4">{review.issues.map((i, n) => <li key={n}>{i}</li>)}</ul>
                </div>
              ) : null}
              {review?.warnings?.length ? (
                <div className="rounded bg-amber-50 p-2 text-xs text-amber-800">
                  <p className="font-medium">Warnings</p>
                  <ul className="mt-1 list-disc pl-4">{review.warnings.map((i, n) => <li key={n}>{i}</li>)}</ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Image"
              subtitle={task.image_provider ? `${task.image_provider}${task.image_storage_provider ? ` \u00b7 stored on ${task.image_storage_provider}` : ""}` : null}
            />
            <CardBody className="space-y-2">
              {task.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={task.image_url} alt="Generated GMB post visual" className="w-full rounded border border-zinc-200 dark:border-zinc-800" />
              ) : (
                <div className="flex h-40 items-center justify-center rounded border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400">
                  <ImageIcon className="mr-2 h-4 w-4" /> No image
                </div>
              )}
              {task.image_provider === "placeholder" || !task.image_url ? (
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  {task.image_provider === "placeholder"
                    ? "Placeholder shown - AI image generation failed. The image row in the AI execution log below has the exact reason (wrong model, no credits on the provider, or timeout)."
                    : "No image was generated."}{" "}
                  Upload one manually below to fix this task without waiting on the AI provider.
                </p>
              ) : null}
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{task.image_concept}</p>

              {task.imageCandidates?.length ? (
                <div className="space-y-1.5 rounded border border-indigo-200 bg-indigo-50/60 p-2 dark:border-indigo-900 dark:bg-indigo-950/30">
                  <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300">
                    {task.imageCandidates.length} option{task.imageCandidates.length === 1 ? "" : "s"} waiting for a pick -
                    everything else gets deleted from storage once you choose.
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {task.imageCandidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => act("select_image", { candidateId: c.id }, `select_${c.id}`)}
                        disabled={Boolean(busy)}
                        className="group relative overflow-hidden rounded border border-zinc-200 dark:border-zinc-800 disabled:opacity-60"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.url} alt={`Option ${c.id}`} className="aspect-[4/3] w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[11px] font-medium text-white opacity-0 group-hover:opacity-100">
                          {busy === `select_${c.id}` ? "Using..." : "Use this"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {!isPublished ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => act("regenerate_image")}
                      disabled={busy || (task.image_regen_count || 0) >= IMAGE_REGEN_LIMIT}
                    >
                      <RefreshCw className={busy === "regenerate_image" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                      {busy === "regenerate_image" ? "..." : "Regenerate"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => act("generate_image_options", { count: 3 })}
                      disabled={Boolean(busy)}
                    >
                      <ImageIcon className={busy === "generate_image_options" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                      {busy === "generate_image_options" ? "..." : "Generate 3 options"}
                    </Button>
                  </div>
                  <p className="text-center text-[11px] text-zinc-400">
                    {(task.image_regen_count || 0) >= IMAGE_REGEN_LIMIT
                      ? `Regeneration limit reached (${IMAGE_REGEN_LIMIT}/${IMAGE_REGEN_LIMIT}) for this post - upload your own image instead.`
                      : `${IMAGE_REGEN_LIMIT - (task.image_regen_count || 0)} AI regeneration${IMAGE_REGEN_LIMIT - (task.image_regen_count || 0) === 1 ? "" : "s"} left. "Generate options" doesn't count against this.`}
                  </p>
                </>
              ) : null}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => uploadImage(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant={task.image_provider === "placeholder" || !task.image_url ? "primary" : "secondary"}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || livePostRemoved}
                className="w-full"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {uploadingImage ? "Uploading..." : task.image_url ? "Replace with my own image" : "Upload an image"}
              </Button>
              <p className="text-center text-[11px] text-zinc-400">
                PNG, JPEG or WebP, up to 8 MB.{" "}
                {isPublished
                  ? livePostRemoved
                    ? "This post was deleted from Google - upload won't reach it."
                    : "Uploading here pushes straight to your live GMB post."
                  : "Saved to this task immediately."}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <CardBody className="space-y-2 text-xs">
              {(task.timeline || []).map((t) => (
                <div key={t.id} className="flex justify-between gap-2 border-l-2 border-zinc-200 dark:border-zinc-800 pl-2">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{t.action}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">{t.user_name} &middot; {formatDate(t.created_at, true)}</span>
                </div>
              ))}
              {!task.timeline?.length ? <p className="text-zinc-500 dark:text-zinc-400">No employee actions yet.</p> : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
