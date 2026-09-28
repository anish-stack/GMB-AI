import { gmbRoute } from "@/lib/gmb/routeHelpers";
import { importFromGoogle } from "@/lib/gmb/importFromGoogle.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST -> re-import profile, services, locations, logo, links and keywords from Google. */
export const POST = gmbRoute("gmb.edit", async ({ clientId }) => ({ result: await importFromGoogle(clientId) }));
