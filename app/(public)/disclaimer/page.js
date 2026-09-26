import { CmsPage, cmsMetadata } from "@/components/cms-page";

export const dynamic = "force-dynamic";
export const generateMetadata = () => cmsMetadata("disclaimer");

export default function Page() {
  return <CmsPage slug="disclaimer" />;
}
