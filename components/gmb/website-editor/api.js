/** Browser helper: calls the builder through /api/gmb/:clientId/website/api/... */
export function wbApi(clientId) {
  const base = `/api/gmb/${clientId}/website/api/`;
  return async function call(path, { method = "GET", body = null, form = null } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: form || (body ? JSON.stringify(body) : undefined),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) throw new Error(j.error || j.message || `Request failed (${res.status})`);
    return j;
  };
}

/** Website-level actions (publish, fill from Google, AI images, delete...) */
export async function siteAction(clientId, action, extra = {}) {
  const res = await fetch(`/api/gmb/${clientId}/website`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j.error || "Request failed");
  return j;
}
