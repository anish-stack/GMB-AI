import { requirePagePermission } from "@/lib/saas/context.js";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Old embedded-builder URL -> native editor / website tab. */
export default async function Page({ params, searchParams }) {
  await requirePagePermission("gmb.view");
  const { id } = await params;
  const sp = await searchParams;
  if (sp?.site && /^[a-f0-9]{24}$/.test(String(sp.site))) redirect(`/gmb/${id}/website/${sp.site}`);
  if (sp?.new) redirect(`/gmb/${id}/website/new`);
  redirect(`/gmb/${id}?tab=website`);
}
