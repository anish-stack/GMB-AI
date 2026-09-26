export function money(v, cur = "INR") {
  const n = Number(v || 0);
  const s = n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 });
  return cur === "INR" ? `₹${s}` : `${cur} ${s}`;
}

export const lim = (v, unit) => (Number(v) < 0 ? `Unlimited ${unit}` : `${Number(v).toLocaleString("en-IN")} ${unit}`);

export function priceOf(plan, cycle) {
  return Number(cycle === "YEARLY" ? plan.price_yearly : plan.price_monthly) || 0;
}

export function quoteOf(plan, cycle, taxPercent, onlinePayments) {
  const subtotal = priceOf(plan, cycle);
  const tax = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const trialDays = subtotal > 0 && Number(plan.trial_days) > 0 ? Number(plan.trial_days) : 0;
  return { subtotal, tax, total, taxPercent, trialDays, requiresPayment: total > 0 && !trialDays && onlinePayments, currency: plan.currency || "INR" };
}

export function passwordScore(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw Object.assign(new Error(json.error || "Something went wrong."), { status: res.status });
  return json;
}
