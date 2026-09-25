
import { one, insert, query } from "../db.js";
import {
  clearGoogleAccessTokenCache,
  getAccessTokenForClient,
} from "./googleAuth.js";

/* =========================================================
   SERVICE HELPERS
========================================================= */

function normalizeServiceName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

const SERVICE_ALIASES = {
  seo: "job_type_id:search_engine_optimization",
  "search engine optimisation": "job_type_id:search_engine_optimization",
  "website design": "job_type_id:web_design",
  "web designing": "job_type_id:web_design",
  "website development": "job_type_id:web_development",
  "app development": "job_type_id:application_development",
  "mobile application development": "job_type_id:mobile_app_development",
  ppc: "job_type_id:ppc_marketing",
  "google ads": "job_type_id:ppc_marketing",
  "social media": "job_type_id:social_media_marketing",
  smm: "job_type_id:social_media_marketing",
  "digital marketing": "job_type_id:digital_marketing",
  "graphic designing": "job_type_id:graphic_design",
  branding: "job_type_id:logo_and_branding_design",
  "web hosting": "job_type_id:web_hosting",
  hosting: "job_type_id:web_hosting",
};

function normalizeServiceInput(services = []) {
  const out = [];
  const seen = new Set();

  for (const service of services) {
    let name = "";
    let serviceTypeId = null;

    if (typeof service === "string") {
      name = service.trim();
    } else if (service && typeof service === "object") {
      name = String(
        service.name ||
          service.label?.displayName ||
          service.displayName ||
          service.freeFormServiceItem?.label?.displayName ||
          "",
      ).trim();
      serviceTypeId =
        service.serviceTypeId ||
        service.service_type_id ||
        service.structuredServiceItem?.serviceTypeId ||
        null;
    }

    // string that is actually an id
    if (!serviceTypeId && name.startsWith("job_type_id:")) {
      serviceTypeId = name;
    }

    if (!name && !serviceTypeId) continue;

    const key = serviceTypeId || normalizeServiceName(name);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ name, serviceTypeId });
  }

  return out;
}

/** Map input services -> Google serviceItems for this primary category. */
function buildServiceItems(primaryCategory, services = []) {
  const supported = Array.isArray(primaryCategory?.serviceTypes)
    ? primaryCategory.serviceTypes
    : [];

  const items = [];
  const usedIds = new Set();

  for (const service of normalizeServiceInput(services)) {
    let matched = null;

    if (service.serviceTypeId) {
      matched = supported.find(
        (t) => t.serviceTypeId === service.serviceTypeId,
      );
    }

    if (!matched && service.name) {
      const n = normalizeServiceName(service.name);
      matched = supported.find(
        (t) => normalizeServiceName(t.displayName) === n,
      );

      if (!matched && SERVICE_ALIASES[n]) {
        matched = supported.find((t) => t.serviceTypeId === SERVICE_ALIASES[n]);
      }
    }

    if (matched) {
      if (usedIds.has(matched.serviceTypeId)) continue;
      usedIds.add(matched.serviceTypeId);
      items.push({
        structuredServiceItem: { serviceTypeId: matched.serviceTypeId },
      });
      continue;
    }

    if (!service.name || service.name.startsWith("job_type_id:")) continue;

    // custom service
    items.push({
      freeFormServiceItem: {
        category: primaryCategory.name,
        label: {
          displayName: service.name.slice(0, 140),
          languageCode: "en",
        },
      },
    });
  }

  return items;
}

function serviceItemsKey(items = []) {
  return (items || [])
    .map((i) =>
      i?.structuredServiceItem?.serviceTypeId
        ? `s:${i.structuredServiceItem.serviceTypeId}`
        : `f:${normalizeServiceName(i?.freeFormServiceItem?.label?.displayName)}`,
    )
    .filter((k) => k !== "f:")
    .sort()
    .join("|");
}

/* =========================================================
   HOURS HELPERS
========================================================= */

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function nextDay(day) {
  const index = DAYS.indexOf(day);
  if (index === -1) return day;
  return DAYS[(index + 1) % DAYS.length];
}

const ZERO_TIME = { hours: 0, minutes: 0, seconds: 0, nanos: 0 };

function normalizeTimeOfDay(value, fallback = ZERO_TIME) {
  // missing entirely -> fallback
  if (value === undefined || value === null || value === "") {
    return { ...fallback };
  }

  // object: Google omits zero fields, so {} === 00:00
  if (typeof value === "object") {
    let hours = Number(value.hours ?? 0);
    let minutes = Number(value.minutes ?? 0);
    let seconds = Number(value.seconds ?? 0);
    let nanos = Number(value.nanos ?? 0);

    if (hours === 24) {
      hours = 0;
      minutes = 0;
      seconds = 0;
      nanos = 0;
    }

    return { hours, minutes, seconds, nanos };
  }

  if (typeof value === "string") {
    const [h = "0", m = "0"] = value.split(":");
    let hours = Number(h);
    const minutes = Number(m);
    if (hours === 24) hours = 0;
    return { hours, minutes, seconds: 0, nanos: 0 };
  }

  return { ...fallback };
}

function readHour(time) {
  if (!time) return 0;
  if (typeof time === "object") return Number(time.hours ?? 0);
  return Number(String(time).split(":")[0] || 0);
}

function isEmptyTime(time) {
  return (
    !time ||
    (typeof time === "object" && Object.keys(time).length === 0) ||
    time === "00:00"
  );
}

function normalizeGoogleHours(openingHours) {
  const periods = Array.isArray(openingHours?.periods)
    ? openingHours.periods
    : [];

  return {
    periods: periods
      .map((period) => {
        if (!period?.openDay) return null;

        const closeHour = readHour(period.closeTime);
        const closeDay = period.closeDay || period.openDay;

        // 24h: 00:00 today -> 00:00 next day (Google rejects hours: 24)
        if (isEmptyTime(period.openTime) && closeHour === 24) {
          return {
            openDay: period.openDay,
            openTime: { ...ZERO_TIME },
            closeDay: nextDay(period.openDay),
            closeTime: { ...ZERO_TIME },
          };
        }

        return {
          openDay: period.openDay,
          openTime: normalizeTimeOfDay(period.openTime, {
            ...ZERO_TIME,
            hours: 9,
          }),
          // close 24:00 same day -> 00:00 next day
          closeDay: closeHour === 24 ? nextDay(closeDay) : closeDay,
          closeTime: normalizeTimeOfDay(period.closeTime, {
            ...ZERO_TIME,
            hours: 18,
          }),
        };
      })
      .filter(Boolean),
  };
}

