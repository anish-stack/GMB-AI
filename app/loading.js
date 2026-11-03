export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-80 max-w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60" />)}
      </div>
      <div className="h-64 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60" />
      <div className="h-96 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60" />
    </div>
  );
}