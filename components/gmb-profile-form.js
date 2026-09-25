"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  MapPin,
  Phone,
  Globe2,
  Clock3,
  Plus,
  X,
  Save,
  ArrowLeft,
  BriefcaseBusiness,
  Loader2,
  Map,
  Check,
  Search,
  Sparkles,
  RefreshCw,
 Lock,
  ShieldAlert
} from "lucide-react";

const DAYS = [
  { key: "MONDAY", label: "Monday" },
  { key: "TUESDAY", label: "Tuesday" },
  { key: "WEDNESDAY", label: "Wednesday" },
  { key: "THURSDAY", label: "Thursday" },
  { key: "FRIDAY", label: "Friday" },
  { key: "SATURDAY", label: "Saturday" },
  { key: "SUNDAY", label: "Sunday" },
];

const FIELD_LABELS = {
  title: "Business name",
  phoneNumbers: "Phone",
  websiteUri: "Website",
  categories: "Category",
  regularHours: "Business hours",
  serviceItems: "Services",
};

const SKIP_REASONS = {
  PENDING_REVIEW: "Google review me hai",
  CATEGORY_CHANGED: "Category badli, services baad me save karo",
  NOT_ALLOWED: "Google allow nahi karta",
};

/* -------------------------------------------------------
   TIME HELPERS
------------------------------------------------------- */

function timeObjectToString(time) {
  if (!time || typeof time !== "object") return "";

  const hours = Number(time.hours ?? 0);
  const minutes = Number(time.minutes ?? 0);

  if (hours === 24) return "24:00";

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeStringToObject(value) {
  if (!value) return {};

  const [hoursString, minutesString] = value.split(":");
  const hours = Number(hoursString || 0);
  const minutes = Number(minutesString || 0);

  const result = {};
  if (hours) result.hours = hours;
  if (minutes) result.minutes = minutes;

  return result;
}

/* -------------------------------------------------------
   NORMALIZE HOURS FROM API
------------------------------------------------------- */

function buildHours(openingHours) {
  const defaultHours = {};

  DAYS.forEach(({ key }) => {
    defaultHours[key] = {
      enabled: false,
      allDay: false,
      open: "09:00",
      close: "18:00",
    };
  });

  const periods = Array.isArray(openingHours?.periods)
    ? openingHours.periods
    : [];

  periods.forEach((period) => {
    const day = period?.openDay;
    if (!day || !defaultHours[day]) return;

    const open = timeObjectToString(period.openTime) || "00:00";
    const close = timeObjectToString(period.closeTime) || "00:00";
    const closeDay = period.closeDay || day;

    /*
      24 hours can come back as:
      - open 00:00, close 24:00 same day
      - open 00:00, close 00:00 next day (what backend sends now)
    */
    const allDay =
      open === "00:00" &&
      (close === "24:00" || (close === "00:00" && closeDay !== day));

    defaultHours[day] = {
      enabled: true,
      allDay,
      open: allDay ? "00:00" : open,
      close: allDay ? "24:00" : close === "00:00" ? "24:00" : close,
    };
  });

  return defaultHours;
}

/* -------------------------------------------------------
   SERVICE HELPERS
------------------------------------------------------- */

const norm = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

function normalizeInitialServices(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      return (
        item?.displayName ||
        item?.label?.displayName ||
        item?.freeFormServiceItem?.label?.displayName ||
        item?.structuredServiceItem?.serviceTypeId ||
        ""
      );
    })
    .filter(Boolean);
}

/* -------------------------------------------------------
   MAIN COMPONENT
------------------------------------------------------- */