function hoursKey(openingHours) {
  const t = (x) =>
    `${String(x.hours).padStart(2, "0")}:${String(x.minutes).padStart(2, "0")}`;

  return normalizeGoogleHours(openingHours)
    .periods.map(
      (p) => `${p.openDay}@${t(p.openTime)}>${p.closeDay}@${t(p.closeTime)}`,
    )
    .sort()
    .join("|");
}

/* =========================================================
   MISC
========================================================= */

function formatGoogleDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4";
const PERF = "https://businessprofileperformance.googleapis.com/v1";
const VERIFICATIONS = "https://mybusinessverifications.googleapis.com/v1";
const NOTIFICATIONS = "https://mybusinessnotifications.googleapis.com/v1";

const VERIFICATION_METHODS = [
  "SMS",
  "PHONE_CALL",
  "EMAIL",
  "MAIL",
  "AUTO",
  "VETTED_PARTNER",
];

const NOTIFICATION_TYPES = [
  "GOOGLE_UPDATE",
  "NEW_REVIEW",
  "UPDATED_REVIEW",
  "NEW_CUSTOMER_MEDIA",
  "NEW_QUESTION",
  "UPDATED_QUESTION",
  "DUPLICATE_LOCATION",
  "LOSS_OF_VOICE_OF_MERCHANT",
];

const MEDIA_CATEGORIES = [
  "COVER",
  "PROFILE",
  "LOGO",
  "EXTERIOR",
  "INTERIOR",
  "PRODUCT",
  "AT_WORK",
  "FOOD_AND_DRINK",
  "MENU",
  "COMMON_AREA",
  "ROOMS",
  "TEAMS",
  "ADDITIONAL",
];

const MEDIA_FORMATS = ["PHOTO", "VIDEO"];

function normalizeMediaItem(m = {}) {
  return {
    id:
      String(m.name || "")
        .split("/")
        .pop() || null,
    name: m.name || null,
    mediaFormat: m.mediaFormat || null,
    category: m.locationAssociation?.category || null,
    googleUrl: m.googleUrl || m.sourceUrl || null,
    thumbnailUrl: m.thumbnailUrl || null,
    description: m.description || null,
    createTime: m.createTime || null,
  };
}

