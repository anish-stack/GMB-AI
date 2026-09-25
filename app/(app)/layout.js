import { requireTenantContext } from "@/lib/saas/context.js";
import { providerInfo } from "@/lib/ai/index.js";
import { gmbProviderInfo } from "@/lib/gmb/provider.js";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { PERMISSIONS, ROLES } from "@/lib/saas/constants.js";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }) {
  const ctx = await requireTenantContext();
  const perms = ctx.role === ROLES.SUPER_ADMIN ? Object.values(PERMISSIONS).flat() : PERMISSIONS[ctx.role] || [];

  return (
    <AppShell
      session={ctx.session}
      aiProvider={providerInfo()}
      gmbProvider={gmbProviderInfo()}
      workspace={ctx.tenant?.name}
      plan={ctx.plan?.name}
      perms={perms}
      creditsLeft={ctx.ent.wallet.balance}
      banner={
        ctx.impersonating ? (
          <ImpersonationBanner admin={ctx.impersonating} tenantName={ctx.tenant?.name} />
        ) : null
      }
    >
      {children}
    </AppShell>
  );
}
