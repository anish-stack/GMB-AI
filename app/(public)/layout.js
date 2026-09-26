import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getSettings } from "@/lib/saas/settings.js";
import { footerPages } from "@/lib/cms/pages.js";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }) {
  const [settings, pages] = await Promise.all([getSettings(), footerPages()]);
  const social = Object.entries(settings.social_links || {}).filter(([, v]) => v);
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/pricing" className="flex items-center gap-2.5">
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo_url} alt="" className="h-9 w-9 rounded-2xl object-contain" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F53236]">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </span>
            )}
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{settings.platform_name}</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/pricing" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300">Pricing</Link>
            <Link href="/login" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300">Sign in</Link>
            {Number(settings.allow_signup) === 1 ? (
              <Link href="/signup" className="rounded-xl bg-[#F53236] px-3.5 py-2 font-medium text-white hover:bg-[#e81d22]">
                Start free
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">{settings.platform_name}</p>
            <p className="mt-1 text-xs text-zinc-500">{settings.footer_text || settings.site_tagline}</p>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
            {pages.map((p) => (
              <Link key={p.slug} href={["terms", "privacy", "disclaimer"].includes(p.slug) ? `/${p.slug}` : `/p/${p.slug}`} className="hover:text-zinc-900 dark:hover:text-zinc-200">{p.title}</Link>
            ))}
            <Link href="/docs/api" className="hover:text-zinc-900 dark:hover:text-zinc-200">API docs</Link>
          </nav>
          <div className="text-xs text-zinc-500 sm:text-right">
            {settings.support_email ? <p><a href={`mailto:${settings.support_email}`}>{settings.support_email}</a></p> : null}
            {settings.support_phone ? <p>{settings.support_phone}</p> : null}
            {settings.contact_address ? <p>{settings.contact_address}</p> : null}
            {social.length ? (
              <p className="mt-2 flex gap-3 sm:justify-end">
                {social.map(([k, v]) => <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="capitalize hover:text-zinc-900">{k}</a>)}
              </p>
            ) : null}
          </div>
        </div>
        <p className="pb-6 text-center text-[11px] text-zinc-400">© {new Date().getFullYear()} {settings.platform_name}</p>
      </footer>
    </div>
  );
}
