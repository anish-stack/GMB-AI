import { requirePagePermission } from "@/lib/saas/context.js";
import { ApiKeysManager } from "@/components/api-keys-manager";

export const metadata = { title: "API & developers" };

export default async function DevelopersPage() {
  await requirePagePermission("apikey.manage");
  return <ApiKeysManager />;
}
