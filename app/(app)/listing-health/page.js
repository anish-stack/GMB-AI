import { requirePagePermission } from "@/lib/saas/context.js";
import { ListingHealth } from "@/components/listing-health";

export const metadata = { title: "Listing health" };

export default async function Page() {
  await requirePagePermission("gmb.view");
  return <ListingHealth />;
}
