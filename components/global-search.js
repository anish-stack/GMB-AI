"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState({ clients: [], tasks: [] });
  const boxRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults({ clients: [], tasks: [] });
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setResults(await res.json());
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function go(href) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const hasResults = results.clients.length > 0 || results.tasks.length > 0;

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-1.5 ring-1 ring-transparent focus-within:bg-white focus-within:ring-brand-500/40 dark:bg-zinc-800 dark:focus-within:bg-zinc-900">
        <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search clients or tasks..."
          className="w-full bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-200"
        />
        {q ? (
          <button onClick={() => { setQ(""); setResults({ clients: [], tasks: [] }); }} aria-label="Clear search">
            <X className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600" />
          </button>
        ) : null}
      </div>

      {open && q.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-96 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          {!hasResults ? (
            <p className="px-3 py-4 text-center text-xs text-zinc-400">No matches for &quot;{q}&quot;</p>
          ) : (
            <>
              {results.clients.length > 0 ? (
                <div className="mb-1">
                  <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Clients</p>
                  {results.clients.map((c) => (
                    <button
                      key={`c-${c.id}`}
                      onClick={() => go(`/clients/${c.id}`)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span className="font-medium text-zinc-800 dark:text-zinc-100">{c.business_name}</span>
                      <span className="text-xs text-zinc-400">{c.city}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {results.tasks.length > 0 ? (
                <div>
                  <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Tasks</p>
                  {results.tasks.map((t) => (
                    <button
                      key={`t-${t.id}`}
                      onClick={() => go(`/gmb/tasks/${t.id}`)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span className="truncate font-medium text-zinc-800 dark:text-zinc-100">{t.title || "Untitled"}</span>
                      <span className="shrink-0 pl-2 text-xs text-zinc-400">{t.business_name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
