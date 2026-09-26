import Script from "next/script";
import "./globals.css";
import { getSettings } from "@/lib/saas/settings.js";
import { publicAnalyticsId } from "@/lib/integrations/store.js";
import { PwaClient } from "@/components/pwa/pwa-client";

export async function generateMetadata() {
  const s = await getSettings();
  const name = s.platform_name || "GMB AI Cloud";
  return {
    title: { default: s.seo_title || name, template: `%s · ${name}` },
    description: s.seo_description || s.site_tagline,
    keywords: s.seo_keywords || undefined,
    applicationName: name,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    icons: {
      icon: s.favicon_url || "/icons/icon-192.png",
      apple: "/icons/apple-touch-icon.png",
    },
    openGraph: { title: s.seo_title || name, description: s.seo_description || "", siteName: name, type: "website" },
  };
}

export async function generateViewport() {
  const s = await getSettings();
  return { themeColor: s.brand_color || "#F53236", width: "device-width", initialScale: 1, viewportFit: "cover" };
}

const NO_FLASH_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }) {
  const ga = await publicAnalyticsId().catch(() => null);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        {children}
        <PwaClient />
        {ga && /^G-[A-Z0-9]+$/.test(ga) ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}</Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
