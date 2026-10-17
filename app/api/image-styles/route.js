import { route } from "@/lib/saas/routeKit.js";
import { listStyles } from "@/lib/images/styles.js";

export const dynamic = "force-dynamic";

/** Active image styles a workspace can choose from (managed by the admin). */
export const GET = route({ permission: "gmb.view" }, async () => ({
  items: (await listStyles({ activeOnly: true })).map((s) => ({ id: s.id, name: s.name, description: s.description, mode: s.mode, is_default: Boolean(s.is_default), preview_url: s.preview_url || null })),
}));
