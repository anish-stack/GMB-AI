import { query } from "@/lib/db";
import { ImageStylesAdmin } from "@/components/admin/image-styles-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Image styles" };

export default async function Page() {
  const clients = await query("SELECT c.id, c.business_name, t.name tenant FROM clients c JOIN tenants t ON t.id=c.tenant_id WHERE c.active=1 ORDER BY c.business_name LIMIT 500").catch(() => []);
  return <ImageStylesAdmin clients={JSON.parse(JSON.stringify(clients))} />;
}
