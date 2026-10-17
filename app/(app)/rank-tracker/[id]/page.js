import { requirePagePermission } from "@/lib/saas/context.js";
import { RankScanView } from "@/components/rank-tracker";

export const metadata = { title: "Rank scan" };

export default async function Page({ params }) {
  await requirePagePermission("gmb.view");
  const { id } = await params;
  return <RankScanView id={Number(id)} />;
}
