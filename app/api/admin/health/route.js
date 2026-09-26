import { route } from "@/lib/saas/routeKit.js";
import { runHealthChecks, healthHistory, LABELS } from "@/lib/system/health.js";
import { heartbeats } from "@/lib/system/heartbeat.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = route({ superAdmin: true }, async ({ request }) => {
  const only = new URL(request.url).searchParams.get("only");
  const report = await runHealthChecks({ only: only ? only.split(",") : null, save: !only, runBy: "admin" });
  return { ...report, labels: LABELS, history: await healthHistory(), heartbeats: await heartbeats() };
});
