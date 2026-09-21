import { cn } from "@/lib/utils";

const TONES = {
  slate: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  indigo: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "slate", children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        TONES[tone] || TONES.slate,
        className
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200/70 bg-white dark:border-zinc-800 dark:bg-zinc-900/90 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)] backdrop-blur-sm transition-shadow hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_32px_-14px_rgba(15,23,42,0.16)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800", className)}>
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

const BUTTONS = {
  primary: "bg-[#F53236] text-white shadow-sm shadow-[#F53236]/25 hover:bg-[#e81d22] disabled:bg-brand-300",
  secondary: "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:ring-zinc-400",
  success: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-500 disabled:bg-emerald-300",
  danger: "bg-rose-600 text-white shadow-sm shadow-rose-600/25 hover:bg-rose-500 disabled:bg-rose-300",
  dangerGhost: "text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50",
  ghost: "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800",
};

export function Button({ variant = "primary", className, children, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        BUTTONS[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-zinc-400">{hint}</span> : null}
    </label>
  );
}

const CONTROL =
  "w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

export function Input({ className, ...props }) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(CONTROL, "min-h-24", className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(CONTROL, className)} {...props}>
      {children}
    </select>
  );
}

export function Table({ head, children, empty }) {
  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
        <thead className="bg-zinc-50/80 dark:bg-zinc-800/40">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
          {children}
          {empty}
        </tbody>
      </table>
    </div>
  );
}

const STAT_ICON_BG = {
  slate: "bg-zinc-100 text-zinc-600",
  indigo: "bg-violet-100 text-violet-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-rose-100 text-rose-600",
  blue: "bg-sky-100 text-sky-600",
};

export function Stat({ label, value, sub, tone = "slate", icon: Icon }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
          {sub ? <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p> : null}
        </div>
        {Icon ? (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", STAT_ICON_BG[tone] || STAT_ICON_BG.slate)}>
            <Icon className="h-4.5 w-4.5" />
          </span>
        ) : (
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full mt-1", STAT_ICON_BG[tone]?.split(" ")[0] || "bg-zinc-200")} />
        )}
      </div>
    </Card>
  );
}

export function ScoreRing({ score, size = 56 }) {
  const value = Number(score || 0);
  const tone = value >= 90 ? "#059669" : value >= 80 ? "#0d9488" : value >= 60 ? "#d97706" : "#e11d48";
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`AI score ${value} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e4e7" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, value)) / 100}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" fontSize={size / 3.6} fontWeight="600" fill="#18181b">
        {value}
      </text>
    </svg>
  );
}

export function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {children}
      </td>
    </tr>
  );
}
