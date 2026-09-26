import Link from "next/link";
import { ENDPOINTS, ERRORS, API_VERSION } from "@/lib/api/spec.js";
import { API_SCOPES } from "@/lib/api/keys.js";
import { getSettings } from "@/lib/saas/settings.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "API documentation", description: "Integrate Google Business Profile post automation into your own apps." };

const METHOD = { GET: "bg-sky-100 text-sky-700", POST: "bg-emerald-100 text-emerald-700" };
const slug = (e) => `${e.method}-${e.path}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function Code({ children }) {
  return <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 text-[12.5px] leading-relaxed text-zinc-100"><code>{children}</code></pre>;
}

function Params({ title, rows }) {
  if (!rows?.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map(([k, t, d]) => (
              <tr key={k}><td className="px-3 py-2 font-mono text-xs font-semibold">{k}</td><td className="px-3 py-2 text-xs text-zinc-500">{t}</td><td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">{d}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function ApiDocs() {
  const s = await getSettings();
  const base = `${(process.env.APP_URL || "https://your-domain.com").replace(/\/$/, "")}/api/${API_VERSION}`;
  const groups = [...new Set(ENDPOINTS.map((e) => e.group))];
  return (
    <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-6 space-y-4 text-sm">
          {["Introduction", "Authentication", "Rate limits", "Errors", "Scopes", "Webhooks"].map((h) => (
            <a key={h} href={`#${h.toLowerCase().replace(" ", "-")}`} className="block text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">{h}</a>
          ))}
          {groups.map((g) => (
            <div key={g}>
              <p className="mb-1 text-xs font-semibold uppercase text-zinc-400">{g}</p>
              {ENDPOINTS.filter((e) => e.group === g).map((e) => (
                <a key={slug(e)} href={`#${slug(e)}`} className="block py-0.5 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">{e.name}</a>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 space-y-10 text-zinc-700 dark:text-zinc-300">
        <section id="introduction">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{s.platform_name} API</h1>
          <p className="mt-3 max-w-2xl">Read clients, posting-plan usage, reviews and performance, and create AI-generated Google Business Profile posts from your own website or app. JSON over HTTPS.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-zinc-100 px-3 py-1.5 font-mono text-xs dark:bg-zinc-800">Base URL: {base}</span>
            <a href="/postman/gmb-ai-cloud.postman_collection.json" download className="rounded-lg bg-[#F53236] px-3 py-1.5 text-xs font-semibold text-white">Download Postman collection</a>
            <a href="/postman/gmb-ai-cloud.postman_environment.json" download className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700">Postman environment</a>
          </div>
        </section>

        <section id="authentication" className="space-y-3">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Authentication</h2>
          <p>Create a key in <b>Dashboard → API &amp; developers</b> (requires a plan with API access). The key is shown once - store it server-side only. Send it in the <code>Authorization</code> header (or <code>X-API-Key</code>).</p>
          <Code>{`curl ${base}/me \\\n  -H "Authorization: Bearer gmbk_xxxxxxxxxx_your-secret"`}</Code>
          <p className="text-sm">Keys can be renamed, disabled, regenerated (old value stops immediately), revoked, given an expiry date and limited to scopes. Never put a key in browser or mobile code.</p>
        </section>

        <section id="rate-limits" className="space-y-3">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Rate limits</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Per key: <b>{s.api_default_rate_per_min}</b> requests/minute (admins can raise it per key).</li>
            <li>Per workspace: <b>{s.api_tenant_rate_per_min}</b> requests/minute across all keys.</li>
            <li><code>POST /posts</code>: 10 requests/minute per key.</li>
          </ul>
          <p className="text-sm">Every response carries <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code> (unix seconds). A <code>429</code> includes <code>Retry-After</code>. Posting is additionally capped by each client&apos;s posting plan (weekly and total).</p>
        </section>

        <section id="errors" className="space-y-3">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Responses &amp; errors</h2>
          <p className="text-sm">Success: <code>{`{ "data": …, "request_id": "…" }`}</code>. Error:</p>
          <Code>{JSON.stringify({ error: { code: "RATE_LIMITED", message: "Rate limit exceeded (key). Retry after the reset time." }, request_id: "7c1e2d…" }, null, 2)}</Code>
          <Params title="Error codes" rows={ERRORS.map(([st, c, d]) => [String(st), c, d])} />
        </section>

        <section id="scopes" className="space-y-3">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Scopes</h2>
          <Params title="Available scopes" rows={Object.entries(API_SCOPES).map(([k, d]) => [k, "scope", d])} />
        </section>

        <section id="webhooks" className="space-y-3">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Webhooks</h2>
          <p className="text-sm">Outgoing webhooks are configured by the platform admin. Each request is a JSON <code>POST</code> signed with <code>X-Signature: sha256=&lt;HMAC of body&gt;</code>. Until your workspace has webhooks, poll <code>GET /posts/{"{id}"}</code>.</p>
        </section>

        {ENDPOINTS.map((e) => (
          <section key={slug(e)} id={slug(e)} className="space-y-3 border-t border-zinc-200 pt-8 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase text-zinc-400">{e.group}</p>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{e.name}</h3>
            <p className="flex flex-wrap items-center gap-2 font-mono text-sm">
              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${METHOD[e.method]}`}>{e.method}</span>
              /api/{API_VERSION}{e.path}
              {e.scope ? <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">scope: {e.scope}</span> : null}
            </p>
            {e.description ? <p className="text-sm">{e.description}</p> : null}
            <Params title="Query parameters" rows={e.query} />
            <Params title="Body (JSON)" rows={e.body} />
            <Code>{`curl${e.method === "GET" ? "" : ` -X ${e.method}`} "${base}${e.path.replace("{id}", "14")}" \\\n  -H "Authorization: Bearer $API_KEY"${e.example ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(e.example)}'` : ""}`}</Code>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Response {e.status || 200}</p>
            <Code>{JSON.stringify(e.response, null, 2)}</Code>
            {e.errorExample ? (<><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Error 422</p><Code>{JSON.stringify(e.errorExample, null, 2)}</Code></>) : null}
          </section>
        ))}

        <section className="space-y-3 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Example integration (Node.js)</h2>
          <Code>{`const API = "${base}";
const headers = { Authorization: \`Bearer \${process.env.GMB_API_KEY}\`, "Content-Type": "application/json" };

// 1. check plan capacity
const plan = await (await fetch(\`\${API}/clients/14/posting-plan\`, { headers })).json();
if (plan.data.this_week.remaining > 0) {
  // 2. create a post - AI generates it in the background
  const res = await fetch(\`\${API}/posts\`, { method: "POST", headers, body: JSON.stringify({ client_id: 14, topic: "Monsoon AC service" }) });
  const { data, error } = await res.json();
  if (error) console.error(error.code, error.message);
  else console.log("post", data.id, data.status);
}`}</Code>
          <p className="text-sm">Questions? <Link href="/support" className="font-semibold text-[#F53236]">Open a support ticket</Link>.</p>
        </section>
      </article>
    </div>
  );
}
