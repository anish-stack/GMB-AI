import { requireTenantContext } from "@/lib/saas/context.js";
import { providerInfo } from "@/lib/ai/index.js";
import { storageInfo } from "@/lib/storage/index.js";
import { gmbProviderInfo } from "@/lib/gmb/provider.js";
import { Card, CardBody, CardHeader, Badge } from "@/components/ui";
import { QA_PASS_SCORE, DUPLICATE_THRESHOLD } from "@/lib/constants";
import { FEATURE_KEYS, FEATURE_LABEL, LIMIT_KEYS, LIMIT_LABEL, isUnlimited } from "@/lib/saas/constants.js";
import { AccountForm } from "@/components/account-form";
import { listTenantUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireTenantContext();
  const ai = providerInfo();
  const storage = storageInfo();
  const gmb = gmbProviderInfo();
  const users = await listTenantUsers(ctx.tenantId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your profile, workspace details and what your plan currently allows.
        </p>
      </div>

      <AccountForm
        user={{ name: ctx.session.name, email: ctx.session.email }}
        tenant={JSON.parse(JSON.stringify(ctx.tenant))}
        canEditWorkspace={ctx.can("settings.edit")}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Plan limits" subtitle={`${ctx.plan?.name || "No plan"} · ${ctx.ent.status}`} />
          <CardBody className="space-y-1.5 text-sm">
            {LIMIT_KEYS.map((k) => (
              <Row key={k} label={LIMIT_LABEL[k]} value={isUnlimited(ctx.limits[k]) ? "Unlimited" : String(ctx.limits[k])} />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Features" subtitle="Enabled by your plan or by the platform admin" />
          <CardBody className="space-y-1.5 text-sm">
            {FEATURE_KEYS.map((k) => (
              <div key={k} className="flex justify-between gap-3">
                <span className="text-zinc-500 dark:text-zinc-400">{FEATURE_LABEL[k]}</span>
                <Badge tone={ctx.features[k] ? "emerald" : "slate"}>{ctx.features[k] ? "On" : "Off"}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Workflow rules" />
          <CardBody className="space-y-1.5 text-sm">
            <Row label="QA pass score" value={`${QA_PASS_SCORE} / 100`} />
            <Row label="Duplicate threshold" value={`${(DUPLICATE_THRESHOLD * 100).toFixed(0)}% similarity`} />
            <Row label="Auto publish" value={ctx.features.f_auto_publish ? "Allowed by plan" : "Disabled - a human approves every post"} />
            <Row label="AI provider" value={`${ai.name} / ${ai.textModel}`} />
            <Row label="Image storage" value={storage.primary} />
            <Row label="GMB provider" value={`${gmb.name}${gmb.isMock ? " (mock)" : ""}`} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Workspace users" subtitle={`${users.length} of ${isUnlimited(ctx.limits.max_team_members) ? "unlimited" : ctx.limits.max_team_members}`} />
          <CardBody className="space-y-2 text-sm">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-800 dark:text-zinc-100">{u.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{u.email}</p>
                </div>
                <Badge tone={u.role === "OWNER" ? "indigo" : "slate"}>{u.role}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="truncate text-right font-mono text-xs text-zinc-800 dark:text-zinc-100">{value}</span>
    </div>
  );
}
