import { notFound } from "next/navigation";
import { getPage } from "@/lib/cms/pages.js";
import { renderMarkdown } from "@/lib/cms/markdown.js";
import { formatDate } from "@/lib/utils";

export async function cmsMetadata(slug) {
  const p = await getPage(slug);
  return p ? { title: p.seo_title || p.title, description: p.seo_description || undefined } : { title: "Not found" };
}

export async function CmsPage({ slug }) {
  const p = await getPage(slug);
  if (!p) notFound();
  return (
    <article className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-6 sm:p-10 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{p.title}</h1>
      <p className="mt-2 text-xs text-zinc-400">Last updated {formatDate(p.updated_at)}</p>
      <div className="cms-content mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.content) }} />
    </article>
  );
}
