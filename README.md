# GMB AI Cloud

Multi-tenant SaaS for agencies that manage Google Business Profiles (GBP) with AI.
Tenants (agencies) add clients (businesses), connect each client's Google account, and the
platform researches, writes, QA-checks and schedules GBP posts, drafts review replies,
shares PDF performance reports, and exposes a public API.

**Stack:** Next.js 16 (App Router, JavaScript) · React 19 · Tailwind 4 · MySQL/MariaDB (mysql2) ·
pdfkit · Firebase Cloud Messaging (HTTP v1) · Razorpay · nodemailer · node-cron.

---

## Contents
1. [Features](#features) · 2. [Requirements](#requirements) · 3. [Installation](#installation) ·
4. [Environment](#environment-variables) · 5. [Database](#database-setup) · 6. [Commands](#commands) ·
7. [Workers & cron](#workers--cron) · 8. [Integrations](#integrations-admin--integrations) ·
9. [Push notifications (FCM)](#push-notifications-fcm) · 10. [PWA](#pwa) ·
11. [Public API](#public-api) · 12. [Posting plans](#client-posting-plans--caps) ·
13. [Maintenance mode](#maintenance-mode) · 14. [Support tickets](#support-tickets) ·
15. [Reports](#reports--sharing-history) · 16. [Security](#security) · 17. [Deployment](#deployment) ·
18. [Project layout](#project-layout)

---

## Features

| Area | What you get |
|---|---|
| Tenancy | Plans, subscriptions, invoices, credits, coupons, team roles (Owner/Manager/Member), super admin console, impersonation |
| Signup | 4-step wizard: plan → account → **email OTP** → **Razorpay** checkout (free/trial plans skip payment); webhook safety net |
| AI | Research → keywords → topic → content → hashtags → QA → image; review-reply drafts (Hindi/Hinglish/English) |
| GBP | Profile edit (description, categories, hours, special hours), posts, reviews, media, attributes, booking links, admins, search keywords, performance |
| Posting plans | Per-client plan (start, months, posts/week, optional total, posting days) with **strict weekly + total caps** in UI, API and scheduler |
| Notifications | Notification center, real-time bell (SSE), **FCM push** when AI generation finishes, admin broadcasts with delivery/read stats |
| Review inbox | All clients' Google reviews in one place, **real-time via Pub/Sub** (30-min sync fallback), urgent-first, auto AI drafts (Hindi/Hinglish/English), publish/ignore, bulk draft |
| Listing health | Nightly + real-time monitor: suspended/disabled, lost owner access, ownership conflict, duplicate, verification, closed status, stale posts, unanswered reviews - push alerts when status worsens |
| Rank tracker | **Local rank grid heatmap** (3×3/5×5/7×7, Places API) with average rank, top-3 coverage, competitor table, compare with last scan, map background; included in the PDF report |
| Reports | Branded multi-page **PDF** (KPIs vs previous period, charts, reviews, keywords, health, next steps); email / WhatsApp / private link; full sharing history with view tracking |
| Public API | Tenant API keys (hashed, scoped, expiring, regenerable, revocable), per-key/tenant/endpoint rate limits, docs at `/docs/api`, Postman collection |
| Support | Tickets with categories, priorities, attachments, statuses, internal notes, assignment |
| CMS | Terms, Privacy, Disclaimer, About, FAQ, Support + any page; SEO fields; footer links |
| Admin | Integrations (encrypted credentials + test), web/app settings, maintenance mode, system health, client usage, API usage + rate-limit reset, notifications, CMS, support |
| PWA | Installable, offline fallback, update prompt, background push |

---

## Requirements

- Node.js **20.9+** (22 LTS recommended)
- MariaDB **10.5+** (XAMPP works) or MySQL 8 *(the upgrade scripts use `ADD COLUMN IF NOT EXISTS`, which is MariaDB syntax - on MySQL 8 run the `ALTER` lines manually)*
- SMTP account for email (optional in dev - emails are printed to the console)
- Optional: Razorpay account, Firebase project, Google Cloud OAuth client, AI provider keys

## Installation

```bash
npm install
cp .env.example .env        # fill DB_*, SESSION_SECRET, APP_ENCRYPTION_KEY, APP_URL
npm run db:setup            # creates DB, imports db/schema.sql, loads demo data
npm run dev                 # http://localhost:3000
```

Demo logins (after `db:setup`):

| Role | Email | Password |
|---|---|---|
| Super admin | superadmin@gmbai.cloud | super123 |
| Tenant owner | owner@hovermedia.in | owner123 |
| Tenant staff | ravi@hovermedia.in / neha@hovermedia.in | seo123 |

Change these immediately outside local development.

## Environment variables

`.env.example` documents every variable. The important ones:

| Variable | Purpose |
|---|---|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | MySQL connection |
| `SESSION_SECRET` | Signs session cookies, OTP/signup tokens, scheduler key. **Required, long random** |
| `APP_ENCRYPTION_KEY` | AES-256-GCM key for integration secrets & FCM tokens. Don't change after go-live |
| `API_KEY_PEPPER` | Optional pepper for API-key/share-link hashes (defaults to `SESSION_SECRET`) |
| `APP_URL` | Public base URL (links in emails, report links, health check) |
| `GMB_PROVIDER` | `mock` (default) or `google` |
| `AI_PROVIDER`, `GEMINI_*`, `OPENAI_*`, `HF_*`, `OLLAMA_*` | AI providers (can also be set in Admin → Integrations) |
| `SMTP_*` | Email (or Admin → Integrations) |
| `STORAGE_PROVIDER`, `AWS_*`, `R2_*`, `CLOUDINARY_*` | Image storage chain, disk fallback |
| `NIGHTLY_CRON`, `BILLING_CRON`, `HOUSEKEEPING_CRON`, `HEALTH_CRON`, `MAIL_CRON` | Scheduler timings |

Values saved in **Admin → Integrations** override `.env` at runtime (no restart).

## Database setup

- **Fresh install:** `npm run db:setup` (imports `db/schema.sql` - contains every table).
- **Existing install:** run the upgrade scripts you haven't applied yet, in order:

```bash
mysql -u root -p gmb_ai < db/upgrade-security-mail.sql
mysql -u root -p gmb_ai < db/upgrade-google-auth.sql
mysql -u root -p gmb_ai < db/upgrade-image-storage.sql
mysql -u root -p gmb_ai < db/upgrade-image-regen.sql
mysql -u root -p gmb_ai < db/upgrade-image-dedupe.sql
mysql -u root -p gmb_ai < db/upgrade-signup-payments.sql
mysql -u root -p gmb_ai < db/upgrade-v5-platform.sql
mysql -u root -p gmb_ai < db/upgrade-v6-reviews-rank.sql
```

`upgrade-v5-platform.sql` is idempotent. It adds: `notification_broadcasts`, `fcm_tokens`,
`report_shares`, `api_usage_daily`, `api_rate_counters`, `support_tickets`,
`support_ticket_messages`, `cms_pages` (seeded with legal pages), `client_posting_plans`
(creates a 12-month plan for every existing client so nothing is blocked),
`integration_settings`, `system_heartbeats`, `health_check_runs`; and extends
`notifications` (per-user read state, push status), `api_keys` (scopes, expiry, limits),
`ai_tasks` (`created_by_user_id`, `source`), `email_queue.meta` → LONGTEXT (PDF attachments).

`upgrade-v6-reviews-rank.sql` adds `review_inbox`, `listing_health`, `rank_scans` and
`clients.place_id/latitude/longitude`.

Notification model: `notification_broadcasts` = what the admin sent; `notifications` = one row
per recipient user (read/unread, push status, broadcast link).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server on port 3258 |
| `npm run lint` | ESLint |
| `npm run db:setup` | Create DB + schema + demo data |
| `npm run scheduler` | Cron process (AI job, billing, mail, housekeeping, health, heartbeat) |
| `npm run mail-worker` | Standalone mail worker (optional) |
| `npm run billing` / `npm run cleanup-images` | Run one job immediately |
| `npm run postman` | Regenerate `public/postman/*.json` from `lib/api/spec.js` |

## Workers & cron

Run **one** scheduler process next to the web server (pm2/systemd):

```bash
pm2 start npm --name gmb-web -- start
pm2 start npm --name gmb-scheduler -- run scheduler
```

| Job | Default | Notes |
|---|---|---|
| Nightly AI | `0 0 * * *` | `POST /api/ai/nightly` with `x-scheduler-key: $SESSION_SECRET`; skipped in maintenance; posting-plan caps enforced |
| Billing sweep | `30 1 * * *` | Renewals, past-due, expiry |
| Housekeeping | `30 2 * * *` | Marks expired posting plans, prunes rate-limit counters |
| Image cleanup | `0 2 * * *` | Retention for generated images |
| Mail | every 10 s | Sends `email_queue` (disable with `--no-mail` if you run `npm run mail-worker`) |
| Health | `5 * * * *` | Stores a run in `health_check_runs` |
| Review sync | `*/30 * * * *` (`REVIEW_SYNC_CRON`) | batchGetReviews per Google account → review inbox; fallback when Pub/Sub is off |
| Listing health | `0 3 * * *` (`LISTING_HEALTH_CRON`) | Suspension / access / duplicate monitor |
| Heartbeat | every minute | `system_heartbeats` → visible in Admin → System health |

Scripts run with `node --conditions=react-server` so modules marked `server-only` load outside Next.js.
Serverless alternative: call `/api/cron/mail-worker` and `/api/ai/nightly` from an external cron with the scheduler key; `POST /api/cron/heartbeat` reports liveness.

## Integrations (Admin → Integrations)

Razorpay, Firebase, Gemini, OpenAI, Hugging Face, Ollama, Google OAuth/GBP, SMTP, S3, R2,
Cloudinary, Google Analytics, outgoing webhooks. For each: enable/disable, add/update
credentials, **Test connection**, see configured state, source (database / .env) and last test
result. Secrets are AES-256-GCM encrypted, only masked values reach the browser, and saved
values are pushed into `process.env` at boot (`instrumentation.js`) and on every save.

## Real-time reviews (Pub/Sub)

1. Google Cloud → Pub/Sub → create topic, e.g. `projects/<project>/topics/gbp-notifications`.
2. Topic permissions → add `mybusiness-api-pubsub@system.gserviceaccount.com` as **Pub/Sub Publisher**.
3. Create a **push** subscription → endpoint `https://your-domain/api/gmb/pubsub?token=<random secret>`.
4. Admin → Integrations → Google: set *Pub/Sub topic* and *Push endpoint token* (same secret).
5. Admin → Integrations → "Real-time review notifications" → **Enable for all accounts**
   (calls `notificationSetting` PATCH on each connected Google account).

Handled events: `NEW_REVIEW`, `UPDATED_REVIEW` (→ inbox + AI draft + push), `GOOGLE_UPDATE`
(→ alert + health check), `DUPLICATE_LOCATION`, `LOSS_OF_VOICE_OF_MERCHANT` (→ health check),
`NEW_CUSTOMER_MEDIA` (→ notification). The endpoint acks instantly and processes after the
response. `review_auto_draft` (Web settings) turns auto AI drafts on/off.

## Rank tracker (Places API)

Enable **Places API (New)** + **Maps Static API** on a Google Cloud key, restrict it to those
APIs, and save it in Admin → Integrations → Google Places. Per client, click **Link Google
listing** once (stores `place_id` + coordinates; filled automatically from GBP when connected).
A scan runs one Text Search per grid point (5×5 = 25 requests - watch Places pricing), finds the
client's position in the top 20, and aggregates competitors. Limits: `rank_scans_per_day`
(default 20 per tenant) and `rank_max_grid` (default 7) in Web settings. Without a key, scans
run on clearly-labelled sample data. The map background is proxied so the key never reaches
the browser. The latest real scan appears in the PDF report.

## Push notifications (FCM)

1. Firebase console → create project → add a **Web app**.
2. Project settings → Cloud Messaging → **Web Push certificates** → generate key pair (VAPID public key).
3. Project settings → Service accounts → **Generate new private key** (JSON).
4. Admin → Integrations → Firebase: paste API key, auth domain, project ID, sender ID, app ID,
   VAPID key and the service-account JSON → Enable → Test connection.

How it works: logged-in users are asked once to enable notifications; the token is stored
encrypted (`fcm_tokens`, up to 10 devices per user, refreshed daily). When an AI generation, a
manual AI run, a support reply or an admin broadcast finishes, the user gets a notification-center
entry **and** a push. Foreground tab → in-app update (system notification if the tab is hidden);
background/closed → the service worker (`/sw.js`) shows it; clicking opens the related page.
Invalid/unregistered tokens are deleted automatically. The bell updates live over SSE
(`/api/notifications/stream`). iOS needs the app installed to the home screen (iOS 16.4+).

## PWA

`app/manifest.js` (name/colors from Web settings), icons in `public/icons`, service worker served
by `app/sw.js/route.js` (offline fallback `public/offline.html`, cache-first static assets,
never caches API calls). Install prompt appears on supported browsers (iOS gets an
"Add to Home Screen" hint). A new deploy changes the service worker → users see
**"A new version is available → Update"**. HTTPS is required in production.

## Public API

- Tenants with the `f_api_access` plan feature create keys in **API & developers** (`/developers`).
- Key format `gmbk_<10 hex>_<secret>`; only an HMAC hash is stored; the full key is shown once.
- Keys: rename, enable/disable, regenerate (old value dies instantly), revoke, optional expiry,
  scopes (`clients:read`, `posts:read`, `posts:write`, `reviews:read`, `reports:read`),
  last-used time/IP, request count.
- Endpoints (`/api/v1`): `GET /me`, `GET /clients`, `GET /clients/{id}`,
  `GET /clients/{id}/posting-plan`, `GET /clients/{id}/reviews`, `GET /clients/{id}/performance`,
  `GET /posts`, `GET /posts/{id}`, `POST /posts` (plan caps enforced, AI generation in background).
- Docs: **`/docs/api`**. Postman: `public/postman/gmb-ai-cloud.postman_collection.json` +
  `…postman_environment.json` (placeholder key only).

### Rate limiting

MySQL fixed-window counters (`api_rate_counters`, works across instances, no Redis):
per key (default 60/min, override per key), per tenant (300/min), per key per day, per endpoint
(`POST /posts` 10/min), and per user for heavy in-app actions (AI generate 10/min, reports,
tickets). Responses carry `X-RateLimit-*` headers; 429 includes `Retry-After`.
Usage is aggregated daily in `api_usage_daily`. Admin → API usage shows traffic by day/tenant/
endpoint, live per-key counters, lets you **reset** limits (key or tenant), change a key's
limit, or disable a key. Defaults live in Admin → Web settings.

## Client posting plans & caps

When a client is created the tenant must enter: start date, duration (months), posts per week,
optional total cap and optional posting days. Default total = `months × 4 × posts_per_week`
(2 months × 3/week ≈ 24).

**Counting rules** (single implementation: `lib/posting/plan.js`, used by UI, API, scheduler):
- Window = plan start → end; weeks are 7-day blocks from the start date.
- A post's date = its scheduled date (else its creation date).
- Counted: every AI task except `REJECTED`/`FAILED` → *processing* (PENDING…QA_RUNNING),
  *pending* (READY_FOR_REVIEW, NEEDS_REVIEW, APPROVED), *published* (PUBLISHED, POST_DELETED),
  plus calendar slots still `SCHEDULED` with no task yet (*scheduled*). Rejected/failed free the slot.
- A new post is rejected (HTTP 422) with `WEEKLY_LIMIT`, `TOTAL_LIMIT`, `PLAN_EXPIRED`,
  `OUTSIDE_PLAN`, `NOT_A_POSTING_DAY` or `NO_POSTING_PLAN`.
- Enforced in: manual generate, calendar single + bulk/recurring ("repeat weekly"), nightly
  scheduler, public API. Check + insert run under a MySQL named lock, so parallel requests can't
  take the same last slot.
- Expired plan: automatic generation and new scheduling stop, published content stays.
  Renew via **Extend +1 month** or **Change plan** (client page) or Admin → Client usage.
- UI: counters + progress bars (total, published, scheduled, pending, remaining, this week) on
  the client page; the calendar dialog shows usage and disables submit when a cap would be hit.
- `posting_plan_required` (Web settings) - when off, clients without a plan are unrestricted.

## Maintenance mode

Admin → Web & maintenance: toggle, title, message, expected completion, allowed IPs and
emails. When on: tenant panels show a maintenance page, tenant API routes and the public API
return **503** `MAINTENANCE`, the nightly job is skipped. Super admins (including while
impersonating) and allow-listed users/IPs keep full access; the admin panel is never locked.
Changes are audited.

## Support tickets

Clients: **Support** → create (subject, category, priority, optional client, message,
up to 3 attachments PNG/JPG/GIF/WEBP/PDF ≤ 5 MB, validated by file signature), reply, close/re-open.
Statuses: Open, In progress, Waiting for client, Resolved, Closed.
Admin → Support tickets: search/filter, reply, internal notes, change status/priority, assign,
tenant/client info. Clients get notifications (and push) on admin replies and status changes.

## Reports & sharing history

GMB profile → **Report**: choose period → download PDF/CSV, or share by email (PDF attached +
private link), WhatsApp (opens wa.me with the link) or a copyable link. Links are random tokens
(hashed in DB), expire after `REPORT_LINK_DAYS` (30) and count views. Every generate/share is
stored in `report_shares` (tenant, client, location, period, file, shared by/with, method,
status, email delivery result, views) and listed at **Shared reports** (`/reports`).
PDFs are stored in `storage/reports` (override with `REPORT_STORAGE_DIR`).

## Security

- Tenant isolation: every tenant query filters by the session's `tenant_id`; the public API takes
  the tenant from the key, never from the request.
- Secrets: never returned to the browser; integration credentials and FCM tokens encrypted at rest.
- API keys, share tokens: HMAC-hashed with a pepper; timing-safe comparisons.
- Admin routes: `guard({ superAdmin: true })`; maintenance can't lock out super admins.
- Rate limits on auth, signup, OTP, AI generation, reports, tickets and the public API.
- Uploads validated by magic bytes and size; stored outside `public/`.
- Audit log (`audit_logs`) for: API key create/update/regenerate/revoke, rate-limit resets,
  maintenance on/off, integration changes/tests, notifications sent, client plan changes,
  ticket status/replies, CMS changes, report shares, web settings.
- Right-click is disabled in the client panel (UI deterrent only, **not** a security control).
- Security headers in `proxy.js`.

## Deployment

1. `npm ci && npm run build`
2. Create the DB (fresh: `npm run db:setup`, then remove demo users) or run the upgrade scripts.
3. Set `.env` (`NODE_ENV=production`, strong `SESSION_SECRET` + `APP_ENCRYPTION_KEY`, `APP_URL=https://…`).
4. Start web + scheduler with pm2/systemd; put Nginx/Caddy with HTTPS in front
   (disable proxy buffering for `/api/notifications/stream`: `proxy_buffering off;`).
5. Make `storage/` writable and back it up (reports, attachments, local images).
6. Configure integrations in Admin → Integrations, then check Admin → System health.
7. Razorpay webhook → `https://your-domain/api/payments/razorpay/webhook`
   (events `payment.captured`, `order.paid`). Google OAuth redirect → `/api/gmb/callback`.
8. Uptime monitor → `GET /api/health`.

## Project layout

```
app/(app)          tenant panel (dashboard, clients, gmb, calendar, reviews, listing-health, rank-tracker, notifications, reports, support, developers)
app/(admin)/admin  super admin console
app/(public)       pricing, signup, docs/api, legal & CMS pages
app/api            internal APIs;  app/api/v1 = public API
app/sw.js          service worker route;  app/manifest.js = PWA manifest;  app/r/[token] = shared report link
lib/ai             agents, prompts, providers;   lib/gmb = Google/Mock providers
lib/posting        posting-plan caps;  lib/api = API keys, rate limiter, public wrapper, spec
lib/notifications  notification service;  lib/push = FCM client
lib/integrations   registry, encrypted store, connection tests
lib/reviews        review inbox + Pub/Sub handler;  lib/rank = rank grid + map math;  lib/gmb/healthMonitor.js
lib/reports        report data, PDF renderer, sharing;  lib/support; lib/cms; lib/system (health, maintenance, heartbeat)
scripts            scheduler, mail worker, seed, Postman builder
db                 schema.sql + upgrade scripts
```

`AGENTS.md` / `CLAUDE.md` are generated by `next dev` for AI coding tools and are kept on purpose.
