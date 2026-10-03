import { NextResponse, after } from "next/server";
import { verifyInviteToken } from "@/lib/gmb/googleAuth.js";
import { GoogleGMBProvider } from "@/lib/gmb/googleProvider.js";
import { linkGoogleLocation } from "@/lib/repo/gmb.js";
import { importFromGoogle } from "@/lib/gmb/importFromGoogle.js";
import { resultPage } from "@/lib/gmb/connectPages.js";
import { importSiblingListings } from "@/lib/gmb/bulkConnect.js";

export const dynamic = "force-dynamic";

/** Location picker form posts here: links ONLY the listing the client chose. */
export async function POST(request) {
  const fd = await request.formData();
  const clientId = verifyInviteToken(String(fd.get("t") || ""));
  const wanted = String(fd.get("location") || "");
  if (!clientId) return resultPage(false, "This link has expired. Please open the connect link again.");
  try {
    const { locations } = await new GoogleGMBProvider().syncClient(clientId);
    if (wanted === "__all__") {
      if (!locations.length) return resultPage(false, "No listings found on this Google account.");
      const [first, ...rest] = locations;
      await linkGoogleLocation(clientId, first.account, first.location);
      const res = await importSiblingListings(clientId, rest);
      after(async () => {
        for (const id of [clientId, ...res.created.map((c) => c.client_id)]) await importFromGoogle(id).catch((e) => console.error("[import]", id, e.message));
      });
      const skipped = res.skipped.length ? ` ${res.skipped.length} skipped (${[...new Set(res.skipped.map((x) => x.reason))].join(", ")}).` : "";
      return resultPage(true, `Connected ${1 + res.created.length} listing(s): ${[first.location.title, ...res.created.map((c) => c.title)].filter(Boolean).join(", ")}.${skipped}`);
    }
    const match = locations.find((l) => l.location.name === wanted);
    if (!match) return resultPage(false, "That listing isn't available on this Google account.");
    await linkGoogleLocation(clientId, match.account, match.location);
    after(() => importFromGoogle(clientId).catch((e) => console.error("[import]", e.message)));
    return resultPage(true, `Connected: ${match.location.title || match.location.name}. Only this listing is linked.`);
  } catch (err) {
    return resultPage(false, err.message);
  }
}
