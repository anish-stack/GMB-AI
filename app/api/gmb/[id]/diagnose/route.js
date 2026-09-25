import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { one } from "@/lib/db";
import { getGMBProvider } from "@/lib/gmb/provider";

export const dynamic = "force-dynamic";

const EMPTY = {
  hasPendingEdits: false,
  pendingFields: [],
  diffFields: [],
  pendingChanges: [],
  diffChanges: [],
};

export async function GET(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;

  const { id } = await params;
  const clientId = Number(id);
  const full = new URL(request.url).searchParams.get("full") === "1";

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);

    const profile = await one(
      `SELECT provider, connection_status FROM gmb_profiles WHERE client_id=? LIMIT 1`,
      [clientId],
    );

    // mock / disconnected -> nothing locked
    if (
      profile?.provider !== "google" ||
      profile?.connection_status !== "GOOGLE_CONNECTED"
    ) {
      return NextResponse.json({ ok: true, provider: profile?.provider || null, ...EMPTY });
    }

    const provider = getGMBProvider();

    if (typeof provider.diagnose !== "function") {
      return NextResponse.json({ ok: true, ...EMPTY });
    }

    const result = await provider.diagnose(clientId, { full });

    return NextResponse.json(
      { ok: true, provider: "google", ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return apiError(err);
  }
}