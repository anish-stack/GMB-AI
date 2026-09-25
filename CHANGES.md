# What changed in this pass

## 1. Bugs fixed
- `components/theme-toggle.js` and `components/global-search.js`: fixed React
  "setState inside an effect" issues that could cause extra re-renders/flicker.
- `components/admin/credit-manager.js`: fixed a JSX unescaped-quote error.
- `/forgot-password` was a dead link on the login page with no page behind it -
  now a real, working page.
- Verified with `next build` + `eslint`: 0 errors across the app (only a
  pre-existing, harmless `<img>` perf warning from Next.js remains).

## 2. OTP + Two-Factor login (client & admin, same flow)
- New tables: `otp_codes`, `email_queue`, `rate_limit_hits`. Users table got
  `two_factor_enabled`, `otp_verified_once`, `failed_login_count`, `locked_until`.
- Login is now 2 steps: password check -> 6-digit code emailed -> code entry ->
  session created. Wrong-code attempts are limited (5), codes expire (10 min,
  configurable), and repeated failed logins lock the account for 15 minutes.
- New: OTP-based forgot/reset password flow (`/forgot-password`).
- Files: `lib/otp.js`, `lib/auth.js` (rewritten), `app/api/auth/login`,
  `verify-otp`, `resend-otp`, `forgot-password`, `reset-password`, and the
  updated `app/login/page.js` UI.

## 3. Background email worker (nodemailer), so nothing blocks a request
- `lib/mail/transport.js` - nodemailer transporter from `SMTP_*` env vars.
  Falls back to console-logging emails if SMTP isn't configured, so nothing
  crashes in dev.
- `lib/mail/queue.js` - every email is **queued** (one fast INSERT into
  `email_queue`) instead of sent inline. A worker drains it:
  - `scripts/scheduler.js` now also runs a `MAIL_CRON` job (default: every
    minute) that calls `processEmailQueue()`.
  - `/api/cron/mail-worker` - same worker, callable over HTTP for serverless
    deploys (Vercel Cron etc.) that can't run a standalone Node process.
- `lib/mail/templates.js` - all 6 email templates (welcome, OTP, payment
  receipt, nightly summary, post published, GMB connected).

## 4. Emails wired into the app, exactly as requested
| Trigger | Where | Email |
|---|---|---|
| Account created | `lib/saas/tenants.js` `provisionTenant()` | Welcome email |
| Payment received | `lib/saas/billing.js` `markInvoicePaid()` | Payment receipt |
| Nightly AI run finishes | `lib/ai/orchestrator.js` `runNightlyJob()` | One summary email per tenant, with an HTML **table** of every client/post/status generated that night |
| Post approved & published to Google | `lib/repo/tasks.js` `publishTask()` | "Your post is live" email to the GMB owner |
| GMB connected (mock -> real) | `lib/gmb/googleAuth.js` `saveClientTokens()` | "Connected to Google" email to the GMB owner |

All of the above only **queue** the email (one DB insert) - they never wait on
SMTP, so signup/login/publish/connect stay fast even if your email provider is
slow.

## 5. API / security hardening
- `lib/security/rateLimit.js` - DB-backed rate limiter. Applied to login,
  signup, OTP verify/resend, forgot/reset password, and the AI-heavy task
  actions (regenerate / regenerate image / generate image options).
- Account lockout after repeated failed password attempts.
- `middleware.js` - security headers on every response (X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS in prod).
- Confirmed existing protections stayed intact: tenant isolation
  (`assertTaskInTenant`), RBAC (`assertCan`/`guard`), and parameterized SQL
  everywhere (no injection risk found).

## 6. AI control (reviewed, already solid - documenting what's there)
- `lib/ai/agents/qa.js` already blocks/flags: missing business name, missing
  service/location, keyword stuffing, unsupported price/guarantee/medical/
  certification claims, client-specific "prohibited claims", and duplicate
  content - a post only auto-passes above a score threshold; otherwise it goes
  to human review, never straight to Google.
- Credits/entitlements (`lib/saas/credits.js`, `entitlements.js`) already stop
  a tenant from generating once their plan/credits run out.
- Added a rate limit on manual regenerate/image actions as extra defense
  against a runaway UI loop or script (see above).

## Setup you need to do
1. Run the DB migration once: `mysql -u root -p gmb_ai < db/upgrade-security-mail.sql`
   (fresh installs via `scripts/seed.js` already include everything - see the
   updated `db/schema.sql`.)
2. `npm install` (adds `nodemailer`).
3. Fill in the new env vars in `.env` (see `.env.example`): `SMTP_HOST`,
   `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `OTP_EXPIRY_MINUTES`,
   `MAIL_CRON`. Any SMTP provider works (Gmail App Password, SendGrid, SES,
   Brevo, Resend, Mailgun...). Leaving it blank just logs emails to the
   console instead of sending - nothing breaks.
4. Run `node scripts/scheduler.js` as before (now also drains the email
   queue every minute), or wire `/api/cron/mail-worker` into a platform cron
   if you deploy serverless.

## Note on "Workers"
There's no literal Cloudflare/serverless "Workers" runtime in this stack
(it's a Next.js + MySQL app), so I implemented the same effect the request
was after - **the sending never happens on the request thread** - with a
DB-backed queue + a separate background process, which is the standard
pattern for this kind of app (same idea as BullMQ/SQS, just without adding a
Redis dependency). If you later want a literal Cloudflare Workers/Queues setup,
`lib/mail/queue.js` is the one place to swap.
