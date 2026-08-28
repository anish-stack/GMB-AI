import Link from "next/link";
import { notFound } from "next/navigation";
import { getGMBProvider } from "@/lib/gmb/provider.js";
import { Card, CardBody, CardHeader, Badge, Table, EmptyRow } from "@/components/ui";
import { MockBadge } from "@/components/status-badge";
import { GenerateNow } from "@/components/generate-now";
import { formatDate, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GmbProfilePage({ params }) {
  const { id } = await params;
  const clientId = Number(id);
  const provider = getGMBProvider();

  const [profile, posts, reviews, performance] = await Promise.all([
    provider.getProfile(clientId),
    provider.getPosts(clientId, 15),
    provider.getReviews(clientId),
    provider.getPerformance(clientId, 30),
  ]);
  if (!profile) notFound();

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
            <h1 className="text-lg font-semibold text-slate-900">{profile.business_name}</h1>
            {profile.is_mock ? <MockBadge>Mock GMB connection</MockBadge> : null}
          </div>
          <p className="text-sm text-slate-500">{profile.category} &middot; {profile.address}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/clients/${clientId}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Client record</Link>
          <GenerateNow clientId={clientId} />
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
            {!Object.keys(profile.opening_hours || {}).length ? <p className="text-slate-500">Not set.</p> : null}
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
              <td className="px-4 py-2 text-slate-700">{truncate(p.title, 48)}</td>
              <td className="px-4 py-2"><Badge>{p.post_type}</Badge></td>
              <td className="px-4 py-2"><Badge tone="emerald">{p.status}</Badge></td>
              <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.external_id}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{formatDate(p.published_at, true)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <p className="text-xs text-slate-500">{reviews.note}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="capitalize text-slate-500">{label}</span>
      <span className="truncate text-right text-slate-800">{value || "-"}</span>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded border border-slate-200 py-2">
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
