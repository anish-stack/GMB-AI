import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authenticateKey, touchKey, recordUsage } from "./keys.js";
import { hitAll, rateHeaders } from "./rateLimiter.js";
import { getSettings } from "../saas/settings.js";
import { resolveEntitlements } from "../saas/entitlements.js";
import { maintenanceState } from "../system/maintenance.js";
import { clientIp } from "../security/rateLimit.js";

/** Per-endpoint extra limits (per key, per minute). */
const ENDPOINT_LIMITS = { "posts.create": 10 };

function errorBody(code, message, requestId, meta) {
  return { error: { code, message, ...(meta ? { details: meta } : {}) }, request_id: requestId };
}

/**
 * Public API wrapper: API key auth -> scope -> plan feature -> rate limits
 * (key, tenant, endpoint) -> handler -> usage log. Tenant id always comes from
 * the key, never from the request, so one tenant can't read another's data.
 */
export function publicApi({ scope, endpoint }, handler) {
  return async function route(request, context) {
    const requestId = crypto.randomUUID();
    const base = { "X-Request-Id": requestId, "Cache-Control": "no-store" };
    const reply = (status, body, headers = {}) => NextResponse.json(body, { status, headers: { ...base, ...headers } });
    let key = null;
    let rate = null;
    try {
      const m = await maintenanceState();
      if (m.enabled) return reply(503, errorBody("MAINTENANCE", m.message, requestId, { eta: m.eta || null }), { "Retry-After": "600" });
      const settings = await getSettings();
      if (Number(settings.api_enabled) !== 1) return reply(503, errorBody("API_DISABLED", "The API is temporarily disabled.", requestId));

      const auth = request.headers.get("authorization") || "";
      const raw = request.headers.get("x-api-key") || (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "");
      key = await authenticateKey(raw);

      const scopes = String(key.scopes || "").split(",");
      if (scope && !scopes.includes(scope)) {
        await recordUsage({ tenantId: key.tenant_id, apiKeyId: key.id, endpoint, error: true });
        return reply(403, errorBody("INSUFFICIENT_SCOPE", `This key needs the "${scope}" scope.`, requestId));
      }
      const ent = await resolveEntitlements(key.tenant_id);
      if (!ent.features?.f_api_access) {
        return reply(403, errorBody("PLAN_NO_API", "API access is not included in your plan. Upgrade to use the API.", requestId));
      }

      const perKey = Number(key.rate_limit_per_min || settings.api_default_rate_per_min || 60);
      const perTenant = Number(settings.api_tenant_rate_per_min || 300);
      const rules = [
        { bucket: `key:${key.id}:min`, limit: perKey, windowSec: 60, scope: "key" },
        { bucket: `tenant:${key.tenant_id}:min`, limit: perTenant, windowSec: 60, scope: "tenant" },
        { bucket: `key:${key.id}:day`, limit: perKey * 60 * 24, windowSec: 86400, scope: "key-day" },
      ];
      if (ENDPOINT_LIMITS[endpoint]) rules.push({ bucket: `key:${key.id}:ep:${endpoint}`, limit: ENDPOINT_LIMITS[endpoint], windowSec: 60, scope: "endpoint" });
      rate = await hitAll(rules);
      if (!rate.allowed) {
        await recordUsage({ tenantId: key.tenant_id, apiKeyId: key.id, endpoint, throttled: true });
        return reply(429, errorBody("RATE_LIMITED", `Rate limit exceeded (${rate.scope}). Retry after the reset time.`, requestId), rateHeaders(rate));
      }

      const params = context?.params ? await context.params : {};
      const ip = clientIp(request);
      const data = await handler({ request, params, tenantId: key.tenant_id, key, ip, requestId });
      await Promise.all([touchKey(key.id, ip), recordUsage({ tenantId: key.tenant_id, apiKeyId: key.id, endpoint })]);
      const status = data?.__status || 200;
      if (data) delete data.__status;
      return reply(status, { data, request_id: requestId }, rateHeaders(rate));
    } catch (err) {
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      if (key) await recordUsage({ tenantId: key.tenant_id, apiKeyId: key.id, endpoint, error: true }).catch(() => {});
      if (status === 500) console.error(`[api ${endpoint}] ${requestId}`, err);
      return reply(
        status,
        errorBody(err?.code || (status === 500 ? "INTERNAL_ERROR" : "BAD_REQUEST"), status === 500 ? "Something went wrong." : err.message, requestId, status === 500 ? null : err.meta || null),
        rate ? rateHeaders(rate) : {},
      );
    }
  };
}

export function badRequest(message, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { status: 400, code });
}

export function notFound(message = "Not found") {
  return Object.assign(new Error(message), { status: 404, code: "NOT_FOUND" });
}

export function pageParams(request) {
  const sp = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit"), 10) || 20, 1), 100);
  const page = Math.max(parseInt(sp.get("page"), 10) || 1, 1);
  return { sp, limit, page, offset: (page - 1) * limit };
}
