import { cn } from "@/lib/utils";

const TONES = {
  slate: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  indigo: "bg-violet-50 text-violet-700 ring-violet-200",
  violet: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
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
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-zinc-200 dark:text-zinc-800" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, value)) / 100}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" fontSize={size / 3.6} fontWeight="600" fill="currentColor" className="text-zinc-900 dark:text-zinc-100">
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


/* ---------- small shared building blocks ---------- */

export function Alert({ tone = "red", children, action, className }) {
  const tones = {
    red: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
    blue: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300",
  };
  return (
    <div role="status" className={cn("flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs leading-5", tones[tone] || tones.red, className)}>
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-lg bg-zinc-200/80 dark:bg-zinc-800", className)} />;
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
      {Icon ? (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
      {text ? <p className="mt-1 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PanelHeader({ icon: Icon, tone = "red", title, subtitle, count, actions }) {
  const tones = {
    red: "bg-red-50 text-[#F53236] dark:bg-red-950/30",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400",
    blue: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
  };
  return (
    <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-zinc-800">
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[tone] || tones.red)}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white">
            <span className="truncate">{title}</span>
            {count ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{count}</span>
            ) : null}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = "md",
}) {
  if (!open) return null;

  const width =
    {
      sm: "max-w-md",
      md: "max-w-lg",
      lg: "max-w-2xl",
    }[size] || "max-w-lg";

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-end justify-center
        overflow-y-auto
        px-0 py-0
        sm:items-center sm:px-4 sm:py-6
      "
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          `
            page-enter
            relative z-10
            flex w-full flex-col
            overflow-hidden
            bg-white shadow-2xl
            dark:bg-zinc-900

            max-h-[95dvh]
            rounded-t-2xl

            sm:max-h-[calc(100dvh-48px)]
            sm:rounded-2xl
          `,
          width
        )}
      >
        {/* Header */}
        <div
          className="
            flex shrink-0 items-center justify-between
            border-b border-zinc-100
            bg-white
            px-5 py-4
            dark:border-zinc-800
            dark:bg-zinc-900
          "
        >
          <h3 className="pr-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="
              flex h-8 w-8 shrink-0
              items-center justify-center
              rounded-lg
              text-zinc-400
              transition-colors
              hover:bg-zinc-100
              hover:text-zinc-700
              dark:hover:bg-zinc-800
              dark:hover:text-zinc-200
            "
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
            overscroll-contain
            px-5 py-4
          "
        >
          {children}
        </div>

        {/* Footer */}
        {footer ? (
          <div
            className="
              shrink-0
              border-t border-zinc-100
              bg-white
              px-5 py-3
              dark:border-zinc-800
              dark:bg-zinc-900
            "
          >
            <div className="flex justify-end gap-2">
              {footer}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}