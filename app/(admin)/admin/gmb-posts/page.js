import { Send, CheckCircle2, Gauge, Coins } from "lucide-react";
import { Card, CardHeader, CardBody, Stat } from "@/components/ui";
import { AdminFilterBar, CountChips, ListFooter } from "@/components/admin/admin-filter-bar";
import { GmbPostList } from "@/components/admin/gmb-post-list";
import { readPostFilters, listAdminPosts, postFilterOptions } from "@/lib/repo/adminGmb.js";
import { TASK_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently updated" },
  { value: "scheduled_desc", label: "Scheduled (latest)" },
  { value: "scheduled_asc", label: "Scheduled (earliest)" },
  { value: "published_desc", label: "Recently published" },
  { value: "qa_high", label: "QA high → low" },
  { value: "qa_low", label: "QA low → high" },
  { value: "credits_high", label: "Most credits" },
];

export default async function AdminGmbPostsPage({ searchParams }) {
  const sp = await searchParams;
  const f = readPostFilters(sp);
  const [data, opts] = await Promise.all([listAdminPosts(f), postFilterOptions({ tenant: f.tenant })]);
  const plain = (x) => JSON.parse(JSON.stringify(x));

  const fields = [
    { name: "q", label: "Search", type: "text", placeholder: "Title, topic, keyword, client, #id" },
    { name: "tenant", label: "Tenant", type: "select", options: opts.tenants.map((t) => ({ value: String(t.id), label: t.name })) },
    { name: "client", label: "Client", type: "select", options: opts.clients.map((c) => ({ value: String(c.id), label: c.name })) },
    { name: "status", label: "Status", type: "select", options: Object.keys(TASK_STATUS).map((s) => ({ value: s, label: s.replaceAll("_", " ") })) },
    { name: "type", label: "Post type", type: "select", options: opts.types.map((t) => ({ value: t, label: t })) },
    { name: "qa", label: "QA", type: "select", advanced: true, options: [
      { value: "PASS", label: "Pass (≥80)" }, { value: "REVIEW", label: "Needs review (<80)" }, { value: "NONE", label: "Not scored" },
    ] },
    { name: "image", label: "Image", type: "select", advanced: true, options: [{ value: "yes", label: "Has image" }, { value: "no", label: "No image" }] },
    { name: "publish", label: "Published via", type: "select", advanced: true, options: [
      { value: "mock", label: "Mock" }, { value: "live", label: "Live Google" }, { value: "none", label: "Not published" },
    ] },
    { name: "dup", label: "Duplicates", type: "select", advanced: true, allLabel: "Any", options: [{ value: "yes", label: "Only duplicates" }] },
    { name: "df", label: "Date field", type: "select", advanced: true, allLabel: "Created", options: [
      { value: "scheduled", label: "Scheduled" }, { value: "published", label: "Published" }, { value: "updated", label: "Updated" },
    ] },
    { name: "from", label: "From", type: "date", advanced: true },
    { name: "to", label: "To", type: "date", advanced: true },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">GMB postings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Every GMB post across all tenants and clients - filter, sort and inspect.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Matching posts" value={data.total} icon={Send} tone="blue" />
        <Stat label="Published" value={data.summary.published} icon={CheckCircle2} tone="emerald" />
        <Stat label="Avg QA score" value={data.summary.avgQa ?? "-"} icon={Gauge} tone="indigo" />
        <Stat label="Credits used" value={data.summary.credits} icon={Coins} tone="amber" />
      </div>

      <Card>
        <CardBody>
          <AdminFilterBar fields={fields} storageKey="admin:gmb-posts:views" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${data.total} posts`} subtitle="Click a row to preview · pencil to edit/publish · select rows for bulk actions" action={null} />
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <CountChips param="status" counts={data.statusCounts} />
        </div>
        <GmbPostList rows={plain(data.rows)} />
        <ListFooter total={data.total} page={f.page} perPage={f.perPage} sorts={SORTS} />
      </Card>
    </div>
  );
}
