import { requireSuperAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { getSettings } from "@/lib/saas/settings.js";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const session = await requireSuperAdmin();
  const settings = await getSettings();
  return (
    <AdminShell session={session} platformName={settings.platform_name}>
      {children}
    </AdminShell>
  );
}
