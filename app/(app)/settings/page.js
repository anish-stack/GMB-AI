import { providerInfo } from "@/lib/ai/index.js";
import { gmbProviderInfo } from "@/lib/gmb/provider.js";
import { query } from "@/lib/db";
import { Card, CardBody, CardHeader, Badge } from "@/components/ui";
import { QA_PASS_SCORE, DUPLICATE_THRESHOLD } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ai = providerInfo();
  const gmb = gmbProviderInfo();
  const users = await query("SELECT id,name,email,role,active FROM users ORDER BY id");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Configuration is read from <code className="rounded bg-slate-100 px-1">.env</code>. Keys stay on the server and are never sent to the browser.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="AI provider" subtitle="Swap providers by changing AI_PROVIDER and the model variables" />
          <CardBody className="space-y-1.5 text-sm">
            <Row label="Provider" value={ai.name} />
            <Row label="Text model" value={ai.textModel} />
            <Row label="Embedding model" value={ai.embeddingModel} />
            <Row label="Image model" value={ai.imageModel || "not configured"} />
            <Row label="API key" value={ai.configured ? "configured" : "missing - using deterministic fallback"} />
            <p className="pt-2 text-xs text-slate-500">
              Without HF_API_KEY the app runs on a local deterministic generator so the workflow stays demonstrable.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="GMB provider" subtitle="MockGMBProvider and GoogleGMBProvider share one interface" />
          <CardBody className="space-y-1.5 text-sm">
            <Row label="Provider" value={gmb.name} />
            <Row label="Mode" value={gmb.isMock ? "Mock - nothing is sent to Google" : "Live Google API"} />
            <Row label="Publishing" value={gmb.isMock ? "Simulated locally" : "Real localPosts API"} />
            <p className="pt-2 text-xs text-slate-500">
              Set GMB_PROVIDER=google plus the Google OAuth variables to switch. No other code changes are required.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Workflow rules" />
          <CardBody className="space-y-1.5 text-sm">
            <Row label="QA pass score" value={`${QA_PASS_SCORE} / 100`} />
            <Row label="Duplicate threshold" value={`${(DUPLICATE_THRESHOLD * 100).toFixed(0)}% similarity`} />
            <Row label="Auto publish" value="Disabled - a human must approve every post" />
            <Row label="Nightly cron" value={process.env.NIGHTLY_CRON || "0 0 * * *"} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Users" />
          <CardBody className="space-y-2 text-sm">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between">
                <div>
                  <p className="text-slate-800">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <Badge tone={u.role === "ADMIN" ? "indigo" : "slate"}>{u.role}</Badge>
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
      <span className="text-slate-500">{label}</span>
      <span className="truncate text-right font-mono text-xs text-slate-800">{value}</span>
    </div>
  );
}
