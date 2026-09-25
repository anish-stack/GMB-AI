import { NextResponse } from "next/server";
import { guard, apiError } from "@/lib/saas/guard.js";
import {
  updateGmbProfile,
  setGmbConnectionStatus,
  deleteGmbProfile,
} from "@/lib/repo/gmb.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { one } from "@/lib/db";
import { getGMBProvider } from "@/lib/gmb/provider";

export const dynamic = "force-dynamic";

/* only these go to Google */
const GOOGLE_FIELDS = [
  "location_name",
  "phone",
  "website",
  "category_id",
  "opening_hours",
  "services",
];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

function googleError(err) {
  const status = err?.status === 429 ? 429 : err?.status || 500;

  return NextResponse.json(
    {
      ok: false,
      error: err?.message || "Google update failed.",
      reason: err?.googleReason || null,
      retryAfter: err?.retryAfter || null,
    },
    {
      status,
      headers: err?.retryAfter ? { "Retry-After": String(err.retryAfter) } : {},
    },
  );
}

export async function PATCH(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;

  const { id } = await params;
  const clientId = Number(id);

  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);

    const body = await request.json();
    console.log(body)
    /* CONNECTION ACTIONS */
    if (body.action === "activate") {
      await setGmbConnectionStatus(clientId, "MOCK_CONNECTED");
      return NextResponse.json({ ok: true });
    }

    if (body.action === "deactivate") {
      await setGmbConnectionStatus(clientId, "DISCONNECTED");
      return NextResponse.json({ ok: true });
    }

    /* PROVIDER CHECK */
    const profile = await one(
      `SELECT provider, connection_status
       FROM gmb_profiles
       WHERE client_id=?
       LIMIT 1`,
      [clientId],
    );

    let googleResult = null;

    if (
      profile?.provider === "google" &&
      profile?.connection_status === "GOOGLE_CONNECTED"
    ) {
      const provider = getGMBProvider();

      if (typeof provider.updateProfile !== "function") {
        throw new Error("The active GMB provider does not support profile updates.");
      }

      const googlePayload = pick(body, GOOGLE_FIELDS);

      console.log(
        `[GMB PATCH] client=${clientId} fields=`,
        Object.keys(googlePayload),
      );

      try {
        googleResult = await provider.updateProfile(clientId, googlePayload);
      } catch (err) {
        console.error(
          `[GMB PATCH] Google rejected client=${clientId}`,
          err?.status,
          err?.googleReason,
          err?.message,
        );
        // Google failed -> don't touch local DB
        return googleError(err);
      }

      console.log(
        `[GMB PATCH] Google ok client=${clientId} changed=`,
        googleResult?.changed,
        "skipped=",
        googleResult?.skipped,
      );
    }

    /* LOCAL DB SYNC */
    await updateGmbProfile(clientId, body);

    return NextResponse.json({
      ok: true,
      changed: googleResult?.changed || [],
      skipped: googleResult?.skipped || [],
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request, { params }) {
  const g = await guard(request, { permission: "gmb.edit" });
  if (g.error) return g.error;

  const { id } = await params;

  try {
    await assertClientInTenant(Number(id), g.ctx.tenantId);
    await deleteGmbProfile(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}