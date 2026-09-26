"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";

const TOKEN_KEY = "fcm-token";
const ASK_KEY = "push-ask-dismissed";

async function swReady() {
  if (window.__swReg) return window.__swReg;
  return new Promise((resolve) => {
    window.addEventListener("sw-ready", () => resolve(window.__swReg), { once: true });
    setTimeout(() => navigator.serviceWorker.ready.then(resolve), 3000);
  });
}

async function registerToken(cfg) {
  const [{ initializeApp, getApps }, { getMessaging, getToken, onMessage, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (!(await isSupported())) return null;
  const app = getApps()[0] || initializeApp(cfg);
  const messaging = getMessaging(app);
  const reg = await swReady();
  const token = await getToken(messaging, { vapidKey: cfg.vapidKey, serviceWorkerRegistration: reg });
  if (!token) return null;
  const last = localStorage.getItem(TOKEN_KEY);
  const lastAt = Number(localStorage.getItem(`${TOKEN_KEY}-at`) || 0);
  // new token, or daily refresh so the server knows the device is alive
  if (token !== last || Date.now() - lastAt > 86400000) {
    const res = await fetch("/api/notifications/fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: /android|iphone|ipad/i.test(navigator.userAgent) ? "mobile-web" : "web" }),
    });
    if (res.ok) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(`${TOKEN_KEY}-at`, String(Date.now()));
    }
  }
  // Foreground messages: page decides. If the tab is hidden/minimised show a system notification.
  onMessage(messaging, async (payload) => {
    const d = payload.data || {};
    window.dispatchEvent(new CustomEvent("app:notification", { detail: d }));
    if (document.visibilityState !== "visible") {
      reg.showNotification(d.title || "Notification", { body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", data: { link: d.link || "/notifications" } });
    }
  });
  return token;
}

/** Logged-in only: FCM permission + token registration + foreground handling. */
export function PushClient() {
  const [cfg, setCfg] = useState(null);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    let alive = true;
    fetch("/api/push-config")
      .then((r) => r.json())
      .then(async ({ firebase }) => {
        if (!alive || !firebase) return;
        setCfg(firebase);
        if (Notification.permission === "granted") await registerToken(firebase).catch(() => {});
        else if (Notification.permission === "default" && !localStorage.getItem(ASK_KEY)) setAsk(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!ask || !cfg) return null;
  return (
    <div className="fixed right-4 top-20 z-[55] w-[min(92vw,360px)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#F53236] dark:bg-red-950/30"><BellRing className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Get notified when AI finishes</p>
          <p className="mt-0.5 text-xs text-zinc-500">We&apos;ll ping this device when posts are ready - even if you switch tabs or close the app.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-lg bg-[#F53236] px-3 py-1.5 text-xs font-semibold text-white"
              onClick={async () => {
                setAsk(false);
                const p = await Notification.requestPermission();
                if (p === "granted") await registerToken(cfg).catch(() => {});
                else localStorage.setItem(ASK_KEY, "1");
              }}>
              Enable notifications
            </button>
            <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => { localStorage.setItem(ASK_KEY, "1"); setAsk(false); }}>
              Not now
            </button>
          </div>
        </div>
        <button type="button" aria-label="Close" onClick={() => setAsk(false)} className="self-start text-zinc-400"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
