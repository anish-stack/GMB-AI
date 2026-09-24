import { MapPin, Star, MessageSquare, RefreshCcw } from "lucide-react";
import { Card, CardHeader, CardBody, Stat } from "@/components/ui";
import { AdminFilterBar, CountChips, ListFooter } from "@/components/admin/admin-filter-bar";
import { GmbProfileList } from "@/components/admin/gmb-profile-list";
import { readProfileFilters, listAdminProfiles, profileFilterOptions } from "@/lib/repo/adminGmb.js";

export const dynamic = "force-dynamic";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name A-Z" },
  { value: "rating_high", label: "Rating high → low" },
  { value: "rating_low", label: "Rating low → high" },
  { value: "reviews", label: "Most reviews" },
  { value: "posts", label: "Most posts" },
  { value: "last_post", label: "Recent post" },
  { value: "synced", label: "Recently synced" },
];

export default async function AdminGmbProfilesPage({ searchParams }) {
  const sp = await searchParams;
  const f = readProfileFilters(sp);
  const [data, opts] = await Promise.all([listAdminProfiles(f), profileFilterOptions()]);
  const o = (arr) => arr.map((v) => ({ value: v, label: String(v).replaceAll("_", " ") }));

  const fields = [
    { name: "q", label: "Search", type: "text", placeholder: "Location, client, address, phone, email" },
    { name: "tenant", label: "Tenant", type: "select", options: opts.tenants.map((t) => ({ value: String(t.id), label: t.name })) },
    { name: "conn", label: "Connection", type: "select", options: o(opts.conns) },
    { name: "category", label: "Category", type: "select", options: o(opts.categories) },
    { name: "city", label: "City", type: "select", options: o(opts.cities) },
    { name: "provider", label: "Provider", type: "select", advanced: true, options: o(opts.providers) },
    { name: "google", label: "Google account", type: "select", advanced: true, options: [{ value: "yes", label: "Linked" }, { value: "no", label: "Not linked" }] },
    { name: "rating", label: "Min rating", type: "select", advanced: true, allLabel: "Any", options: ["4.5", "4", "3.5", "3", "2"].map((v) => ({ value: v, label: `${v}+` })) },
    { name: "sync", label: "Sync", type: "select", advanced: true, options: [
      { value: "fresh", label: "Synced ≤7 days" }, { value: "stale", label: "Stale >7 days" }, { value: "never", label: "Never synced" },
    ] },
    { name: "posts", label: "Posting", type: "select", advanced: true, options: [
      { value: "yes", label: "Has posts" }, { value: "no", label: "No posts" }, { value: "idle30", label: "Idle 30+ days" },
    ] },
    { name: "active", label: "Client", type: "select", advanced: true, options: [{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }] },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">GMB profiles</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">All Google Business Profiles across tenants - connection, ratings, posting activity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Matching profiles" value={data.total} icon={MapPin} tone="blue" />
        <Stat label="Avg rating" value={data.summary.avgRating ?? "-"} icon={Star} tone="amber" />
        <Stat label="Total reviews" value={data.summary.reviews} icon={MessageSquare} tone="indigo" />
        <Stat label="Never synced" value={data.summary.neverSynced} sub={`${data.summary.published} posts published`} icon={RefreshCcw} tone="red" />
      </div>

      <Card>
        <CardBody>
          <AdminFilterBar fields={fields} storageKey="admin:gmb-profiles:views" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${data.total} profiles`} />
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <CountChips param="conn" counts={data.connCounts} />
        </div>
        <GmbProfileList rows={JSON.parse(JSON.stringify(data.rows))} />
        <ListFooter total={data.total} page={f.page} perPage={f.perPage} sorts={SORTS} />
      </Card>
    </div>
  );
}
