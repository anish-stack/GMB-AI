"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";

const DISMISS_KEY = "pwa-install-dismissed";

/** Registers the service worker, offers install, and handles "new version" updates. */
export function PwaClient() {
  const [installEvt, setInstallEvt] = useState(null);
  const [waiting, setWaiting] = useState(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    let reloading = false;
    const onController = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      window.__swReg = reg;
      window.dispatchEvent(new Event("sw-ready"));
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
        });
      });
      const t = setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      window.addEventListener("beforeunload", () => clearInterval(t));
    }).catch(() => {});

    const onPrompt = (e) => {
      e.preventDefault();
      if (localStorage.getItem(DISMISS_KEY)) return;
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener("appinstalled", onInstalled);

    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const t = setTimeout(() => {
      if (ios && !standalone && !localStorage.getItem(DISMISS_KEY) && location.pathname !== "/") setIosHint(true);
    }, 4000);

    return () => {
      clearTimeout(t);
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setInstallEvt(null);
    setIosHint(false);
  };

  if (waiting) {
    return (
      <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4" role="status">
        <div className="flex items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-2xl dark:bg-zinc-100 dark:text-zinc-900">
          <RefreshCw className="h-4 w-4" /> A new version is available.
          <button type="button" className="rounded-lg bg-[#F53236] px-3 py-1.5 text-xs font-semibold text-white" onClick={() => waiting.postMessage("SKIP_WAITING")}>
            Update
          </button>
        </div>
      </div>
    );
  }

  if (!installEvt && !iosHint) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div className="flex max-w-md items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Install the app</p>
          <p className="text-xs text-zinc-500">
            {iosHint ? "Tap Share, then “Add to Home Screen”." : "Faster access and push notifications on this device."}
          </p>
        </div>
        {installEvt ? (
          <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-[#F53236] px-3 py-1.5 text-xs font-semibold text-white"
            onClick={async () => { installEvt.prompt(); await installEvt.userChoice.catch(() => null); setInstallEvt(null); }}>
            <Download className="h-3.5 w-3.5" /> Install
          </button>
        ) : null}
        <button type="button" aria-label="Dismiss" onClick={dismiss} className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
