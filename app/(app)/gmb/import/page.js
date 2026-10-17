import { requirePagePermission } from "@/lib/saas/context.js";
import { GmbBulkImport } from "@/components/gmb/bulk-import";

export const metadata = { title: "Import Google listings" };

export default async function Page({ searchParams }) {
  await requirePagePermission("gmb.connect");
  const sp = await searchParams;
  return <GmbBulkImport initialConnection={sp?.connection ? Number(sp.connection) : null} />;
}