export function GmbProfileForm({ clientId, profile }) {
  const router = useRouter();
  const topRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    location_name: profile?.location_name || profile?.business_name || "",
    category: profile?.category || "",
    address: profile?.address || "",
    phone: profile?.phone || "",
    website: profile?.website || "",
    map_url: profile?.map_url || "",
  });

  const [hours, setHours] = useState(() => buildHours(profile?.opening_hours));

  const initialServices = useMemo(
    () => normalizeInitialServices(profile?.services),
    [profile?.services],
  );
  const [services, setServices] = useState(initialServices);
  const [serviceInput, setServiceInput] = useState("");

  const [diag, setDiag] = useState(null);
const [diagLoading, setDiagLoading] = useState(true);
const [diagError, setDiagError] = useState("");
const [diagKey, setDiagKey] = useState(0);









  useEffect(() => {
  if (!clientId) return;
  const controller = new AbortController();

  (async () => {
    setDiagLoading(true);
    setDiagError("");
    try {
      const res = await fetch(`/api/gmb/${clientId}/diagnose`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setDiag(data);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setDiagError(err?.message || "Review status check nahi ho paya.");
    } finally {
      if (!controller.signal.aborted) setDiagLoading(false);
    }
  })();

  return () => controller.abort();
}, [clientId, diagKey]);

  // pending review locks
const pendingFields = useMemo(
  () =>
    new Set([
      ...(profile?.pending_fields || []),
      ...(diag?.pendingFields || []),
    ]),
  [profile?.pending_fields, diag?.pendingFields],
);
const pendingChanges = diag?.pendingChanges ?? profile?.pending_changes ?? [];
const diffChanges = diag?.diffChanges ?? [];

const phonePending = pendingFields.has("phoneNumbers");
const servicesPending = pendingFields.has("serviceItems");
const hoursPending = pendingFields.has("regularHours");
const titlePending = pendingFields.has("title");
const websitePending = pendingFields.has("websiteUri");

  // dynamic service types
  const [serviceTypes, setServiceTypes] = useState([]);
  const [gmbCategory, setGmbCategory] = useState(null);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState("");
  const [typesQuery, setTypesQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  /* -------------------------------------------------------
     FETCH SERVICE TYPES
  ------------------------------------------------------- */

  useEffect(() => {
    if (!clientId) return;

    const controller = new AbortController();

    (async () => {
      setTypesLoading(true);
      setTypesError("");

      try {
        const res = await fetch(`/api/gmb/${clientId}/service-types`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || `HTTP error: ${res.status}`);
        }

        setGmbCategory(data?.category || null);
        setServiceTypes(
          Array.isArray(data?.serviceTypes)
            ? data.serviceTypes.filter(
                (t) => t?.serviceTypeId && t?.displayName,
              )
            : [],
        );
      } catch (err) {
        if (err?.name === "AbortError") return;
        setTypesError(err?.message || "Unable to load service types.");
      } finally {
        if (!controller.signal.aborted) setTypesLoading(false);
      }
    })();

    return () => controller.abort();
  }, [clientId, reloadKey]);

  const typeByName = useMemo(() => {
    const m = new globalThis.Map();
    serviceTypes.forEach((t) => m.set(norm(t.displayName), t));
    return m;
  }, [serviceTypes]);

  const typeById = useMemo(() => {
    const m = new globalThis.Map();
    serviceTypes.forEach((t) => m.set(t.serviceTypeId, t));
    return m;
  }, [serviceTypes]);

  // saved ids -> display names
  useEffect(() => {
    if (!serviceTypes.length) return;

    setServices((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        const t = typeById.get(s);
        if (t) {
          changed = true;
          return t.displayName;
        }
        return s;
      });
      return changed ? next : prev;
    });
  }, [serviceTypes, typeById]);

  const selectedSet = useMemo(() => new Set(services.map(norm)), [services]);

  const filteredTypes = useMemo(() => {
    const q = norm(typesQuery);
    if (!q) return serviceTypes;
    return serviceTypes.filter((t) => norm(t.displayName).includes(q));
  }, [serviceTypes, typesQuery]);

  const suggestedSelectedCount = useMemo(
    () =>
      serviceTypes.filter((t) => selectedSet.has(norm(t.displayName))).length,
    [serviceTypes, selectedSet],
  );

  /* -------------------------------------------------------
     FIELD UPDATE
  ------------------------------------------------------- */

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* -------------------------------------------------------
     HOURS
  ------------------------------------------------------- */

  function updateDay(day, values) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...values } }));
  }

  function toggleDay(day) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  }

  function toggleAllDay(day) {
    setHours((prev) => {
      const nextAllDay = !prev[day].allDay;
      return {
        ...prev,
        [day]: {
          ...prev[day],
          allDay: nextAllDay,
          open: nextAllDay ? "00:00" : "09:00",
          close: nextAllDay ? "24:00" : "18:00",
        },
      };
    });
  }

  /* -------------------------------------------------------
     SERVICES
  ------------------------------------------------------- */

  function addService(raw = serviceInput) {
    const value = String(raw || "").trim();
    if (!value) return;

    const official = typeByName.get(norm(value));
    const finalValue = official ? official.displayName : value;

    if (selectedSet.has(norm(finalValue))) {
      setServiceInput("");
      return;
    }

    setServices((prev) => [...prev, finalValue]);
    setServiceInput("");
  }

  function removeService(index) {
    setServices((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleServiceType(type) {
    const key = norm(type.displayName);

    setServices((prev) =>
      prev.some((s) => norm(s) === key)
        ? prev.filter((s) => norm(s) !== key)
        : [...prev, type.displayName],
    );
  }

  function selectAllFiltered() {
    setServices((prev) => {
      const have = new Set(prev.map(norm));
      const add = filteredTypes
        .map((t) => t.displayName)
        .filter((n) => !have.has(norm(n)));
      return [...prev, ...add];
    });
  }

  function clearSuggested() {
    setServices((prev) => prev.filter((s) => !typeByName.has(norm(s))));
  }

  function handleServiceKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addService();
    }
  }

  function createServiceItemsPayload() {
    return services.map((name) => {
      const type = typeByName.get(norm(name));

      if (type) {
        return {
          structuredServiceItem: { serviceTypeId: type.serviceTypeId },
        };
      }

      return {
        freeFormServiceItem: {
          category: gmbCategory?.id || undefined,
          label: { displayName: name, languageCode: "en" },
        },
      };
    });
  }

  /* -------------------------------------------------------
     CREATE GOOGLE HOURS PAYLOAD
  ------------------------------------------------------- */

  function createOpeningHoursPayload() {
    const periods = [];

    DAYS.forEach(({ key }) => {
      const day = hours[key];
      if (!day?.enabled) return;

      if (day.allDay) {
        periods.push({
          openDay: key,
          openTime: {},
          closeDay: key,
          closeTime: { hours: 24 },
        });
        return;
      }

      periods.push({
        openDay: key,
        openTime: timeStringToObject(day.open),
        closeDay: key,
        closeTime: timeStringToObject(day.close),
      });
    });

    return { periods };
  }

  /* -------------------------------------------------------
     SUBMIT
  ------------------------------------------------------- */

  async function submit(e) {
    e.preventDefault();

    if (!titlePending && !form.location_name.trim()) {
      setError("Business name khaali nahi ho sakta.");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        ...form,
        opening_hours: createOpeningHoursPayload(),
        services,
        service_items: createServiceItemsPayload(),
      };

      // don't send fields locked by Google review
      if (titlePending) delete payload.location_name;
      if (phonePending) delete payload.phone;
      if (websitePending) delete payload.website;
      if (hoursPending) delete payload.opening_hours;
      if (servicesPending) {
        delete payload.services;
        delete payload.service_items;
      }

      const res = await fetch(`/api/gmb/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409 && data.pendingFields?.length) {
          setDiagKey((k) => k + 1);
          throw new Error(
            `Review me hai: ${data.pendingFields
              .map((f) => FIELD_LABELS[f] || f)
              .join(", ")}`,
          );
        }
        if (res.status === 429) {
          throw new Error(
            "Google ne edits abhi rok rakhi hain. Thodi der baad try karo.",
          );
        }
        throw new Error(data.error || "Unable to update GMB profile.");
      }

     setResult({ changed: data.changed || [], skipped: data.skipped || [] });
setDiagKey((k) => k + 1);
router.refresh();
    } catch (err) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <form
      ref={topRef}
      onSubmit={submit}
      className="mx-auto max-w-7xl scroll-mt-4 space-y-5"
    >
      {/* HEADER */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F53236] text-white shadow-[0_8px_22px_rgba(245,50,54,0.20)]">
              <Building2 className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white">
                Edit Business Profile
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Update your Google Business Profile details, working hours and
                services.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F53236] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#df2529] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {busy ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {/* SAVE RESULT */}
      {result ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {result.changed.length ? (
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Google pe update bheja gaya
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.changed.map((f) => (
                  <span
                    key={f}
                    className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  >
                    ✓ {FIELD_LABELS[f] || f}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="font-semibold text-zinc-600 dark:text-zinc-300">
              Kuch change nahi tha, Google ko kuch nahi bheja.
            </p>
          )}

          {result.skipped.length ? (
            <div className="mt-3">
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                Skip hue
              </p>
              <ul className="mt-1 space-y-1 text-xs text-amber-800 dark:text-amber-300">
                {result.skipped.map((s) => (
                  <li key={s.field}>
                    {FIELD_LABELS[s.field] || s.field}:{" "}
                    {SKIP_REASONS[s.reason] || s.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => router.push(`/gmb/${clientId}`)}
            className="mt-4 h-8 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white dark:bg-white dark:text-zinc-950"
          >
            Profile pe wapas jao
          </button>
        </div>
      ) : null}

      {/* PENDING REVIEW */}
{/* REVIEW STATUS */}
{diagLoading ? (
  <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
    Google review status check ho raha hai...
  </div>
) : diagError ? (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
    <span>{diagError}</span>
    <button
      type="button"
      onClick={() => setDiagKey((k) => k + 1)}
      className="inline-flex items-center gap-1 font-semibold hover:underline"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Retry
    </button>
  </div>
) : null}

{!diagLoading && pendingChanges.length ? (
  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Google review me pending
        </p>
        <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-400/80">
          Ye fields review clear hone tak lock hain.
          {diag?.checkedAt
            ? ` Last check: ${new Date(diag.checkedAt).toLocaleTimeString()}`
            : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDiagKey((k) => k + 1)}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-amber-300 px-2 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
      >
        <RefreshCw className="h-3 w-3" />
        Refresh
      </button>
    </div>
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-amber-700/70 dark:text-amber-400/70">
          <tr>
            <th className="py-1 pr-4 font-semibold">Field</th>
            <th className="py-1 pr-4 font-semibold">Tumhara (review me)</th>
            <th className="py-1 font-semibold">Google pe abhi live</th>
          </tr>
        </thead>
        <tbody className="text-amber-900 dark:text-amber-200">
          {pendingChanges.map((p) => (
            <tr key={p.field} className="border-t border-amber-200/60 dark:border-amber-900/60">
              <td className="py-1.5 pr-4 font-semibold">{FIELD_LABELS[p.field] || p.field}</td>
              <td className="py-1.5 pr-4">{p.submitted}</td>
              <td className="py-1.5">{p.live}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
) : null}

{!diagLoading && diffChanges.length ? (
  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
    <div className="flex items-center gap-2">
      <ShieldAlert className="h-4 w-4 text-sky-700 dark:text-sky-300" />
      <p className="text-sm font-semibold text-sky-800 dark:text-sky-300">
        Google ne kuch fields khud badle hain
      </p>
    </div>
    <p className="mt-0.5 text-xs text-sky-700/80 dark:text-sky-400/80">
      GBP dashboard me "Edit profile" kholke Google ki value accept ya reject karo, warna edits atak sakte hain.
    </p>
    <ul className="mt-2 space-y-1 text-xs text-sky-900 dark:text-sky-200">
      {diffChanges.map((d) => (
        <li key={d.field}>
          <span className="font-semibold">{FIELD_LABELS[d.field] || d.field}:</span>{" "}
          tumhara "{d.yours}" → Google "{d.google}"
        </li>
      ))}
    </ul>
  </div>
) : null}

      {/* BUSINESS + CONTACT */}
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          icon={<Building2 className="h-4 w-4" />}
          title="Business information"
          description="Basic information displayed on your business listing."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Business name"
              className="sm:col-span-2"
              required
              locked={titlePending}
            >
              <input
                value={form.location_name}
                onChange={(e) => setField("location_name", e.target.value)}
                disabled={titlePending}
                placeholder={
                  titlePending ? "Under Google review" : "Enter business name"
                }
                className={inputClass}
              />
            </FormField>

            <FormField label="Business category">
              <input
                value={form.category}
                readOnly
                title="Category Google Business Profile se change karo"
                className={`${inputClass} cursor-not-allowed bg-zinc-50 text-zinc-500 dark:bg-zinc-900/40`}
              />
            </FormField>

            <FormField
              label="Phone number"
              icon={<Phone className="h-3.5 w-3.5" />}
              locked={phonePending}
            >
              <input
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                disabled={phonePending}
                placeholder={
                  phonePending ? "Under Google review" : "Enter phone number"
                }
                className={inputClass}
              />
            </FormField>

            <FormField
              label="Address"
              className="sm:col-span-2"
              icon={<MapPin className="h-3.5 w-3.5" />}
            >
              <textarea
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                rows={3}
                placeholder="Enter complete business address"
                className={`${inputClass} min-h-[88px] resize-none py-2.5`}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard
          icon={<Globe2 className="h-4 w-4" />}
          title="Online presence"
          description="Website and location links associated with this profile."
        >
          <div className="space-y-4">
            <FormField
              label="Website"
              icon={<Globe2 className="h-3.5 w-3.5" />}
              locked={websitePending}
            >
              <input
                type="url"
                value={form.website}
                onChange={(e) => setField("website", e.target.value)}
                disabled={websitePending}
                placeholder="https://example.com"
                className={inputClass}
              />
            </FormField>

            <FormField
              label="Google Maps URL"
              icon={<Map className="h-3.5 w-3.5" />}
            >
              <input
                type="url"
                value={form.map_url}
                onChange={(e) => setField("map_url", e.target.value)}
                placeholder="https://maps.google.com/..."
                className={inputClass}
              />
            </FormField>

            {profile?.connection_status ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Connection status
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {profile.connection_status}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      {/* SERVICES */}
      <SectionCard
        icon={<BriefcaseBusiness className="h-4 w-4" />}
        title="Services"
        description="Pick Google-suggested services for your category or add your own."
        action={
          <div className="flex items-center gap-2">
            {servicesPending ? <LockBadge /> : null}
            <div className="rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
              {services.length} services
            </div>
          </div>
        }
      >
        {servicesPending ? (
          <PendingNote text="Services abhi Google review me hain. Review complete hone tak changes save nahi honge." />
        ) : null}

        <fieldset
          disabled={servicesPending}
          className={`space-y-6 ${servicesPending ? "pointer-events-none opacity-50" : ""}`}
        >
          {/* SUGGESTED (DYNAMIC) */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#F53236]" />
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Suggested by Google
                  {gmbCategory?.name ? (
                    <span className="ml-1.5 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {gmbCategory.name}
                    </span>
                  ) : null}
                </p>
                {serviceTypes.length ? (
                  <span className="text-[11px] text-zinc-400">
                    {suggestedSelectedCount}/{serviceTypes.length} selected
                  </span>
                ) : null}
              </div>

              {serviceTypes.length ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                    <input
                      value={typesQuery}
                      onChange={(e) => setTypesQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                      placeholder="Filter..."
                      className={`${inputClass} h-8 w-40 pl-8 text-xs`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="h-8 rounded-lg border border-zinc-200 px-2.5 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearSuggested}
                    disabled={!suggestedSelectedCount}
                    className="h-8 rounded-lg border border-zinc-200 px-2.5 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>

            {typesLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-8 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
                    style={{ width: `${80 + ((i * 37) % 90)}px` }}
                  />
                ))}
              </div>
            ) : typesError ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                <span>{typesError}</span>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="inline-flex items-center gap-1 font-semibold hover:underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            ) : serviceTypes.length ? (
              filteredTypes.length ? (
                <div className="flex flex-wrap gap-2">
                  {filteredTypes.map((type) => {
                    const active = selectedSet.has(norm(type.displayName));
                    return (
                      <button
                        key={type.serviceTypeId}
                        type="button"
                        onClick={() => toggleServiceType(type)}
                        aria-pressed={active}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${
                          active
                            ? "border-[#F53236] bg-[#F53236] text-white shadow-sm hover:bg-[#df2529]"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {active ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 text-zinc-400" />
                        )}
                        {type.displayName}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  No match for “{typesQuery}”.
                </p>
              )
            ) : (
              <p className="text-xs text-zinc-500">
                No suggested services for this category. Add custom ones below.
              </p>
            )}
          </div>

          {/* CUSTOM ADD */}
          <div className="space-y-2 border-t border-zinc-100 pt-5 dark:border-zinc-800">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Custom service
            </p>

            <div className="flex max-w-2xl gap-2">
              <div className="relative flex-1">
                <input
                  value={serviceInput}
                  onChange={(e) => setServiceInput(e.target.value)}
                  onKeyDown={handleServiceKeyDown}
                  placeholder="e.g. WhatsApp API setup, Shopify store..."
                  className={`${inputClass} pr-10`}
                />
                <BriefcaseBusiness className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              </div>

              <button
                type="button"
                onClick={() => addService()}
                disabled={!serviceInput.trim()}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          {/* SELECTED */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Selected services
            </p>

            {services.length ? (
              <div className="flex flex-wrap gap-2">
                {services.map((service, index) => {
                  const isOfficial = typeByName.has(norm(service));
                  return (
                    <div
                      key={`${service}-${index}`}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        isOfficial
                          ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300"
                          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                      }`}
                    >
                      <span>{service}</span>
                      {!isOfficial ? (
                        <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-bold uppercase dark:bg-amber-900/50">
                          Custom
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeService(index)}
                        className="rounded-md p-0.5 opacity-60 transition hover:bg-white/60 hover:text-red-500 hover:opacity-100 dark:hover:bg-zinc-900"
                        aria-label={`Remove ${service}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-5 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-400 shadow-sm dark:bg-zinc-900">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  No services added
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Tap suggested services above or add a custom one.
                </p>
              </div>
            )}
          </div>
        </fieldset>
      </SectionCard>

      {/* BUSINESS HOURS */}
      <SectionCard
        icon={<Clock3 className="h-4 w-4" />}
        title="Business hours"
        description="Manage opening and closing hours for each day."
        action={hoursPending ? <LockBadge /> : null}
      >
        {hoursPending ? (
          <PendingNote text="Hours abhi Google review me hain. Review complete hone tak changes save nahi honge." />
        ) : null}

        <fieldset
          disabled={hoursPending}
          className={`overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 ${
            hoursPending ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <div className="hidden grid-cols-[150px_100px_1fr_1fr_110px] gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400 md:grid dark:border-zinc-800 dark:bg-zinc-900/60">
            <div>Day</div>
            <div>Status</div>
            <div>Opens</div>
            <div>Closes</div>
            <div>24 Hours</div>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {DAYS.map(({ key, label }) => {
              const day = hours[key];

              return (
                <div
                  key={key}
                  className="grid gap-3 px-4 py-3 transition hover:bg-zinc-50/70 md:grid-cols-[150px_100px_1fr_1fr_110px] md:items-center dark:hover:bg-zinc-900/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {label}
                    </span>
                    <span className="text-[10px] text-zinc-400 md:hidden">
                      {day.enabled
                        ? day.allDay
                          ? "24 hours"
                          : `${day.open} - ${day.close}`
                        : "Closed"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleDay(key)}
                    className={`inline-flex h-7 w-fit items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition ${
                      day.enabled
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        day.enabled ? "bg-emerald-500" : "bg-zinc-400"
                      }`}
                    />
                    {day.enabled ? "Open" : "Closed"}
                  </button>

                  <div>
                    <span className="mb-1 block text-[10px] font-medium text-zinc-400 md:hidden">
                      Opens
                    </span>
                    <input
                      type="time"
                      value={day.allDay ? "00:00" : day.open}
                      disabled={!day.enabled || day.allDay}
                      onChange={(e) => updateDay(key, { open: e.target.value })}
                      className={timeInputClass}
                    />
                  </div>

                  <div>
                    <span className="mb-1 block text-[10px] font-medium text-zinc-400 md:hidden">
                      Closes
                    </span>
                    <input
                      type="time"
                      value={
                        day.allDay
                          ? "23:59"
                          : day.close === "24:00"
                            ? "23:59"
                            : day.close
                      }
                      disabled={!day.enabled || day.allDay}
                      onChange={(e) =>
                        updateDay(key, { close: e.target.value })
                      }
                      className={timeInputClass}
                    />
                  </div>

                  <label
                    className={`flex cursor-pointer items-center gap-2 text-xs font-medium ${
                      !day.enabled
                        ? "pointer-events-none opacity-40"
                        : "text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={day.allDay}
                      disabled={!day.enabled}
                      onChange={() => toggleAllDay(key)}
                      className="h-4 w-4 rounded border-zinc-300 text-[#F53236] focus:ring-[#F53236]"
                    />
                    24 hours
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
      </SectionCard>

      {/* BOTTOM ACTION BAR */}
      <div className="sticky bottom-4 z-20">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.10)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <p className="hidden text-xs text-zinc-500 sm:block">
            {pendingFields.size
              ? `${pendingFields.size} field review me lock hai, baaki save honge.`
              : "Sirf badle hue fields Google ko bheje jayenge."}
          </p>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={busy}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Cancel
            </button>

            <button
              type="submit"
          disabled={busy || diagLoading}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#F53236] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#df2529] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {busy ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* =========================================================
   SHARED COMPONENTS
========================================================= */

function SectionCard({ icon, title, description, action, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#F53236] dark:bg-red-950/30">
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-950 dark:text-white">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function FormField({
  label,
  required,
  icon,
  locked = false,
  className = "",
  children,
}) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon ? <span className="text-zinc-400">{icon}</span> : null}
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
        {required && !locked ? <span className="text-red-500">*</span> : null}
        {locked ? <LockBadge /> : null}
      </div>
      {children}
    </label>
  );
}

function LockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      <Lock className="h-3 w-3" />
      Under review
    </span>
  );
}

function PendingNote({ text }) {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
      {text}
    </div>
  );
}

/* =========================================================
   STYLES
========================================================= */

const inputClass = `
  h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900
  outline-none transition placeholder:text-zinc-400 hover:border-zinc-300
  focus:border-[#F53236] focus:ring-4 focus:ring-[#F53236]/10
  disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400
  dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600
  dark:disabled:bg-zinc-900/40
`;

const timeInputClass = `
  h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700
  outline-none transition focus:border-[#F53236] focus:ring-4 focus:ring-[#F53236]/10
  disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400
  dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:disabled:bg-zinc-900/40
`;