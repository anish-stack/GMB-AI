import { CmsPage, cmsMetadata } from "@/components/cms-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return cmsMetadata(slug);
}

export default async function Page({ params }) {
  const { slug } = await params;
  return <CmsPage slug={slug} />;
}
