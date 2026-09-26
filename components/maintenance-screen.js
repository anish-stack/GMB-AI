import { Wrench } from "lucide-react";

export function MaintenanceScreen({ title, message, eta, platformName, supportEmail }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-10 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/30"><Wrench className="h-8 w-8" /></span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-zinc-400">{platformName}</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{title}</h1>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600 dark:text-zinc-300">{message}</p>
        {eta ? <p className="mt-4 inline-block rounded-full bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{eta}</p> : null}
        {supportEmail ? <p className="mt-6 text-xs text-zinc-400">Need help? <a href={`mailto:${supportEmail}`} className="font-semibold text-[#F53236]">{supportEmail}</a></p> : null}
      </div>
    </div>
  );
}
