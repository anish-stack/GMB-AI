import { route } from "@/lib/saas/routeKit.js";
import { detectAi } from "@/lib/ai/aiDetect.js";

export const dynamic = "force-dynamic";

/** POST { title, description } -> { score (AI %), human, signals, source } */
export const POST = route({}, async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  return detectAi(String(b.title || "").slice(0, 200), String(b.description || "").slice(0, 2000));
});
