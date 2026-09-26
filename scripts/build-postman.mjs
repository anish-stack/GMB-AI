/**
 * Builds public/postman/*.json from lib/api/spec.js.
 *   npm run postman
 * No real secrets: the key variable is a placeholder.
 */
import fs from "node:fs";
import path from "node:path";
import { ENDPOINTS, ERRORS, API_VERSION } from "../lib/api/spec.js";

const out = path.join(process.cwd(), "public", "postman");
fs.mkdirSync(out, { recursive: true });

const toPostmanPath = (p) => p.replace(/\{(\w+)\}/g, ":$1").split("/").filter(Boolean);
const item = (e) => {
  const vars = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ key: m[1], value: m[1] === "id" ? "{{client_id}}" : "" }));
  if (e.path.startsWith("/posts/{id}")) vars[0].value = "{{post_id}}";
  const req = {
    method: e.method,
    header: [{ key: "Accept", value: "application/json" }, ...(e.body ? [{ key: "Content-Type", value: "application/json" }] : [])],
    url: {
      raw: `{{base_url}}/api/${API_VERSION}${e.path.replace(/\{(\w+)\}/g, ":$1")}`,
      host: ["{{base_url}}"],
      path: ["api", API_VERSION, ...toPostmanPath(e.path)],
      variable: vars,
      query: (e.query || []).map(([k, , d]) => ({ key: k, value: "", description: d, disabled: true })),
    },
    description: `${e.description || e.name}${e.scope ? `\n\nScope: \`${e.scope}\`` : ""}`,
    ...(e.body ? { body: { mode: "raw", raw: JSON.stringify(e.example || {}, null, 2), options: { raw: { language: "json" } } } } : {}),
  };
  const responses = [
    { name: "Success", originalRequest: req, status: "OK", code: e.status || 200, _postman_previewlanguage: "json", header: [{ key: "Content-Type", value: "application/json" }, { key: "X-RateLimit-Remaining", value: "59" }], body: JSON.stringify(e.response, null, 2) },
  ];
  if (e.errorExample) responses.push({ name: "Plan limit", originalRequest: req, status: "Unprocessable Entity", code: 422, _postman_previewlanguage: "json", header: [], body: JSON.stringify(e.errorExample, null, 2) });
  responses.push({ name: "Invalid key", originalRequest: req, status: "Unauthorized", code: 401, _postman_previewlanguage: "json", header: [], body: JSON.stringify({ error: { code: "INVALID_API_KEY", message: "Invalid API key." }, request_id: "…" }, null, 2) });
  return { name: e.name, request: req, response: responses };
};

const groups = [...new Set(ENDPOINTS.map((e) => e.group))];
const collection = {
  info: {
    name: "GMB AI Cloud - Public API",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    description: `Authenticate with an API key from Dashboard → API & developers.\n\nErrors:\n${ERRORS.map(([s, c, d]) => `- ${s} ${c}: ${d}`).join("\n")}`,
  },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{api_key}}", type: "string" }] },
  variable: [{ key: "base_url", value: "http://localhost:3258" }, { key: "api_key", value: "gmbk_xxxxxxxxxx_replace-with-your-key" }],
  item: groups.map((g) => ({ name: g, item: ENDPOINTS.filter((e) => e.group === g).map(item) })),
};
const environment = {
  name: "GMB AI Cloud (example)",
  values: [
    { key: "base_url", value: "https://your-domain.com", enabled: true },
    { key: "api_key", value: "gmbk_xxxxxxxxxx_replace-with-your-key", type: "secret", enabled: true },
    { key: "client_id", value: "1", enabled: true },
    { key: "post_id", value: "1", enabled: true },
  ],
  _postman_variable_scope: "environment",
};
fs.writeFileSync(path.join(out, "gmb-ai-cloud.postman_collection.json"), JSON.stringify(collection, null, 2));
fs.writeFileSync(path.join(out, "gmb-ai-cloud.postman_environment.json"), JSON.stringify(environment, null, 2));
console.log("postman collection written to public/postman/");
