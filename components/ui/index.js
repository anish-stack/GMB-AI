import { cn } from "@/lib/utils";

const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-green-50 text-green-700 ring-green-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

export function Badge({ tone = "slate", children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
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
    <div className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3", className)}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

const BUTTONS = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
  secondary: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  ghost: "text-slate-600 hover:bg-slate-100",
};

export function Button({ variant = "primary", className, children, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70",
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
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

const CONTROL =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

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
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {children}
          {empty}
        </tbody>
      </table>
    </div>
  );
}

export function Stat({ label, value, sub, tone = "slate" }) {
  const bar = {
    slate: "bg-slate-400", indigo: "bg-indigo-500", emerald: "bg-emerald-500",
    amber: "bg-amber-500", red: "bg-red-500", blue: "bg-blue-500",
  }[tone];
  return (
    <Card className="overflow-hidden">
      <div className={cn("h-1 w-full", bar)} />
      <div className="px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
      </div>
    </Card>
  );
}

export function ScoreRing({ score, size = 56 }) {
  const value = Number(score || 0);
  const tone = value >= 90 ? "#059669" : value >= 80 ? "#4f46e5" : value >= 60 ? "#d97706" : "#dc2626";
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`AI score ${value} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, value)) / 100}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" fontSize={size / 3.6} fontWeight="600" fill="#0f172a">
        {value}
      </text>
    </svg>
  );
}

export function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}
