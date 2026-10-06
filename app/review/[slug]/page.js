import { notFound } from "next/navigation";
import { flowBySlug } from "@/lib/reviews/flow.js";
import { ReviewFlowApp } from "@/components/review-flow-app";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const f = await flowBySlug(slug);
  return { title: f ? `Review ${f.business_name}` : "Review", robots: { index: false } };
}

/** Public page behind the review QR code (no login). */
export default async function Page({ params }) {
  const { slug } = await params;
  const f = await flowBySlug(slug);
  if (!f) notFound();
  return (
    <ReviewFlowApp
      slug={f.slug}
      business={f.business_name}
      category={f.business_category}
      city={f.city}
      logo={f.logo_url}
      color={/^#[0-9a-f]{6}$/i.test(f.poster?.accent || "") ? f.poster.accent : f.brand_color || "#0EA5E9"}
      mode={f.mode}
      steps={f.steps}
      threshold={Number(f.threshold) || 4}
      reviewUrl={f.reviewUrl}
    />
  );
}
