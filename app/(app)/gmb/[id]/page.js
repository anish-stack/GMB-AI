import Link from "next/link";
import { notFound } from "next/navigation";
import { getGMBProvider } from "@/lib/gmb/provider.js";
import { Card, CardBody, CardHeader, Badge, Table, EmptyRow } from "@/components/ui";
import { MockBadge } from "@/components/status-badge";
import { GenerateNow } from "@/components/generate-now";
import { GmbProfileForm } from "@/components/gmb-profile-form";
import { DangerActions } from "@/components/danger-actions";
import { formatDate, truncate } from "@/lib/utils";
import { one } from "@/lib/db";
import { requireTenantContext } from "@/lib/saas/context.js";

export const dynamic = "force-dynamic";

export default async function GmbProfilePage({ params, searchParams }) {
  const ctx = await requireTenantContext();
  const { id } = await params;
  const sp = await searchParams;
  const clientId = Number(id);
  const owned = await one("SELECT id FROM clients WHERE id=? AND tenant_id=?", [clientId, ctx.tenantId]);
  if (!owned) notFound();
  const provider = getGMBProvider();

  const [profile, posts, reviews, performance, rawProfile] = await Promise.all([
    provider.getProfile(clientId),
    provider.getPosts(clientId, 15),
    provider.getReviews(clientId),
    provider.getPerformance(clientId, 30),
    one("SELECT * FROM gmb_profiles WHERE client_id=? LIMIT 1", [clientId]),
  ]);
  if (!profile) notFound();

  if (sp?.edit) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Edit {profile.business_name}</h1>
        <GmbProfileForm
          clientId={clientId}
          profile={rawProfile ? { ...rawProfile, opening_hours: profile.opening_hours } : { location_name: profile.business_name, category: profile.category, address: profile.address, phone: profile.phone, website: profile.website, opening_hours: profile.opening_hours }}
        />
      </div>
    );
  }

  const totals = performance.series.reduce(
    (acc, r) => ({
      views: acc.views + Number(r.views || 0),
      clicks: acc.clicks + Number(r.clicks || 0),
      calls: acc.calls + Number(r.calls || 0),
    }),
    { views: 0, clicks: 0, calls: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{profile.business_name}</h1>
            {profile.is_mock ? <MockBadge>Mock GMB connection</MockBadge> : null}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{profile.category} &middot; {profile.address}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/clients/${clientId}`} className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">Client record</Link>
          <Link href={`/gmb/${clientId}?edit=1`} className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">Edit profile</Link>
          <GenerateNow clientId={clientId} />
          <DangerActions
            patchUrl={`/api/gmb/${clientId}`}
            deleteUrl={`/api/gmb/${clientId}`}
            active={profile.connection_status !== "DISCONNECTED"}
            redirectTo="/gmb"
            deleteLabel="Remove GMB connection"
            deleteConfirm="This removes the GMB connection for this client. The client record stays. Continue?"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Profile" />
          <CardBody className="space-y-1.5 text-sm">
            <Row label="Phone" value={profile.phone} />
            <Row label="Website" value={profile.website} />
            <Row label="Location id" value={profile.location_id} />
            <Row label="Connection" value={profile.connection_status} />
            <Row label="Rating" value={`${Number(profile.rating).toFixed(1)} (${profile.review_count} reviews)`} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Opening hours" />
          <CardBody className="space-y-1.5 text-sm">
            {Object.entries(profile.opening_hours || {}).map(([k, v]) => (
              <Row key={k} label={k.replaceAll("_", " ")} value={v} />
            ))}
            {!Object.keys(profile.opening_hours || {}).length ? <p className="text-zinc-500 dark:text-zinc-400">Not set.</p> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Performance (30 days)" subtitle={performance.is_mock ? "Prototype metrics" : "Live metrics"} />
          <CardBody className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Views" value={totals.views} />
            <Metric label="Clicks" value={totals.clicks} />
            <Metric label="Calls" value={totals.calls} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Services" />
        <CardBody className="flex flex-wrap gap-1.5">
          {profile.services.map((s) => <Badge key={s} tone="indigo">{s}</Badge>)}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Posts" subtitle={`${posts.length} posts via ${provider.name} provider`} />
        <Table head={["Title", "Type", "Status", "External id", "Published"]}
          empty={!posts.length ? <EmptyRow colSpan={5}>No posts published yet.</EmptyRow> : null}>
          {posts.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{truncate(p.title, 48)}</td>
              <td className="px-4 py-2"><Badge>{p.post_type}</Badge></td>
              <td className="px-4 py-2"><Badge tone="emerald">{p.status}</Badge></td>
              <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">{p.external_id}</td>
              <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(p.published_at, true)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">{reviews.note}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="capitalize text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="truncate text-right text-zinc-800 dark:text-zinc-100">{value || "-"}</span>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 py-2">
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
