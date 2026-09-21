import { NextResponse } from "next/server";
import { guard } from "@/lib/saas/guard.js";
import { platformStats, revenueTrend, planDistribution } from "@/lib/saas/tenants.js";
import { platformUsage } from "@/lib/saas/usage.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const g = await guard(request, { superAdmin: true });
  if (g.error) return g.error;
  const [stats, revenue, plans, usage] = await Promise.all([
    platformStats(),
    revenueTrend(6),
    planDistribution(),
    platformUsage(),
  ]);
  return NextResponse.json({ stats, revenue, plans, usage });
}
