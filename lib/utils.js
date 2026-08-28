export function cn(...parts) {
  return parts.flat().filter(Boolean).join(" ");
}

export function formatDate(d, withTime = false) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d.replace(" ", "T")) : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  const opts = { day: "2-digit", month: "short", year: "numeric" };
  if (withTime) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
  }
  return date.toLocaleString("en-IN", opts);
}

export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

export function truncate(s, n = 120) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "..." : s;
}

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
