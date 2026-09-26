export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/saas/settings.js";

export default async function manifest() {
  const s = await getSettings();
  return {
    id: "/",
    name: s.platform_name || "GMB AI Cloud",
    short_name: (s.platform_name || "GMB AI").slice(0, 12),
    description: s.seo_description || s.site_tagline || "",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#f6f7fb",
    theme_color: s.brand_color || "#F53236",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Review queue", url: "/gmb/tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Notifications", url: "/notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
