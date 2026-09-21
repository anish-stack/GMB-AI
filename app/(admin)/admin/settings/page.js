import { getSettings } from "@/lib/saas/settings.js";
import { listPlans } from "@/lib/saas/billing.js";
import { SettingsForm } from "@/components/admin/settings-form";
import { providerInfo } from "@/lib/ai/index.js";
import { gmbProviderInfo } from "@/lib/gmb/provider.js";
import { Card, CardBody, CardHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [settings, plans] = await Promise.all([getSettings({ fresh: true }), listPlans({ activeOnly: true })]);
  const ai = providerInfo();
  const gmb = gmbProviderInfo();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Platform settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Stored in the database, so changes apply without a restart. AI keys stay in <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.env</code>.
        </p>
      </div>

      <SettingsForm
        settings={JSON.parse(JSON.stringify({ ...settings, razorpay_key_secret: settings.razorpay_key_secret ? "********" : "" }))}
        plans={JSON.parse(JSON.stringify(plans))}
      />

      <Card>
        <CardHeader title="Runtime providers" subtitle="Read from .env at boot" />
        <CardBody className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="AI provider" value={`${ai.name} (${ai.configured ? "configured" : "local fallback"})`} />
          <Row label="Text model" value={ai.textModel} />
          <Row label="Image model" value={ai.imageModel || "not configured"} />
          <Row label="GMB provider" value={`${gmb.name}${gmb.isMock ? " - mock, nothing reaches Google" : ""}`} />
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="truncate font-mono text-xs text-zinc-800 dark:text-zinc-100">{value}</span>
    </div>
  );
}
