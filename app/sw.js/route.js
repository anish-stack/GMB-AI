import fs from "node:fs";
import path from "node:path";
import { publicFirebaseConfig } from "@/lib/integrations/store.js";

export const dynamic = "force-dynamic";

const FIREBASE_SDK = "12.19.0";

function buildId() {
  try {
    return fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return "dev";
  }
}

/**
 * One service worker for PWA caching + FCM background pushes.
 * Served as a route so the Firebase web config (public values) and the build
 * id are injected - a new deploy changes the file, which triggers the
 * in-app "Update available" prompt.
 */
export async function GET() {
  const fb = await publicFirebaseConfig().catch(() => null);
  const version = `${buildId()}-${fb ? fb.projectId : "nofcm"}`;
  const js = `/* generated */
const VERSION = ${JSON.stringify(version)};
const CACHE = "gmb-" + VERSION;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("gmb-") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(async () => (await caches.match("/offline.html")) || Response.error()));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/illustrations/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});

function show(data) {
  const title = data.title || "Notification";
  return self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag || undefined,
    data: { link: data.link || "/notifications" },
  });
}

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.link) || "/notifications", self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin)) {
        await c.focus();
        if ("navigate" in c) return c.navigate(target);
        return;
      }
    }
    return self.clients.openWindow(target);
  })());
});
${
  fb
    ? `
importScripts("https://www.gstatic.com/firebasejs/${FIREBASE_SDK}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${FIREBASE_SDK}/firebase-messaging-compat.js");
firebase.initializeApp(${JSON.stringify({ apiKey: fb.apiKey, authDomain: fb.authDomain, projectId: fb.projectId, messagingSenderId: fb.messagingSenderId, appId: fb.appId })});
firebase.messaging().onBackgroundMessage((payload) => show(payload.data || payload.notification || {}));
`
    : `
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: e.data && e.data.text() }; }
  e.waitUntil(show(data.data || data));
});
`
}`;
  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