function sanitizeReviewId(id) {
  const s = String(id || "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("Invalid review id.");
  return s;
}

function normalizeReview(r = {}) {
  return {
    id: r.reviewId,
    author: r.reviewer?.displayName || "Google user",
    rating: r.starRating,
    comment: r.comment || "",
    created_at: r.createTime,
    updated_at: r.updateTime || r.createTime,
    reply: r.reviewReply
      ? { comment: r.reviewReply.comment, updated_at: r.reviewReply.updateTime }
      : null,
  };
}

function parseYearMonth(s) {
  const [year, month] = String(s || "")
    .split("-")
    .map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Invalid month "${s}". Expected YYYY-MM.`);
  }
  return { year, month };
}

function maskPhone(v) {
  if (!v) return null;
  const s = String(v);
  return s.length > 4
    ? `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`
    : s;
}

function maskEmail(v) {
  if (!v) return null;
  const [user, domain] = String(v).split("@");
  if (!domain) return v;
  return `${user[0] || ""}***@${domain}`;
}

const LOCATION_FIELDS =
  "name,title,storefrontAddress,phoneNumbers,websiteUri,categories,regularHours,serviceItems,metadata";

/* =========================================================
   PROVIDER
========================================================= */
function describeField(field, loc = {}, typeNames = new Map()) {
  switch (field) {
    case "title":
      return loc.title || "—";
    case "phoneNumbers":
      return loc.phoneNumbers?.primaryPhone || "—";
    case "websiteUri":
      return loc.websiteUri || "—";
    case "categories":
      return loc.categories?.primaryCategory?.displayName || "—";
    case "regularHours": {
      const p = loc.regularHours?.periods || [];
      if (!p.length) return "—";
      const t = (x = {}) =>
        `${String(x.hours || 0).padStart(2, "0")}:${String(x.minutes || 0).padStart(2, "0")}`;
      return p
        .map(
          (x) => `${x.openDay.slice(0, 3)} ${t(x.openTime)}-${t(x.closeTime)}`,
        )
        .join(", ");
    }
    case "serviceItems": {
      const s = (loc.serviceItems || [])
        .map((i) =>
          i.structuredServiceItem
            ? typeNames.get(i.structuredServiceItem.serviceTypeId) ||
              i.structuredServiceItem.serviceTypeId
            : i.freeFormServiceItem?.label?.displayName,
        )
        .filter(Boolean);
      return s.length ? s.join(", ") : "—";
    }
    default:
      return "—";
  }
}
export class GoogleGMBProvider {
  constructor() {
    this.name = "google";
    this.isMock = false;
  }

  isConfigured() {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    );
  }

  async #call(
    clientId,
    url,
    { method = "GET", body = null, retries = 3 } = {},
  ) {
    let token = await getAccessTokenForClient(clientId);

    const isWrite = method !== "GET";
    let attempt = 0;
    let authRetried = false;

    while (true) {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GOOG-API-FORMAT-VERSION": "2",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const text = await res.text();
      let parsed = null;
      if (res.ok) {
        return text ? JSON.parse(text) : {};
      }

      if (!res.ok) {
        console.error(
          `[GBP] ${method} ${url.split("?")[0]} -> ${res.status}`,
          JSON.stringify(parsed?.error, null, 2),
        );
      }

      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      /* 401 - refresh token once */
      if (res.status === 401 && !authRetried) {
        console.warn(
          `[GBP] Access token rejected for client ${clientId}. Refreshing and retrying once...`,
        );
        clearGoogleAccessTokenCache(clientId);
        authRetried = true;
        token = await getAccessTokenForClient(clientId, { forceRefresh: true });
        continue;
      }

      const errorInfo = parsed?.error?.details?.find(
        (d) => d?.["@type"] === "type.googleapis.com/google.rpc.ErrorInfo",
      );
      const reason = errorInfo?.reason || null;
      const throttled = res.status === 429 || reason === "THROTTLED";

      /*
       * Only READS get backoff retries.
       * Retrying a PATCH counts as another edit on the listing
       * and keeps the per-listing edit window locked.
       */
      if (throttled && !isWrite && attempt < retries) {
        const delay =
          1500 * Math.pow(2, attempt) + Math.floor(Math.random() * 700);
        console.warn(
          `[GBP] Read throttled. Retry ${attempt + 1}/${retries} in ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }

      let detail = text.slice(0, 1000);

      if (res.status === 401) {
        detail =
          "Google OAuth access token is expired, invalid, or revoked. Reconnect the Google Business Profile account.";
        clearGoogleAccessTokenCache(clientId);
      }

      if (throttled) {
        detail = isWrite
          ? "Google edit limit reached for this listing. Wait about a minute and save again."
          : "Google Business Profile read limit reached. Please try again shortly.";
        console.warn(
          `[GBP] ${isWrite ? "Write" : "Read"} throttled (${reason})`,
        );
      }

      if (res.status === 403 && text.includes("has not been used")) {
        detail =
          "Google Business Profile API is not enabled or quota/access has not been approved.";
      }

      const error = new Error(`Google API ${res.status}: ${detail}`);
      error.status = throttled ? 429 : res.status;
      error.googleReason = reason;
      if (throttled) error.retryAfter = 60;
      throw error;
    }
  }


  async #uploadMediaBytes(clientId, resourceName, buffer, mimeType) {
  let token = await getAccessTokenForClient(clientId);

  const uploadUrl =
    `https://mybusiness.googleapis.com/upload/v1/media/${resourceName}` +
    `?upload_type=media`;

  let res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType || "application/octet-stream",
    },
    body: buffer,
  });

  // token expired -> refresh once
  if (res.status === 401) {
    clearGoogleAccessTokenCache(clientId);

    token = await getAccessTokenForClient(clientId, {
      forceRefresh: true,
    });

    res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: buffer,
    });
  }

  const text = await res.text();

  if (!res.ok) {
    const err = new Error(
      `Google media bytes upload failed ${res.status}: ${text.slice(0, 1000)}`
    );

    err.status = res.status;
    throw err;
  }

  return true;
}

  /** Every account the connected user owns or manages. */
  async listAccounts(clientId) {
    const data = await this.#call(
      clientId,
      `${ACCOUNTS}/accounts?pageSize=100`,
    );
    return data.accounts || [];
  }

  /** Every location under one account. */
  async listLocations(clientId, accountName) {
    const url = `${INFO}/${accountName}/locations?readMask=${encodeURIComponent(LOCATION_FIELDS)}&pageSize=100`;
    const data = await this.#call(clientId, url);
    return data.locations || [];
  }

  /** Pull everything the connected account can see. */
  async syncClient(clientId, { locationName = null } = {}) {
    const accounts = await this.listAccounts(clientId);
    const found = [];
    for (const account of accounts) {
      const locations = await this.listLocations(clientId, account.name);
      for (const loc of locations)
        found.push({ account: account.name, location: loc });
    }

    for (const account of accounts) {
      const locations = await this.listLocations(clientId, account.name);

      console.log(
        "ACCOUNT",
        account.name,
        locations.map((loc) => ({
          name: loc.name,
          title: loc.title,
          phone: loc.phoneNumbers?.primaryPhone,
          address: loc.storefrontAddress,
          hasVoiceOfMerchant: loc.metadata?.hasVoiceOfMerchant,
        })),
      );
    }
    const chosen = locationName
      ? found.find((f) => f.location.name === locationName)
      : found[0];
    return { accounts, locations: found, chosen };
  }

  async #ids(clientId) {
    const row = await one(
      "SELECT google_account_id, google_location_name FROM clients WHERE id=?",
      [clientId],
    );
    if (!row?.google_account_id || !row?.google_location_name) {
      throw new Error(
        "This client has no Google location selected yet. Run the sync after connecting.",
      );
    }
    return row;
  }

  async #getLocation(clientId, readMask = LOCATION_FIELDS) {
    const { google_location_name } = await this.#ids(clientId);
    const location = await this.#call(
      clientId,
      `${INFO}/${google_location_name}?readMask=${encodeURIComponent(readMask)}`,
    );
    return { google_location_name, location };
  }

  async #getPendingInfo(clientId, google_location_name) {
    try {
      const gu = await this.#call(
        clientId,
        `${INFO}/${google_location_name}:getGoogleUpdated?readMask=${encodeURIComponent(
          "title,phoneNumbers,websiteUri,categories,regularHours,serviceItems",
        )}`,
      );
      const toSet = (mask) =>
        new Set(
          String(mask || "")
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && s !== "metadata"),
        );
      return {
        fields: toSet(gu.pendingMask),
        diff: toSet(gu.diffMask),
        live: gu.location || {},
      };
    } catch (e) {
      console.warn("[GBP] getGoogleUpdated failed:", e.message);
      return { fields: new Set(), diff: new Set(), live: {} };
    }
  }

  async getAvailableServiceTypes(clientId) {
    const { location } = await this.#getLocation(clientId, "categories");

    const primaryCategory = location?.categories?.primaryCategory;
    if (!primaryCategory) {
      throw new Error(
        "Google primary business category could not be determined.",
      );
    }

    return {
      category: { id: primaryCategory.name, name: primaryCategory.displayName },
      serviceTypes: (primaryCategory.serviceTypes || []).map((t) => ({
        serviceTypeId: t.serviceTypeId,
        displayName: t.displayName,
      })),
    };
  }

  async getProfile(clientId) {
    const { google_location_name, location: loc } =
      await this.#getLocation(clientId);
    const addr = loc.storefrontAddress || {};

    const typeNames = new Map(
      (loc.categories?.primaryCategory?.serviceTypes || []).map((t) => [
        t.serviceTypeId,
        t.displayName,
      ]),
    );

    let pendingChanges = [];
    if (loc.metadata?.hasPendingEdits) {
      const { fields, live } = await this.#getPendingInfo(
        clientId,
        google_location_name,
      );
      pendingChanges = [...fields].map((field) => ({
        field,
        submitted: describeField(field, loc, typeNames), // tumhara bheja hua
        live: describeField(field, live, typeNames), // Google pe abhi dikh raha
      }));
    }
    return {
      is_mock: false,
      location_id: loc.name,
      business_name: loc.title,
      location_name: loc.title,
      category: loc.categories?.primaryCategory?.displayName || "",
      category_id: loc.categories?.primaryCategory?.name || "",
      address: [
        ...(addr.addressLines || []),
        addr.locality,
        addr.administrativeArea,
      ]
        .filter(Boolean)
        .join(", "),
      phone: loc.phoneNumbers?.primaryPhone || "",
      website: loc.websiteUri || "",
      services: (loc.serviceItems || [])
        .map((item) => {
          const id = item.structuredServiceItem?.serviceTypeId;
          if (id) return typeNames.get(id) || id;
          return item.freeFormServiceItem?.label?.displayName || "";
        })
        .filter(Boolean),
      opening_hours: loc.regularHours || {},
      can_modify_services: loc.metadata?.canModifyServiceList !== false,
      rating: 0,
      review_count: 0,
      connection_status: "GOOGLE_CONNECTED",
      has_pending_edits: Boolean(loc.metadata?.hasPendingEdits),
      pending_fields: pendingChanges.map((p) => p.field),
      pending_changes: pendingChanges,
    };
  }

  /**
   * ONE read + ONE PATCH (only if something changed).
   * Returns { ok, changed: [...fields], skipped: [...] }.
   */
  async updateProfile(clientId, payload = {}) {
    const { google_location_name, location: current } =
      await this.#getLocation(clientId);

    const pending = current.metadata?.hasPendingEdits
      ? (await this.#getPendingInfo(clientId, google_location_name)).fields
      : new Set();

    const body = {};
    const mask = [];
    const skipped = [];

    const want = (field) => {
      if (pending.has(field)) {
        skipped.push({ field, reason: "PENDING_REVIEW" });
        return false;
      }
      return true;
    };

    /* TITLE */
    if (payload.location_name !== undefined) {
      const v = String(payload.location_name || "")
        .trim()
        .replace(/\s+/g, " ");
      const cur = String(current.title || "")
        .trim()
        .replace(/\s+/g, " ");
      if (v && v !== cur && want("title")) {
        body.title = v;
        mask.push("title");
      }
    }

    /* PHONE */
    if (payload.phone !== undefined) {
      const v = String(payload.phone || "").trim();
      if (
        v !== (current.phoneNumbers?.primaryPhone || "") &&
        want("phoneNumbers")
      ) {
        body.phoneNumbers = {
          primaryPhone: v,
          ...(current.phoneNumbers?.additionalPhones?.length
            ? { additionalPhones: current.phoneNumbers.additionalPhones }
            : {}),
        };
        mask.push("phoneNumbers");
      }
    }

    /* WEBSITE */
    if (payload.website !== undefined) {
      const v = String(payload.website || "").trim();
      if (v !== (current.websiteUri || "") && want("websiteUri")) {
        body.websiteUri = v;
        mask.push("websiteUri");
      }
    }

    /* CATEGORY */
    let categoryChanged = false;
    if (
      payload.category_id &&
      payload.category_id !== current.categories?.primaryCategory?.name &&
      want("categories")
    ) {
      body.categories = {
        primaryCategory: { name: payload.category_id },
        additionalCategories: (
          current.categories?.additionalCategories || []
        ).map((c) => ({ name: c.name })),
      };
      mask.push("categories");
      categoryChanged = true;
    }

    /* HOURS */
    if (payload.opening_hours !== undefined) {
      const next = normalizeGoogleHours(payload.opening_hours);
      if (
        hoursKey(next) !== hoursKey(current.regularHours) &&
        want("regularHours")
      ) {
        body.regularHours = next;
        mask.push("regularHours");
      }
    }

    /* SERVICES */
    if (payload.services !== undefined) {
      if (!Array.isArray(payload.services)) {
        throw new Error("Services must be an array.");
      }

      const primary = current.categories?.primaryCategory;

      if (categoryChanged) {
        skipped.push({ field: "serviceItems", reason: "CATEGORY_CHANGED" });
      } else if (current.metadata?.canModifyServiceList === false) {
        skipped.push({ field: "serviceItems", reason: "NOT_ALLOWED" });
      } else if (!primary) {
        throw new Error(
          "Google primary business category could not be determined.",
        );
      } else {
        const items = buildServiceItems(primary, payload.services);
        if (
          serviceItemsKey(items) !== serviceItemsKey(current.serviceItems) &&
          want("serviceItems")
        ) {
          body.serviceItems = items;
          mask.push("serviceItems");
        }
      }
    }

    /* nothing to send */
    if (!mask.length) {
      const blocked = skipped.filter((s) => s.reason === "PENDING_REVIEW");
      if (blocked.length) {
        const err = new Error(
          `Ye fields abhi Google review me hain: ${blocked
            .map((s) => s.field)
            .join(", ")}. Review complete hone ke baad save karo.`,
        );
        err.status = 409;
        err.googleReason = "PENDING_EDITS";
        err.pendingFields = blocked.map((s) => s.field);
        throw err;
      }
      return { ok: true, changed: [], skipped, location: null };
    }

    console.log("[GBP] PATCH mask:", mask, "skipped:", skipped);

    const updated = await this.#call(
      clientId,
      `${INFO}/${google_location_name}?updateMask=${encodeURIComponent(mask.join(","))}`,
      { method: "PATCH", body },
    );

    return { ok: true, changed: mask, skipped, location: updated };
  }

  /** Kept for compatibility, routes through the single-PATCH flow. */
  async updateServices(clientId, services = []) {
    return this.updateProfile(clientId, { services });
  }

  async getPosts(clientId, limit = 20) {
    const { google_account_id, google_location_name } =
      await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();
    const data = await this.#call(
      clientId,
      `${V4}/${google_account_id}/locations/${locId}/localPosts?pageSize=${Number(limit)}`,
    );
    return (data.localPosts || []).map((p) => ({
      id: p.name,
      external_id: p.name,
      title: p.summary?.slice(0, 120) || "",
      description: p.summary || "",
      cta: p.callToAction?.actionType || "",
      image_url: p.media?.[0]?.googleUrl || null,
      post_type: p.topicType || "STANDARD",
      status: p.state || "LIVE",
      published_at: p.createTime,
      is_mock: false,
    }));
  }

  #postPayload(post) {
    return {
      languageCode: "en",
      summary: [post.title, post.description]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 1500),
      topicType: "STANDARD",
      ...(post.cta_url
        ? { callToAction: { actionType: "LEARN_MORE", url: post.cta_url } }
        : {}),
      ...(post.public_image_url
        ? {
            media: [{ mediaFormat: "PHOTO", sourceUrl: post.public_image_url }],
          }
        : {}),
    };
  }

  /** Real publish. */
  async createPost(clientId, post) {
    const { google_account_id, google_location_name } =
      await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();

    const created = await this.#call(
      clientId,
      `${V4}/${google_account_id}/locations/${locId}/localPosts`,
      { method: "POST", body: this.#postPayload(post) },
    );

    const tenantRow = await one("SELECT tenant_id FROM clients WHERE id=?", [
      clientId,
    ]);
    const id = await insert("gmb_posts", {
      tenant_id: post.tenant_id || tenantRow?.tenant_id || null,
      client_id: clientId,
      task_id: post.task_id || null,
      title: post.title,
      description: post.description,
      cta: post.cta,
      image_url: post.image_url,
      post_type: post.post_type,
      status: "PUBLISHED",
      provider: "google",
      is_mock: 0,
      external_id: created.name || null,
      published_at: new Date(),
    });

    return {
      id,
      external_id: created.name,
      is_mock: false,
      published_at: new Date().toISOString(),
    };
  }

  /** Update a live post. postName = full localPosts resource name. */
  async updatePost(clientId, postName, post) {
    const maskFields = ["summary"];
    if (post.cta_url) maskFields.push("callToAction");
    if (post.public_image_url) maskFields.push("media");

    const updated = await this.#call(
      clientId,
      `${V4}/${postName}?updateMask=${encodeURIComponent(maskFields.join(","))}`,
      { method: "PATCH", body: this.#postPayload(post) },
    );
    return {
      external_id: updated.name || postName,
      is_mock: false,
      updated_at: new Date().toISOString(),
    };
  }

  /** Delete a live post. */
  async deletePost(clientId, postName) {
    await this.#call(clientId, `${V4}/${postName}`, { method: "DELETE" });
    return { ok: true, is_mock: false };
  }
