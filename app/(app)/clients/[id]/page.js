import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/repo/clients.js";
import { Card, CardBody, CardHeader, Table, Badge, EmptyRow } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { GenerateNow } from "@/components/generate-now";
import { PostingPlanCard } from "@/components/posting/plan-usage";
import { ClientForm } from "@/components/client-form";
import { GoogleConnect } from "@/components/google-connect";
import { DangerActions } from "@/components/danger-actions";
import { formatDate, truncate } from "@/lib/utils";
import { listEmployeesForAssignment } from "@/lib/repo/employees.js";
import { requireTenantContext } from "@/lib/saas/context.js";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params, searchParams }) {
  const ctx = await requireTenantContext();
  const { id } = await params;
  const sp = await searchParams;
  const client = await getClient(Number(id), ctx.tenantId);
  if (!client) notFound();

  if (sp?.edit) {
    const employees = await listEmployeesForAssignment(ctx.tenantId);
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Edit {client.business_name}</h1>
        <ClientForm client={JSON.parse(JSON.stringify(client))} employees={employees} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{client.business_name}</h1>
            {!client.active ? <Badge tone="red">Deactivated</Badge> : null}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {client.business_category} &middot; {[client.address, client.city, client.state].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/clients/${client.id}?edit=1`} className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">Edit details</Link>
          <Link href={`/gmb/${client.id}`} className="text-xs font-medium text-[#F53236] dark:text-brand-400 hover:text-[#e81d22] dark:hover:text-brand-300">GMB profile</Link>
          <GenerateNow clientId={client.id} />
          <DangerActions
            patchUrl={`/api/clients/${client.id}`}
            deleteUrl={`/api/clients/${client.id}`}
            active={!!client.active}
            redirectTo="/clients"
            deleteLabel="Delete client"
            deleteConfirm="This permanently deletes the client and all its GMB profile, posts, tasks and keywords. Continue?"
          />
        </div>
      </div>

      <PostingPlanCard clientId={client.id} canEdit={ctx.can("client.edit")} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Business details" />
          <CardBody className="space-y-1.5 text-sm">
            <Row label="Phone" value={client.phone} />
            <Row label="Website" value={client.website} />
            <Row label="Tone" value={client.content_tone} />
            <Row label="Language" value={client.preferred_language} />
            <Row label="Frequency" value={client.posting_frequency} />
            <Row label="GMB location" value={client.gmb_location_id} />
            <Row label="Connection" value={client.gmb_connection_status} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Services" subtitle={`${client.services.length} verified services`} />
          <CardBody className="flex flex-wrap gap-1.5">
            {client.services.map((s) => <Badge key={s.id} tone="indigo">{s.name}</Badge>)}
            {!client.services.length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No services added.</p> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Target locations" />
          <CardBody className="flex flex-wrap gap-1.5">
            {client.locations.map((l) => <Badge key={l.id}>{l.name}</Badge>)}
            {!client.locations.length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No locations added.</p> : null}
          </CardBody>
        </Card>
      </div>

      <GoogleConnect client={JSON.parse(JSON.stringify({
        id: client.id,
        google_email: client.google_email,
        google_location_name: client.google_location_name,
        google_connected_at: client.google_connected_at,
      }))} />

      <Card>
        <CardHeader title="Keywords" subtitle="Client keywords plus AI suggestions (no search-volume source connected)" />
        <Table head={["Keyword", "Type", "Source", "Relevance", "Priority", "Reason"]}
          empty={!client.keywords.length ? <EmptyRow colSpan={6}>No keywords yet.</EmptyRow> : null}>
          {client.keywords.map((k) => (
            <tr key={k.id}>
              <td className="px-4 py-2 text-zinc-800 dark:text-zinc-100">{k.keyword}</td>
              <td className="px-4 py-2"><Badge>{k.kw_type}</Badge></td>
              <td className="px-4 py-2">
                <Badge tone={k.source === "CLIENT" ? "emerald" : "blue"}>{k.source === "CLIENT" ? "Client" : "AI suggested"}</Badge>
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{k.relevance_score}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{k.priority}</td>
              <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{truncate(k.reason, 70)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="AI tasks" />
          <Table head={["Topic", "Status", "Score", "Updated"]}
            empty={!client.tasks.length ? <EmptyRow colSpan={4}>No AI tasks yet.</EmptyRow> : null}>
            {client.tasks.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                <td className="px-4 py-2">
                  <Link href={`/gmb/tasks/${t.id}`} className="text-zinc-700 dark:text-zinc-300 hover:text-[#F53236] dark:text-brand-400">{truncate(t.topic, 34) || "-"}</Link>
                </td>
                <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{t.qa_score ?? "-"}</td>
                <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(t.updated_at, true)}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card>
          <CardHeader title="Published posts" subtitle="Mock publishing history" />
          <Table head={["Title", "Type", "Published"]}
            empty={!client.posts.length ? <EmptyRow colSpan={3}>Nothing published yet.</EmptyRow> : null}>
            {client.posts.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{truncate(p.title, 44)}</td>
                <td className="px-4 py-2"><Badge>{p.post_type}</Badge></td>
                <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(p.published_at, true)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="truncate text-right text-zinc-800 dark:text-zinc-100">{value || "-"}</span>
    </div>
  );
}
