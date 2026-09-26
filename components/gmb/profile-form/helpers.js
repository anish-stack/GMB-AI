export const DAYS = [
  ["MONDAY", "Mon"], ["TUESDAY", "Tue"], ["WEDNESDAY", "Wed"], ["THURSDAY", "Thu"],
  ["FRIDAY", "Fri"], ["SATURDAY", "Sat"], ["SUNDAY", "Sun"],
];

export const FIELD_LABELS = {
  title: "Business name",
  phoneNumbers: "Phone",
  websiteUri: "Website",
  categories: "Categories",
  regularHours: "Business hours",
  specialHours: "Special hours",
  serviceItems: "Services",
  profile: "Description",
  "profile.description": "Description",
};

export const SKIP_REASONS = {
  PENDING_REVIEW: "waiting for Google review",
  CATEGORY_CHANGED: "category changed - save services again after it updates",
  NOT_ALLOWED: "Google does not allow editing this field for this listing",
};

export const norm = (v) => String(v || "").trim().toLowerCase();

function toStr(t) {
  if (!t || typeof t !== "object") return "";
  if (Number(t.hours) === 24) return "24:00";
  return `${String(t.hours ?? 0).padStart(2, "0")}:${String(t.minutes ?? 0).padStart(2, "0")}`;
}

function toObj(v) {
  const [h, m] = String(v || "").split(":").map(Number);
  const out = {};
  if (h) out.hours = h;
  if (m) out.minutes = m;
  return out;
}

/** Google regularHours -> { MONDAY: { enabled, allDay, open, close } } */
export function buildHours(openingHours) {
  const out = Object.fromEntries(DAYS.map(([k]) => [k, { enabled: false, allDay: false, open: "09:00", close: "18:00" }]));
  for (const p of openingHours?.periods || []) {
    if (!out[p?.openDay]) continue;
    const open = toStr(p.openTime) || "00:00";
    const close = toStr(p.closeTime) || "00:00";
    const allDay = open === "00:00" && (close === "24:00" || (close === "00:00" && (p.closeDay || p.openDay) !== p.openDay));
    out[p.openDay] = { enabled: true, allDay, open: allDay ? "00:00" : open, close: allDay ? "24:00" : close === "00:00" ? "24:00" : close };
  }
  return out;
}

export function hoursPayload(hours) {
  const periods = [];
  for (const [key] of DAYS) {
    const d = hours[key];
    if (!d?.enabled) continue;
    periods.push(
      d.allDay
        ? { openDay: key, openTime: {}, closeDay: key, closeTime: { hours: 24 } }
        : { openDay: key, openTime: toObj(d.open), closeDay: key, closeTime: toObj(d.close) },
    );
  }
  return { periods };
}

export function normalizeServices(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((i) => (typeof i === "string" ? i : i?.displayName || i?.label?.displayName || i?.freeFormServiceItem?.label?.displayName || i?.structuredServiceItem?.serviceTypeId || ""))
    .filter(Boolean);
}

export function hoursError(hours) {
  for (const [key, label] of DAYS) {
    const d = hours[key];
    if (d?.enabled && !d.allDay && d.close !== "24:00" && d.close <= d.open) return `${label}: closing time must be after opening time.`;
  }
  return "";
}
