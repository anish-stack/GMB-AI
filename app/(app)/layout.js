import { headers } from "next/headers";
import { requireTenantContext } from "@/lib/saas/context.js";
import { providerInfo } from "@/lib/ai/index.js";
import { gmbProviderInfo } from "@/lib/gmb/provider.js";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { AppShell } from "@/components/app-shell";
import { tenantBrand } from "@/lib/branding.js";
import { maintenanceState, bypassesMaintenance } from "@/lib/system/maintenance.js";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { PushClient } from "@/components/pwa/push-client";
import { NoContextMenu } from "@/components/pwa/no-context-menu";
import { getSettings } from "@/lib/saas/settings.js";

export const dynamic = "force-dynamic";

/** White-label: the browser tab shows the agency's brand name. */
export async function generateMetadata() {
  const { getPageContext } = await import("@/lib/saas/context.js");
  const ctx = await getPageContext().catch(() => null);
  const b = await tenantBrand(ctx?.tenant || null).catch(() => null);
  return b ? { title: { absolute: b.name, template: `%s · ${b.name}` }, applicationName: b.name } : {};
}

export default async function AppLayout({ children }) {
  const ctx = await requireTenantContext();
  const [m, settings, h] = await Promise.all([maintenanceState(), getSettings(), headers()]);
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip");
  if (!bypassesMaintenance(m, { session: ctx.session, ip })) {
    return <MaintenanceScreen title={m.title} message={m.message} eta={m.eta} platformName={m.platformName} supportEmail={m.supportEmail} />;
  }
  const perms = ctx.perms;

  return (
    <AppShell
      session={ctx.session}
      aiProvider={providerInfo()}
      gmbProvider={gmbProviderInfo()}
      workspace={ctx.tenant?.name}
      brand={await tenantBrand(ctx.tenant).catch(() => null)}
      themeColor={ctx.tenant?.theme_color || null}
      plan={ctx.plan?.name}
      perms={perms}
      creditsLeft={ctx.ent.wallet.unlimited ? "Unlimited" : ctx.ent.wallet.balance}
      banner={
        <>
          {m.enabled ? <div className="bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-white">Maintenance mode is ON - clients see the maintenance page.</div> : null}
          {ctx.impersonating ? <ImpersonationBanner admin={ctx.impersonating} tenantName={ctx.tenant?.name} /> : null}
        </>
      }
    >
      {children}
      <PushClient />
      <NoContextMenu enabled={Number(settings.app_disable_right_click) === 1} />
    </AppShell>
  );
}