import { RankScanView } from "@/components/rank-tracker";

export const metadata = { title: "Rank scan" };

export default async function Page({ params }) {
  const { id } = await params;
  return <RankScanView id={Number(id)} />;
}
