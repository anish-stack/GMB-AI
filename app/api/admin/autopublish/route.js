import { route } from "@/lib/saas/routeKit.js";
import { autoPauseState, setAutoPause } from "@/lib/posting/autoPause.js";
import { audit } from "@/lib/saas/audit.js";
import { one } from "@/lib/db.js";

export const dynamic = "force-dynamic";

async function withCounts(state) {
  const waiting = await one(
    "SELECT COUNT(*) n FROM content_calendar WHERE status IN ('SCHEDULED','GENERATED') AND scheduled_date >= CURDATE() - INTERVAL 2 DAY",
  ).catch(() => null);
  return { ...state, upcoming: Number(waiting?.n || 0) };
}

/** Master auto-publish switch (super admin). */
export const GET = route({ superAdmin: true }, async () => withCounts(await autoPauseState()));

/** POST { paused: true|false } */
export const POST = route({ superAdmin: true }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  const paused = Boolean(b.paused);
  const state = await setAutoPause(paused, ctx?.email || ctx?.name || String(ctx?.userId || ""));
  await audit(ctx, paused ? "AUTOPUBLISH_PAUSED" : "AUTOPUBLISH_RESUMED", { meta: { at: new Date().toISOString() } });
  return withCounts(state);
});
