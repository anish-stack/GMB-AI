import { NextResponse } from "next/server";
import { listPlans, listCreditPacks } from "@/lib/saas/billing.js";
import { publicBranding } from "@/lib/saas/settings.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const [plans, packs, branding] = await Promise.all([
    listPlans({ publicOnly: true }),
    listCreditPacks(),
    publicBranding(),
  ]);
  return NextResponse.json({ plans, packs, branding });
}
