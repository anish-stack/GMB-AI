import { CmsPage, cmsMetadata } from "@/components/cms-page";

export const dynamic = "force-dynamic";
export const generateMetadata = () => cmsMetadata("privacy");

export default function Page() {
  return <CmsPage slug="privacy" />;
}
