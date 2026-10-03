import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireTenantContext } from "@/lib/saas/context.js";
import { one } from "@/lib/db";
import { wbConfig, syncBuilderClient, ssoUrl } from "@/lib/websiteBuilder.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Website builder" };

/**
 * The Website Builder, embedded INSIDE the GMB panel (no new tab, no login).
 *   /gmb/:id/website            -> this client's websites
 *   /gmb/:id/website?new=1      -> create a website for this client
 *   /gmb/:id/website?site=<id>  -> edit one website
 */
export default async function WebsiteBuilderPage({ params, searchParams }) {
  const ctx = await requireTenantContext();
  const { id } = await params;
  const sp = await searchParams;
  const clientId = Number(id);
  const client = await one("SELECT id, business_name FROM clients WHERE id=? AND tenant_id=?", [clientId, ctx.tenantId]);
  if (!client) notFound();

  const cfg = await wbConfig();
  let src = null;
  let error = null;
  if (cfg.configured) {
    try {
      const { builderClientId } = await syncBuilderClient(clientId, ctx.tenantId);
      const site = String(sp?.site || "").replace(/[^\w-]/g, "");
      const path = site
        ? `/websites/${site}?embed=1`
        : sp?.new
          ? `/websites/new?clientId=${encodeURIComponent(builderClientId)}&embed=1`
          : "/websites?embed=1";
      src = await ssoUrl(ctx.tenantId, path);
    } catch (e) {
      error = e.message;
    }
  }

  return (
    <div className="-m-4 flex h-full flex-col md:-m-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/gmb/${clientId}?tab=website`} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">Website builder · {client.business_name}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href={`/gmb/${clientId}/website`} className="font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white">All websites</Link>
          <Link href={`/gmb/${clientId}/website?new=1`} className="font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white">+ Blank website</Link>
          <Link href={`/gmb/${clientId}/website/new`} className="font-semibold text-[#F53236]">+ From Google</Link>
          {src ? (
            <a href={src.replace("embed=1", "embed=0")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
              Full screen <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
      {sp?.ai ? (
        <p className="border-b border-violet-200 bg-violet-50 px-4 py-2 text-xs text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-200">
          AI images are being generated for the hero, about and services - they appear here in 1-2 minutes (you&apos;ll get a notification). Reload the editor after that.
        </p>
      ) : null}
      {src ? (
        <iframe
          key={src}
          src={src}
          title="Website builder"
          className="w-full flex-1 border-0 bg-white"
          allow="clipboard-write"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="p-6">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error || "The website builder isn't connected yet. Super admin: Admin → Integrations → Website Builder."}
          </p>
        </div>
      )}
    </div>
  );
}