async getReviews(clientId) {
  const { google_account_id, google_location_name } =
    await this.#ids(clientId);

  const locId = google_location_name.split("/").pop();

  const url =
    `${V4}/${google_account_id}` +
    `/locations/${locId}/reviews?pageSize=50`;

  const data = await this.#call(clientId, url);

  const reviews = Array.isArray(data.reviews)
    ? data.reviews
    : [];

  return {
    is_mock: false,

    average_rating: Number(
      data.averageRating || 0
    ),

    total: Number(
      data.totalReviewCount || 0
    ),

    returned_count: reviews.length,

    items: reviews.map((r) => ({
      id: r.reviewId,

      name: r.name,

      author:
        r.reviewer?.displayName ||
        "Google user",

      profile_photo:
        r.reviewer?.profilePhotoUrl ||
        null,

      rating:
        r.starRating ||
        null,

      comment:
        r.comment ||
        "",

      created_at:
        r.createTime ||
        null,

      updated_at:
        r.updateTime ||
        null,

      replied:
        Boolean(r.reviewReply),

      reply: r.reviewReply
        ? {
            comment:
              r.reviewReply.comment ||
              "",

            updated_at:
              r.reviewReply.updateTime ||
              null,
          }
        : null,

      review_reply_url:
        r.reviewReplyUrl ||
        null,
    })),

    note:
      Number(data.totalReviewCount || 0) > 0 &&
      reviews.length === 0
        ? "Google reports reviews for this location but review details are temporarily unavailable."
        : null,
  };
}
  /* =========================================================
     REVIEWS - single item, reply, delete reply
  ========================================================= */

  async getReview(clientId, reviewId) {
    const { google_account_id, google_location_name } =
      await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();
    const id = sanitizeReviewId(reviewId);
    const raw = await this.#call(
      clientId,
      `${V4}/${google_account_id}/locations/${locId}/reviews/${id}`,
    );
    return normalizeReview(raw);
  }

  /** Publish/update the business owner's reply. Never trust reviewId blindly — scoped to this client's location. */
  async replyToReview(clientId, reviewId, reply) {
    const text = String(reply || "").trim();
    if (!text) throw new Error("Reply cannot be empty.");
    if (text.length > 4096) throw new Error("Reply is too long.");

    const { google_account_id, google_location_name } =
      await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();
    const id = sanitizeReviewId(reviewId);

    const raw = await this.#call(
      clientId,
      `${V4}/${google_account_id}/locations/${locId}/reviews/${id}/reply`,
      { method: "PUT", body: { comment: text }, retries: 0 },
    );

    return {
      ok: true,
      comment: raw.comment || text,
      updated_at: raw.updateTime || new Date().toISOString(),
    };
  }

  /** Deletes only the merchant's reply. Never touches the customer's review itself. */
  async deleteReviewReply(clientId, reviewId) {
    const { google_account_id, google_location_name } =
      await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();
    const id = sanitizeReviewId(reviewId);

    await this.#call(
      clientId,
      `${V4}/${google_account_id}/locations/${locId}/reviews/${id}/reply`,
      { method: "DELETE", retries: 0 },
    );
    return { ok: true };
  }

  /* =========================================================
     MEDIA
  ========================================================= */

  /** Full media resource name, scoped + validated against this client's own location. */
  async #resolveMediaName(clientId, mediaNameOrId) {
    const { google_account_id, google_location_name } =
      await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();
    const prefix = `${google_account_id}/locations/${locId}/media/`;

    let full = String(mediaNameOrId || "");
    if (!full.includes("/")) full = `${prefix}${full}`;

    if (!full.startsWith(prefix) || !/^[\w\-/]+$/.test(full)) {
      throw new Error("Media item does not belong to this location.");
    }
    return full;
  }

  async getMedia(clientId) {
    const { google_account_id, google_location_name } =
      await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();
    const data = await this.#call(
      clientId,
      `${V4}/${google_account_id}/locations/${locId}/media?pageSize=100`,
    );
    return (data.mediaItems || []).map(normalizeMediaItem);
  }

  async getMediaItem(clientId, mediaName) {
    const full = await this.#resolveMediaName(clientId, mediaName);
    const raw = await this.#call(clientId, `${V4}/${full}`);
    return normalizeMediaItem(raw);
  }

  async uploadMediaFile(
  clientId,
  {
    buffer,
    mimeType,
    category = "ADDITIONAL",
    description = null,
  } = {},
) {
  if (!buffer || !buffer.length) {
    throw new Error("Media file is required.");
  }

  if (!category || !MEDIA_CATEGORIES.includes(category)) {
    throw new Error("Invalid media category.");
  }

  const isImage = String(mimeType || "").startsWith("image/");
  const isVideo = String(mimeType || "").startsWith("video/");

  if (!isImage && !isVideo) {
    throw new Error("Only image or video files are allowed.");
  }

  const mediaFormat = isVideo ? "VIDEO" : "PHOTO";

  const { google_account_id, google_location_name } =
    await this.#ids(clientId);

  const locId = google_location_name.split("/").pop();

  /*
   * STEP 1
   * Ask Google for upload resource
   */
  const uploadRef = await this.#call(
    clientId,
    `${V4}/${google_account_id}/locations/${locId}/media:startUpload`,
    {
      method: "POST",
      retries: 0,
    },
  );

  const resourceName = uploadRef?.resourceName;

  if (!resourceName) {
    throw new Error(
      "Google did not return a media upload resource.",
    );
  }

  /*
   * STEP 2
   * Upload actual bytes
   */
  await this.#uploadMediaBytes(
    clientId,
    resourceName,
    buffer,
    mimeType,
  );

  /*
   * STEP 3
   * Create GBP media item using dataRef
   */
  const body = {
    mediaFormat,

    locationAssociation: {
      category,
    },

    dataRef: {
      resourceName,
    },

    ...(description && category !== "COVER"
      ? {
          description: String(description).slice(0, 300),
        }
      : {}),
  };

  const raw = await this.#call(
    clientId,
    `${V4}/${google_account_id}/locations/${locId}/media`,
    {
      method: "POST",
      body,
      retries: 0,
    },
  );

  return normalizeMediaItem(raw);
}

  async uploadMedia(
    clientId,
    { sourceUrl, category, description = null, mediaFormat = "PHOTO" } = {},
  ) {
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
      throw new Error("A valid image/video URL is required.");
    }
    if (!MEDIA_FORMATS.includes(mediaFormat)) {
      throw new Error("Invalid media format.");
    }
    if (!category || !MEDIA_CATEGORIES.includes(category)) {
      throw new Error("Invalid media category.");
    }

    const { google_account_id, google_location_name } =
      await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();

    const body = {
      mediaFormat,
      locationAssociation: { category },
      sourceUrl,
      ...(description
        ? { description: String(description).slice(0, 300) }
        : {}),
    };

    const raw = await this.#call(
      clientId,
      `${V4}/${google_account_id}/locations/${locId}/media`,
      { method: "POST", body, retries: 0 },
    );
    return normalizeMediaItem(raw);
  }

  async deleteMedia(clientId, mediaName) {
    const full = await this.#resolveMediaName(clientId, mediaName);
    await this.#call(clientId, `${V4}/${full}`, {
      method: "DELETE",
      retries: 0,
    });
    return { ok: true };
  }

  async getPerformance(clientId, options = {}) {
    const { google_location_name } = await this.#ids(clientId);
    const locId = google_location_name.split("/").pop();

    const opts =
      typeof options === "number" ? { days: options } : options || {};
    const { startDate, endDate, days = 30 } = opts;

    let start;
    let end;

    if (startDate && endDate) {
      start = new Date(`${startDate}T00:00:00`);
      end = new Date(`${endDate}T00:00:00`);
    } else {
      const clampedDays = Math.min(Number(days) || 30, 540);
      end = new Date();
      start = new Date();
      start.setDate(start.getDate() - clampedDays);
    }

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Invalid performance date range");
    }
    if (start > end) {
      throw new Error("Start date cannot be after end date");
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    if (diffDays > 540) {
      throw new Error("Performance date range cannot exceed 18 months");
    }

    const metrics = [
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
      "WEBSITE_CLICKS",
      "CALL_CLICKS",
      "BUSINESS_DIRECTION_REQUESTS",
    ];

    const params = new URLSearchParams();
    for (const m of metrics) params.append("dailyMetrics", m);

    params.set("dailyRange.start_date.year", String(start.getFullYear()));
    params.set("dailyRange.start_date.month", String(start.getMonth() + 1));
    params.set("dailyRange.start_date.day", String(start.getDate()));
    params.set("dailyRange.end_date.year", String(end.getFullYear()));
    params.set("dailyRange.end_date.month", String(end.getMonth() + 1));
    params.set("dailyRange.end_date.day", String(end.getDate()));

    const data = await this.#call(
      clientId,
      `${PERF}/locations/${locId}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`,
    );

    const byDate = new Map();

    for (const series of data.multiDailyMetricTimeSeries || []) {
      for (const item of series.dailyMetricTimeSeries || []) {
        const metric = item.dailyMetric;

        for (const point of item.timeSeries?.datedValues || []) {
          const d = point.date;
          const key = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

          const row = byDate.get(key) || {
            stat_date: key,
            views: 0,
            clicks: 0,
            calls: 0,
            direction_requests: 0,
          };

          const value = Number(point.value || 0);

          if (metric.includes("IMPRESSIONS")) row.views += value;
          else if (metric === "WEBSITE_CLICKS") row.clicks += value;
          else if (metric === "CALL_CLICKS") row.calls += value;
          else if (metric === "BUSINESS_DIRECTION_REQUESTS")
            row.direction_requests += value;

          byDate.set(key, row);
        }
      }
    }

    return {
      is_mock: false,
      startDate: formatGoogleDate(start),
      endDate: formatGoogleDate(end),
      series: [...byDate.values()].sort((a, b) =>
        a.stat_date.localeCompare(b.stat_date),
      ),
    };
  }

  /** Monthly search-keyword impressions. Shows what customers searched to find the business. */
  async getSearchKeywords(
    clientId,
    {
      startMonth = null,
      endMonth = null,
      pageSize = 100,
      pageToken = null,
    } = {},
  ) {
    const { google_location_name } = await this.#ids(clientId);

    const now = new Date();
    const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const defStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const defaultStart = `${defStartDate.getFullYear()}-${String(defStartDate.getMonth() + 1).padStart(2, "0")}`;

    const sm = parseYearMonth(startMonth || defaultStart);
    const em = parseYearMonth(endMonth || defaultEnd);

    const params = new URLSearchParams();
    params.set("monthlyRange.start_month.year", String(sm.year));
    params.set("monthlyRange.start_month.month", String(sm.month));
    params.set("monthlyRange.end_month.year", String(em.year));
    params.set("monthlyRange.end_month.month", String(em.month));
    params.set("pageSize", String(Math.min(Number(pageSize) || 100, 100)));
    if (pageToken) params.set("pageToken", pageToken);

    const data = await this.#call(
      clientId,
      `${PERF}/${google_location_name}/searchkeywords/impressions/monthly?${params.toString()}`,
    );

    const keywords = (data.searchKeywordsCounts || [])
      .map((k) => ({
        keyword: k.searchKeyword,
        impressions: Number(k.insightsValue?.value ?? 0),
      }))
      .filter((k) => k.keyword)
      .sort((a, b) => b.impressions - a.impressions);

    return {
      startMonth: `${sm.year}-${String(sm.month).padStart(2, "0")}`,
      endMonth: `${em.year}-${String(em.month).padStart(2, "0")}`,
      keywords,
      nextPageToken: data.nextPageToken || null,
    };
  }

  async diagnose(clientId, { full = false } = {}) {
    const { google_location_name, location } =
      await this.#getLocation(clientId);

    const typeNames = new Map(
      (location.categories?.primaryCategory?.serviceTypes || []).map((t) => [
        t.serviceTypeId,
        t.displayName,
      ]),
    );

    const { fields, diff, live } = await this.#getPendingInfo(
      clientId,
      google_location_name,
    );

    const pendingFields = [...fields];
    const diffFields = [...diff];

    const result = {
      title: location.title,
      hasPendingEdits: Boolean(location.metadata?.hasPendingEdits),
      hasGoogleUpdated: Boolean(location.metadata?.hasGoogleUpdated),
      hasVoiceOfMerchant: location.metadata?.hasVoiceOfMerchant !== false,
      canModifyServiceList: location.metadata?.canModifyServiceList !== false,
      pendingFields,
      diffFields,
      pendingChanges: pendingFields.map((field) => ({
        field,
        submitted: describeField(field, location, typeNames),
        live: describeField(field, live, typeNames),
      })),
      diffChanges: diffFields.map((field) => ({
        field,
        yours: describeField(field, location, typeNames),
        google: describeField(field, live, typeNames),
      })),
      checkedAt: new Date().toISOString(),
    };

    // heavy checks only on ?full=1
    if (full) {
      try {
        result.voiceOfMerchant = await this.#call(
          clientId,
          `https://mybusinessverifications.googleapis.com/v1/${google_location_name}/VoiceOfMerchantState`,
        );
      } catch (e) {
        result.voiceOfMerchant = { error: e.message };
      }

      const tests = {
        title: { title: location.title },
        websiteUri: {
          websiteUri: location.websiteUri || "https://example.com",
        },
      };
      result.fieldCheck = {};
      for (const [field, body] of Object.entries(tests)) {
        try {
          await this.#call(
            clientId,
            `${INFO}/${google_location_name}?updateMask=${field}&validateOnly=true`,
            { method: "PATCH", body },
          );
          result.fieldCheck[field] = "OK";
        } catch (e) {
          result.fieldCheck[field] =
            `${e.status} ${e.googleReason || ""}`.trim();
        }
      }
    }

    return result;
  }
  /* =========================================================
     VERIFICATIONS API
  ========================================================= */

  /** Voice of Merchant state for this location. Usable standalone or via diagnose(). */
  async getVoiceOfMerchantState(clientId) {
    const { google_location_name } = await this.#ids(clientId);
    const raw = await this.#call(
      clientId,
      `${VERIFICATIONS}/${google_location_name}/VoiceOfMerchantState`,
    );
    return {
      hasVoiceOfMerchant: Boolean(raw.hasVoiceOfMerchant),
      needsVerification: Boolean(
        raw.hasBusinessAuthority === false || raw.verify,
      ),
      raw,
    };
  }

  /** Available verification methods for this location. Never hardcode. */
  async getVerificationOptions(
    clientId,
    { languageCode = "en", context = null } = {},
  ) {
    const { google_location_name } = await this.#ids(clientId);
    const body = { languageCode, ...(context ? { context } : {}) };
    const data = await this.#call(
      clientId,
      `${VERIFICATIONS}/${google_location_name}:fetchVerificationOptions`,
      { method: "POST", body },
    );
    const options = (data.options || []).map((o) => ({
      method: o.verificationMethod || o.method,
      phoneNumber: maskPhone(o.phoneNumber),
      address: o.addressData
        ? { addressLine: o.addressData?.address?.addressLines?.[0] || null }
        : null,
      email: maskEmail(o.emailAddress),
      announcement: o.announcement || null,
    }));
    return { options };
  }

  /** Start verification. Method must come from getVerificationOptions — never trust the frontend. */
  async startVerification(
    clientId,
    { method, languageCode = "en", context = null, emailInput = null } = {},
  ) {
    if (!method || !VERIFICATION_METHODS.includes(method)) {
      throw new Error("Invalid verification method.");
    }

    const { options } = await this.getVerificationOptions(clientId, {
      languageCode,
      context,
    });
    if (!options.some((o) => o.method === method)) {
      throw new Error(
        `Verification method ${method} is not currently offered for this location.`,
      );
    }

    const { google_location_name } = await this.#ids(clientId);
    const body = { method, languageCode };
    if (context) body.context = context;
    if (method === "EMAIL" && emailInput) body.emailInput = emailInput;

    const raw = await this.#call(
      clientId,
      `${VERIFICATIONS}/${google_location_name}:verify`,
      { method: "POST", body },
    );

    return {
      ok: true,
      verificationName: raw.name || raw.verification?.name || null,
      method,
      state: raw.state || raw.verification?.state || "PENDING",
      raw,
    };
  }

  /** Verification attempt history for the admin dashboard. */
  async listVerifications(clientId) {
    const { google_location_name } = await this.#ids(clientId);
    const data = await this.#call(
      clientId,
      `${VERIFICATIONS}/${google_location_name}/verifications`,
    );
    return (data.verifications || []).map((v) => ({
      name: v.name,
      method: v.method,
      state: v.state,
      createTime: v.createTime,
      completeTime: v.completeTime,
    }));
  }

  /** Complete a pending non-AUTO verification with the received PIN. Never log/store the PIN. */
  async completeVerification(clientId, verificationName, pin) {
    if (
      !/^[a-zA-Z0-9_\-./]+\/verifications\/[a-zA-Z0-9_-]+$/.test(
        String(verificationName || ""),
      )
    ) {
      throw new Error("Invalid verification resource name.");
    }
    const cleanPin = String(pin ?? "").trim();
    if (!cleanPin || cleanPin.length > 12) {
      throw new Error("Invalid PIN.");
    }

    try {
      const raw = await this.#call(
        clientId,
        `${VERIFICATIONS}/${verificationName}:complete`,
        { method: "POST", body: { pin: cleanPin }, retries: 0 },
      );
      return {
        ok: true,
        state: raw.verification?.state || raw.state || "COMPLETED",
      };
    } catch (e) {
      throw new Error(
        `Verification completion failed: ${e.message}`.replace(cleanPin, "***"),
      );
    }
  }

  /** Combined, frontend-friendly verification status. */
  async getVerificationStatus(clientId) {
    const [{ location }, vom] = await Promise.all([
      this.#getLocation(clientId, "metadata"),
      this.getVoiceOfMerchantState(clientId).catch((e) => ({
        hasVoiceOfMerchant: false,
        needsVerification: true,
        raw: { error: e.message },
      })),
    ]);

    let verifications = [];
    try {
      verifications = await this.listVerifications(clientId);
    } catch {
      verifications = [];
    }

    const latestVerification =
      verifications
        .slice()
        .sort(
          (a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0),
        )[0] || null;

    const hasVoiceOfMerchant =
      vom.hasVoiceOfMerchant !== false &&
      location.metadata?.hasVoiceOfMerchant !== false;
    const verified = hasVoiceOfMerchant && !vom.needsVerification;

    return {
      verified,
      hasVoiceOfMerchant,
      requiresAction: !verified,
      availableActions: verified ? [] : ["VERIFY"],
      latestVerification,
      message: verified
        ? "Business profile is verified"
        : "Business verification required",
    };
  }

  /* =========================================================
     NOTIFICATIONS API (Pub/Sub config, not polling)
  ========================================================= */

  async getNotificationSettings(clientId) {
    const { google_account_id } = await this.#ids(clientId);
    const raw = await this.#call(
      clientId,
      `${NOTIFICATIONS}/${google_account_id}/notificationSetting`,
    );
    return {
      enabled: Boolean(raw.pubsubTopic),
      pubsubTopic: raw.pubsubTopic || null,
      notificationTypes: raw.notificationTypes || [],
    };
  }

  async updateNotificationSettings(
    clientId,
    { pubsubTopic, notificationTypes = [] } = {},
  ) {
    if (!/^projects\/[^/]+\/topics\/[^/]+$/.test(String(pubsubTopic || ""))) {
      throw new Error(
        "Invalid Pub/Sub topic format. Expected projects/{project}/topics/{topic}.",
      );
    }
    const types = notificationTypes.filter((t) =>
      NOTIFICATION_TYPES.includes(t),
    );
    if (!types.length) {
      throw new Error("No valid notification types provided.");
    }

    const { google_account_id } = await this.#ids(clientId);
    const raw = await this.#call(
      clientId,
      `${NOTIFICATIONS}/${google_account_id}/notificationSetting?updateMask=pubsubTopic,notificationTypes`,
      { method: "PATCH", body: { pubsubTopic, notificationTypes: types } },
    );
    return {
      enabled: Boolean(raw.pubsubTopic),
      pubsubTopic: raw.pubsubTopic || null,
      notificationTypes: raw.notificationTypes || [],
    };
  }

  /** Disable by clearing topic + types. */
  async disableNotifications(clientId) {
    const { google_account_id } = await this.#ids(clientId);
    const raw = await this.#call(
      clientId,
      `${NOTIFICATIONS}/${google_account_id}/notificationSetting?updateMask=pubsubTopic,notificationTypes`,
      { method: "PATCH", body: { pubsubTopic: "", notificationTypes: [] } },
    );
    return {
      enabled: Boolean(raw.pubsubTopic),
      pubsubTopic: raw.pubsubTopic || null,
      notificationTypes: raw.notificationTypes || [],
    };
  }

  /** Store fetched metrics so analytics keeps working offline. */
  async cachePerformance(clientId) {
    const { series } = await this.getPerformance(clientId, { days: 30 });
    const tRow = await one("SELECT tenant_id FROM clients WHERE id=?", [
      clientId,
    ]);

    await query("DELETE FROM gmb_performance WHERE client_id=? AND is_mock=0", [
      clientId,
    ]);

    for (const row of series) {
      await insert("gmb_performance", {
        tenant_id: tRow?.tenant_id || null,
        client_id: clientId,
        ...row,
        is_mock: 0,
      });
    }
    return series.length;
  }
}
