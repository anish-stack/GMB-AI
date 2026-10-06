"use client";

import Link from "next/link";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Skeleton } from "@/components/ui";
import { ArrowRightIcon, QrCodeIcon } from "lucide-react";

const Loading = () => (
  <div className="space-y-3">
    <Skeleton className="h-16 rounded-2xl" />
    <Skeleton className="h-64 rounded-2xl" />
  </div>
);

// Heavy client panels are split into their own chunks and only downloaded
// when the tab is opened for the first time.
const ReviewsPanel = dynamic(() => import("./reviews-panel").then((m) => m.ReviewsPanel), { loading: Loading });
const MediaPanel = dynamic(() => import("./media-panel").then((m) => m.MediaPanel), { loading: Loading });
const KeywordsPanel = dynamic(() => import("./keywords-panel").then((m) => m.KeywordsPanel), { loading: Loading });
const ServicesPanel = dynamic(() => import("./services-panel").then((m) => m.ServicesPanel), { loading: Loading });
const ProductsPanel = dynamic(() => import("./products-panel").then((m) => m.ProductsPanel), { loading: Loading });
const LinksPanel = dynamic(() => import("./links-panel").then((m) => m.LinksPanel), { loading: Loading });
const TrackedKeywords = dynamic(() => import("./tracked-keywords").then((m) => m.TrackedKeywords), { loading: Loading });
const SocialPanel = dynamic(() => import("./social-panel").then((m) => m.SocialPanel), { loading: Loading });
const WebsitePanel = dynamic(() => import("./website-panel").then((m) => m.WebsitePanel), { loading: Loading });
const AutoPublishCard = dynamic(() => import("./auto-publish-card").then((m) => m.AutoPublishCard), { loading: () => null });
const AutoReplyCard = dynamic(() => import("./links-panel").then((m) => m.AutoReplyCard), { loading: () => null });
const BusinessToolsPanel = dynamic(() => import("./business-tools-panel").then((m) => m.BusinessToolsPanel), { loading: Loading });

const TABS = [
  ["overview", "Overview"],
  ["posts", "Posts"],
  ["reviews", "Reviews"],
  ["services", "Services"],
  ["products", "Products"],
  ["links", "Links & QR"],
  ["website", "Website"],
  ["media", "Photos"],
  ["keywords", "Keywords"],
  ["tools", "Business tools"],
];

export function GmbDetailTabs({ clientId, initialTab = "overview", overview, posts, reviewUrl, business, canConnect, social = false }) {
  const tabs = social ? [...TABS.slice(0, TABS.findIndex(([k]) => k === "website") + 1), ["social", "Facebook & Instagram"], ...TABS.slice(TABS.findIndex(([k]) => k === "website") + 1)] : TABS;
  const valid = tabs.some(([k]) => k === initialTab) ? initialTab : "overview";
  const [tab, setTab] = useState(valid);
  const [visited, setVisited] = useState(() => new Set([valid]));

  function open(key) {
    setTab(key);
    setVisited((v) => (v.has(key) ? v : new Set(v).add(key)));
    const url = new URL(window.location.href);
    if (key === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  }

  const panels = {
    overview: overview,
    posts: (
      <div className="space-y-5">
        <AutoPublishCard clientId={clientId} />
        {posts}
      </div>
    ),
    reviews: (
      <div className="space-y-5">
<Link
  href={`/gmb/${clientId}/review-qr`}
  className="group relative flex items-center justify-between gap-5 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-700"
>
  {/* Soft background accent */}
  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl transition-all duration-300 group-hover:bg-brand-500/20" />

  <div className="relative flex min-w-0 items-center gap-4">
    {/* Icon */}
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:bg-brand-950/40 dark:text-brand-400 dark:ring-brand-900/50">
      <QrCodeIcon className="h-6 w-6" />
    </div>

    {/* Content */}
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
          Review QR & Poster Studio
        </h3>

        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
          Reviews
        </span>
      </div>

      <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Create a smart review QR that guides customers to leave feedback in
        seconds, plus a ready-to-print table standee.
      </p>
    </div>
  </div>

  {/* CTA */}
  <div className="relative flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all group-hover:bg-brand-600 group-hover:shadow-md">
    <span className="hidden sm:inline">Open Studio</span>
    <span className="sm:hidden">Open</span>

    <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
  </div>
</Link>

        <AutoReplyCard clientId={clientId} />
        <ReviewsPanel clientId={clientId} reviewUrl={reviewUrl} business={business} />
      </div>
    ),
    services: <ServicesPanel clientId={clientId} />,
    products: <ProductsPanel clientId={clientId} />,
    links: <LinksPanel clientId={clientId} />,
    website: <WebsitePanel clientId={clientId} />,
    social: social ? <SocialPanel clientId={clientId} /> : null,
    media: <MediaPanel clientId={clientId} />,
    keywords: (
      <div className="space-y-5">
        <TrackedKeywords clientId={clientId} business={business} />
        <KeywordsPanel clientId={clientId} />
      </div>
    ),
    tools: <BusinessToolsPanel clientId={clientId} canConnect={canConnect} />,
  };

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-[5] -mx-4 border-b border-zinc-200/70 bg-[#f6f7fb]/90 px-4 backdrop-blur md:-mx-6 md:px-6 dark:border-zinc-800 dark:bg-[#0b0c0f]/90">
        <nav role="tablist" aria-label="GMB sections" className="no-scrollbar flex gap-1 overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => open(key)}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-brand-500 text-zinc-900 dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      {tabs.map(([key]) =>
        visited.has(key) ? (
          <div key={key} role="tabpanel" hidden={tab !== key}>
            {panels[key]}
          </div>
        ) : null,
      )}
    </div>
  );
}
