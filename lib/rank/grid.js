import { query, one, insert, update } from "../db.js";
import { getIntegration } from "../integrations/store.js";
import { getSettings } from "../saas/settings.js";
import { hit } from "../api/rateLimiter.js";
import { mapZoom } from "./geo.js";

const FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount";
const bad = (m, status = 400) => Object.assign(new Error(m), { status });

async function placesKey() {
  const i = await getIntegration("google_places").catch(() => null);
  return i?.enabled && i.values.api_key ? i.values.api_key : null;
}

async function searchText(key, textQuery, bias) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({ textQuery, pageSize: 20, ...(bias ? { locationBias: { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: bias.radius || 2000 } } } : {}) }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Places API ${res.status}: ${json?.error?.message || ""}`.slice(0, 200));
  return (json.places || []).map((p) => ({
    place_id: p.id,
    name: p.displayName?.text || "",
    address: p.formattedAddress || "",
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? 0,
  }));
}

/** Grid points: size x size, `spacingKm` apart, centred on the business. */
export function gridPoints(lat, lng, size, spacingKm) {
  const half = (size - 1) / 2;
  const dLat = spacingKm / 111.32;
  const dLng = spacingKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const pts = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      pts.push({ row: r, col: c, lat: +(lat + (half - r) * dLat).toFixed(6), lng: +(lng + (c - half) * dLng).toFixed(6) });
    }
  }
  return pts;
}

/** Candidates for "which Google listing is this client?" */
export async function locateListing(clientId, tenantId, q = null) {
  const c = await one("SELECT business_name, city, address, place_id, latitude, longitude FROM clients WHERE id=? AND tenant_id=?", [clientId, tenantId]);
  if (!c) throw bad("Client not found", 404);
  const key = await placesKey() || process.env.GOOGLE_PLACES_API_KEY;
  console.log("Key",key)
  if (!key) return { sample: true, current: c.place_id ? { place_id: c.place_id, lat: c.latitude, lng: c.longitude } : null, candidates: [] };
  const candidates = (await searchText(key, q || `${c.business_name} ${c.city || c.address || ""}`.trim())).slice(0, 6);
  return { sample: false, current: c.place_id ? { place_id: c.place_id, lat: Number(c.latitude), lng: Number(c.longitude) } : null, candidates };
}

export async function setListing(clientId, tenantId, { place_id, lat, lng }) {
  if (!place_id || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) throw bad("place_id, lat and lng are required.");
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw bad("Invalid coordinates.");
  const r = await query("UPDATE clients SET place_id=?, latitude=?, longitude=? WHERE id=? AND tenant_id=?", [String(place_id).slice(0, 190), Number(lat), Number(lng), clientId, tenantId]);
  if (!r.affectedRows) throw bad("Client not found", 404);
}

/** Validates + creates the scan row. Runs it with runScan() (in the background). */
export async function createScan({ clientId, tenantId, keyword, gridSize = 5, spacingKm = 1, actor }) {
  const settings = await getSettings();
  const size = Number(gridSize);
  if (![3, 5, 7, 9].includes(size) || size > Number(settings.rank_max_grid || 7)) throw bad(`Grid size must be 3, 5 or ${settings.rank_max_grid || 7}.`);
  const spacing = Math.min(Math.max(Number(spacingKm) || 1, 0.2), 10);
  const kw = String(keyword || "").trim().slice(0, 160);
  if (kw.length < 2) throw bad("Keyword is required.");
  const c = await one("SELECT id, place_id, latitude, longitude FROM clients WHERE id=? AND tenant_id=?", [clientId, tenantId]);
  if (!c) throw bad("Client not found", 404);
  const key = await placesKey();
  if (key && (!c.place_id || c.latitude == null)) throw bad("Pick this client's Google listing first (Locate listing).", 409);
  const quota = await hit(`tenant:${tenantId}:rankscan`, { limit: Number(settings.rank_scans_per_day || 20), windowSec: 86400 });
  if (!quota.allowed) throw Object.assign(bad(`Daily rank-scan limit reached (${quota.limit}/day).`, 429), { code: "RATE_LIMITED" });

  const lat = c.latitude != null ? Number(c.latitude) : 28.6139; // sample mode default: New Delhi
  const lng = c.longitude != null ? Number(c.longitude) : 77.209;
  return insert("rank_scans", {
    tenant_id: tenantId, client_id: clientId, keyword: kw, grid_size: size, spacing_km: spacing,
    center_lat: lat, center_lng: lng, place_id: c.place_id || `sample-${clientId}`, status: "QUEUED",
    is_sample: key ? 0 : 1, created_by: actor || null,
  });
}

function sampleRank(seed, dist) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  const noise = x - Math.floor(x);
  const r = Math.round(1 + dist * 2.2 + noise * 6);
  return r > 20 ? null : r;
}

export async function runScan(scanId) {
  console.log(`[RankScan] Starting scan. scanId=${scanId}`);

  const s = await one(
    "SELECT * FROM rank_scans WHERE id=?",
    [scanId]
  );

  if (!s) {
    console.log(`[RankScan] Scan not found. scanId=${scanId}`);
    return;
  }

  if (s.status !== "QUEUED") {
    console.log(
      `[RankScan] Scan skipped. scanId=${scanId}, status=${s.status}`
    );
    return;
  }

  await update("rank_scans", s.id, {
    status: "RUNNING",
  });

  console.log(`[RankScan] Status changed to RUNNING. scanId=${s.id}`);

  try {
    const dbKey = await placesKey();
    const envKey = process.env.GOOGLE_PLACES_API_KEY;

    const key = dbKey || envKey;

    console.log(
      `[RankScan] Places API key source: ${
        dbKey ? "database" : envKey ? "environment" : "not-found"
      }`
    );

    if (!key) {
      throw new Error("Google Places API key is not configured.");
    }

    console.log("[RankScan] Scan config:", {
      scanId: s.id,
      clientId: s.client_id,
      tenantId: s.tenant_id,
      placeId: s.place_id,
      keyword: s.keyword,
      centerLat: s.center_lat,
      centerLng: s.center_lng,
      gridSize: s.grid_size,
      spacingKm: s.spacing_km,
    });

    const pts = gridPoints(
      Number(s.center_lat),
      Number(s.center_lng),
      Number(s.grid_size),
      Number(s.spacing_km)
    );

    console.log(
      `[RankScan] Grid generated. Total points=${pts.length}`
    );

    const comp = new Map();
    const results = [];

    let done = 0;

    for (const p of pts) {
      let rank = null;
      let top = [];

      console.log(
        `[RankScan] Searching point ${done + 1}/${pts.length}`,
        {
          row: p.row,
          col: p.col,
          lat: p.lat,
          lng: p.lng,
        }
      );

      try {
        const radius = Math.max(
          500,
          Number(s.spacing_km) * 700
        );

        const places = await searchText(
          key,
          s.keyword,
          {
            lat: p.lat,
            lng: p.lng,
            radius,
          }
        );

        console.log(
          `[RankScan] Places returned=${places.length} for point ${done + 1}`
        );

        const idx = places.findIndex(
          (x) => x.place_id === s.place_id
        );

        rank = idx >= 0 ? idx + 1 : null;

        console.log(
          `[RankScan] Target business ${
            rank ? `found at rank ${rank}` : "not found"
          }`,
          {
            point: done + 1,
            placeId: s.place_id,
          }
        );

        top = places.slice(0, 3).map((x) => ({
          name: x.name,
          rating: x.rating,
          reviews: x.reviews,
          place_id: x.place_id,
        }));

        places.forEach((x, i) => {
          if (!x.place_id) return;

          // Don't count own business as competitor
          if (x.place_id === s.place_id) return;

          const existing = comp.get(x.place_id) || {
            place_id: x.place_id,
            name: x.name,
            rating: x.rating,
            reviews: x.reviews,
            appearances: 0,
            rankSum: 0,
          };

          existing.appearances += 1;
          existing.rankSum += i + 1;

          // Keep latest available business information
          if (x.name) existing.name = x.name;
          if (x.rating !== undefined) {
            existing.rating = x.rating;
          }
          if (x.reviews !== undefined) {
            existing.reviews = x.reviews;
          }

          comp.set(x.place_id, existing);
        });
      } catch (pointError) {
        console.error(
          `[RankScan] Point search failed. scanId=${s.id}`,
          {
            row: p.row,
            col: p.col,
            lat: p.lat,
            lng: p.lng,
            error: pointError?.message || pointError,
          }
        );

        /*
         * We don't generate any sample/fake result here.
         *
         * This point is stored as rank=null so the complete scan can
         * continue even if one Google request fails.
         */
      }

      results.push({
        ...p,
        rank,
        top,
      });

      done += 1;

      if (done % 5 === 0 || done === pts.length) {
        await update("rank_scans", s.id, {
          points_done: done,
        });

        console.log(
          `[RankScan] Progress ${done}/${pts.length}`
        );
      }
    }

    const found = results.filter(
      (r) => r.rank !== null && r.rank !== undefined
    );

    const competitors = [...comp.values()]
      .filter((e) => e.appearances > 0)
      .map((e) => ({
        place_id: e.place_id,
        name: e.name,
        rating: e.rating,
        reviews: e.reviews,
        appearances: e.appearances,
        avg_rank: +(
          e.rankSum / e.appearances
        ).toFixed(1),
      }))
      .sort(
        (a, b) =>
          b.appearances - a.appearances ||
          a.avg_rank - b.avg_rank
      )
      .slice(0, 10);

    /*
     * Business not found in Google's returned results
     * counts as rank 21 for average rank.
     */
    const avgRank =
      results.length > 0
        ? +(
            results.reduce(
              (sum, r) => sum + (r.rank || 21),
              0
            ) / results.length
          ).toFixed(2)
        : null;

    const top3Pct =
      results.length > 0
        ? Math.round(
            (results.filter(
              (r) => r.rank && r.rank <= 3
            ).length /
              results.length) *
              100
          )
        : 0;

    const foundPct =
      results.length > 0
        ? Math.round(
            (found.length / results.length) * 100
          )
        : 0;

    console.log("[RankScan] Scan calculated:", {
      scanId: s.id,
      totalPoints: results.length,
      foundPoints: found.length,
      avgRank,
      top3Pct,
      foundPct,
      competitors: competitors.length,
    });

    await update("rank_scans", s.id, {
      status: "DONE",
      points_done: results.length,
      avg_rank: avgRank,
      top3_pct: top3Pct,
      found_pct: foundPct,
      results: JSON.stringify(results),
      competitors: JSON.stringify(competitors),
      error: null,
      finished_at: new Date(),
    });

    console.log(
      `[RankScan] Scan completed successfully. scanId=${s.id}`
    );

    const t = await one(
      "SELECT c.business_name FROM clients c WHERE c.id=?",
      [s.client_id]
    );

    try {
      const { sendNotification } = await import(
        "../notifications/service.js"
      );

      await sendNotification({
        tenantId: s.tenant_id,
        type: "SUCCESS",
        title: `Rank scan ready - ${
          t?.business_name || "Business"
        }`,
        body: `"${s.keyword}" · ${s.grid_size}×${s.grid_size} grid`,
        link: `/rank-tracker/${s.id}`,
        push: true,
      });

      console.log(
        `[RankScan] Completion notification sent. scanId=${s.id}`
      );
    } catch (notificationError) {
      console.error(
        `[RankScan] Notification failed. scanId=${s.id}`,
        notificationError
      );
    }
  } catch (err) {
    console.error(
      `[RankScan] Scan failed. scanId=${s.id}`,
      err
    );

    await update("rank_scans", s.id, {
      status: "FAILED",
      error: String(
        err?.message || "Unknown scan error"
      ).slice(0, 480),
      finished_at: new Date(),
    });
  }
}

const parse = (s) => ({ ...s, results: s.results ? JSON.parse(s.results) : [], competitors: s.competitors ? JSON.parse(s.competitors) : [], spacing_km: Number(s.spacing_km), center_lat: Number(s.center_lat), center_lng: Number(s.center_lng), avg_rank: s.avg_rank == null ? null : Number(s.avg_rank) });

export async function getScan(id, tenantId) {
  const s = await one("SELECT r.*, c.business_name FROM rank_scans r JOIN clients c ON c.id=r.client_id WHERE r.id=? AND r.tenant_id=?", [Number(id), tenantId]);
  if (!s) throw bad("Scan not found", 404);
  const prev = await one(
    "SELECT id, avg_rank, top3_pct, found_pct, created_at FROM rank_scans WHERE client_id=? AND keyword=? AND grid_size=? AND status='DONE' AND id<? ORDER BY id DESC LIMIT 1",
    [s.client_id, s.keyword, s.grid_size, s.id],
  );
  return { ...parse(s), previous: prev ? { ...prev, avg_rank: prev.avg_rank == null ? null : Number(prev.avg_rank) } : null };
}

export async function listScans(tenantId, { clientId = null, limit = 50 } = {}) {
  return query(
    `SELECT r.id, r.client_id, c.business_name, r.keyword, r.grid_size, r.spacing_km, r.status, r.is_sample, r.points_done, r.avg_rank, r.top3_pct, r.found_pct, r.error, r.created_at, r.finished_at
       FROM rank_scans r JOIN clients c ON c.id=r.client_id WHERE r.tenant_id=? ${clientId ? "AND r.client_id=?" : ""} ORDER BY r.id DESC LIMIT ${Number(limit)}`,
    clientId ? [tenantId, Number(clientId)] : [tenantId],
  );
}

/** Server-side Maps Static image for the heatmap background (key never reaches the browser). */
export async function staticMap(scan) {
  const key = await placesKey();
  if (!key || scan.is_sample) return null;
  const spanKm = (scan.grid_size - 1) * scan.spacing_km + scan.spacing_km;
  const zoom = mapZoom(scan.center_lat, spanKm);
  const url = `https://maps.googleapis.com/maps/api/staticmap?center=${scan.center_lat},${scan.center_lng}&zoom=${zoom}&size=640x640&scale=1&maptype=roadmap&style=feature:poi|visibility:off&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  return { buf: Buffer.from(await res.arrayBuffer()), zoom };
}
