"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Skeleton } from "@/components/ui";

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
const BusinessToolsPanel = dynamic(() => import("./business-tools-panel").then((m) => m.BusinessToolsPanel), { loading: Loading });

const TABS = [
  ["overview", "Overview"],
  ["posts", "Posts"],
  ["reviews", "Reviews"],
  ["media", "Photos"],
  ["keywords", "Keywords"],
  ["tools", "Business tools"],
];

export function GmbDetailTabs({ clientId, initialTab = "overview", overview, posts, reviewUrl, business, canConnect }) {
  const valid = TABS.some(([k]) => k === initialTab) ? initialTab : "overview";
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
    posts: posts,
    reviews: <ReviewsPanel clientId={clientId} reviewUrl={reviewUrl} business={business} />,
    media: <MediaPanel clientId={clientId} />,
    keywords: <KeywordsPanel clientId={clientId} />,
    tools: <BusinessToolsPanel clientId={clientId} canConnect={canConnect} />,
  };

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-[5] -mx-4 border-b border-zinc-200/70 bg-[#f6f7fb]/90 px-4 backdrop-blur md:-mx-6 md:px-6 dark:border-zinc-800 dark:bg-[#0b0c0f]/90">
        <nav role="tablist" aria-label="GMB sections" className="no-scrollbar flex gap-1 overflow-x-auto">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => open(key)}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-[#F53236] text-zinc-900 dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      {TABS.map(([key]) =>
        visited.has(key) ? (
          <div key={key} role="tabpanel" hidden={tab !== key}>
            {panels[key]}
          </div>
        ) : null,
      )}
    </div>
  );
}
