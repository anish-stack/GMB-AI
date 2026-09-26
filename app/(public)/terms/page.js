import { CmsPage, cmsMetadata } from "@/components/cms-page";

export const dynamic = "force-dynamic";
export const generateMetadata = () => cmsMetadata("terms");

export default function Page() {
  return <CmsPage slug="terms" />;
}
