# HBS Suite — Live on VPS (Hostinger KVM 8 · Ubuntu 24.04 · Nginx · PM2 · Ollama)

Complete go-live guide: server prep → MariaDB → Ollama (local AI) → app build → **all workers on PM2** → Nginx + SSL → Google / Razorpay / Meta URLs → admin setup → backups → updates.

> Replace everywhere: `app.yourdomain.com` = your domain, `YOUR_VPS_IP` = Hostinger IP,
> `StrongDbPass!` = your DB password. Commands run as root unless the prompt shows `hbs$`.

---

## 0. What runs on the server

| Process | How | Port | Job |
|---|---|---|---|
| **hbs-web** | PM2 → `next start` | 127.0.0.1:3258 | Panel, API, webhooks, AI routes |
| **hbs-scheduler** | PM2 → `scripts/scheduler.js --no-mail` | – | Calendar auto-post (every 2 min, default 05:00), nightly AI (00:00), auto-publish (5 min), review sync (30 min), billing (01:30), image cleanup (02:00), housekeeping (02:30), listing health (03:00), health check (hourly), heartbeat |
| **hbs-mail** | PM2 → `scripts/mailWorker.js` | – | Sends queued emails (OTP, reports, alerts) |
| **ollama** | systemd | 127.0.0.1:11434 | Local text AI + embeddings |
| **mariadb** | systemd | 127.0.0.1:3306 | Database |
| **nginx** | systemd | 80 / 443 | Reverse proxy + SSL |

⚠️ **Scheduler down = no auto-post, no nightly AI, no billing.** Keep exactly **1** instance of scheduler and mail worker.

KVM 8 = 8 vCPU / 32 GB RAM / 400 GB NVMe, **no GPU** → Ollama runs on CPU (fine for 3B–8B models). Images are **not** made by Ollama — keep a Gemini (recommended) or OpenAI / HuggingFace key for image generation.

---

## 1. Hostinger panel

1. hPanel → **VPS → OS & Panel → Operating System** → **Ubuntu 24.04 LTS** (plain, no control panel).
2. Set root password / add your SSH key.
3. **DNS**: `A` record `app.yourdomain.com → YOUR_VPS_IP` (and `www` if needed). Wait until `ping app.yourdomain.com` shows the IP.
4. hPanel → VPS → **Firewall**: allow 22, 80, 443 (or leave it off and use UFW below — don't block yourself).

---

## 2. Server preparation

```bash
ssh root@YOUR_VPS_IP

apt update && apt -y upgrade
apt -y install curl git unzip build-essential ufw fail2ban ca-certificates gnupg htop

# timezone (the app + crons use IST)
timedatectl set-timezone Asia/Kolkata

# swap 8 GB (safety for build + Ollama)
fallocate -l 8G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10 && echo 'vm.swappiness=10' >> /etc/sysctl.conf

# firewall
ufw allow OpenSSH
ufw allow 'Nginx Full' 2>/dev/null || { ufw allow 80; ufw allow 443; }
ufw --force enable

# app user (never run the app as root)
adduser --disabled-password --gecos "" hbs
usermod -aG sudo hbs
mkdir -p /var/www /var/log/hbs-suite /var/lib/hbs-suite/storage/{images,reports,support} /var/backups/hbs-suite
chown -R hbs:hbs /var/www /var/log/hbs-suite /var/lib/hbs-suite /var/backups/hbs-suite
```

> `/var/lib/hbs-suite/storage` keeps uploaded images, PDF reports and support files **outside** the code folder so redeploys never delete them.

---

## 3. Node.js 22 + PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt -y install nodejs
node -v      # v22.x
npm i -g pm2
```

---

## 4. MariaDB

```bash
apt -y install mariadb-server
systemctl enable --now mariadb
mariadb-secure-installation      # set root pwd, remove anonymous users, disallow remote root, remove test DB
```

Create DB + user:

```bash
mariadb -u root -p <<'SQL'
CREATE DATABASE IF NOT EXISTS gmb_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'hbs'@'localhost' IDENTIFIED BY 'StrongDbPass!';
GRANT ALL PRIVILEGES ON gmb_ai.* TO 'hbs'@'localhost';
FLUSH PRIVILEGES;
SQL
```

Tune (32 GB box) — `/etc/mysql/mariadb.conf.d/99-hbs.cnf`:

```ini
[mysqld]
bind-address            = 127.0.0.1
innodb_buffer_pool_size = 4G
innodb_log_file_size    = 512M
max_connections         = 300
max_allowed_packet      = 64M
character-set-server    = utf8mb4
collation-server        = utf8mb4_unicode_ci
default-time-zone       = '+05:30'
```

```bash
systemctl restart mariadb
```

> Keep DB name `gmb_ai` — `db/schema.sql` contains `USE gmb_ai`.

---

## 5. Ollama (local AI on the VPS)

### 5.1 Install

```bash
curl -fsSL https://ollama.com/install.sh | sh
systemctl status ollama --no-pager      # active (running)
```

### 5.2 Configure (localhost only + keep model warm)

```bash
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_KEEP_ALIVE=24h"
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_MAX_QUEUE=256"
EOF
systemctl daemon-reload && systemctl restart ollama
```

Never expose 11434 publicly (UFW above already blocks it; `OLLAMA_HOST=127.0.0.1` makes sure).

### 5.3 Pull models

```bash
ollama pull llama3.2            # 3B text model  (fast on CPU, ~2 GB)  <- default in .env
ollama pull nomic-embed-text    # embeddings (needed for knowledge/memory search)

# optional, better Hindi/English quality, slower (~5 GB each) - pick ONE and set OLLAMA_TEXT_MODEL
ollama pull qwen2.5:7b
# ollama pull llama3.1:8b
```

| Model | RAM | Speed on KVM 8 (CPU) | Use |
|---|---|---|---|
| `llama3.2` (3B) | ~3 GB | fast (~15–25 tok/s) | default, bulk nightly posts |
| `qwen2.5:7b` | ~6 GB | medium (~7–10 tok/s) | better captions / replies |
| `llama3.1:8b` | ~6 GB | medium | alternative |

Bigger models (14B+) are too slow on CPU for the nightly job — don't use them.

### 5.4 Test

```bash
curl -s http://127.0.0.1:11434/v1/models | head
curl -s http://127.0.0.1:11434/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"llama3.2","messages":[{"role":"user","content":"Say OK"}]}' | head -c 300; echo
curl -s http://127.0.0.1:11434/api/embeddings -d '{"model":"nomic-embed-text","prompt":"test"}' | head -c 120; echo
```

How the app uses it (v11.2):
- **Text + embeddings → Ollama.** If Ollama is off, unreachable or times out, that call (and all calls for the next 60 s) goes to **Gemini** automatically — no retries wasted on Ollama.
- **Images → Gemini only** (`IMAGE_PROVIDER=gemini`). One image per post. "Regenerate" on a post rewrites only the text and keeps the image.
- Admin → Integrations → Ollama (enable + base URL) works too; changes apply without restart.

---

## 6. Upload the code

As user `hbs`:

```bash
su - hbs
cd /var/www
# Option A: git
git clone <your-private-repo-url> hbs-suite
# Option B: upload zip (from your PC):  scp HBS-Suite.zip hbs@YOUR_VPS_IP:/var/www/
#           then: unzip HBS-Suite.zip -d hbs-suite   (make sure package.json is directly inside /var/www/hbs-suite)
cd /var/www/hbs-suite
```

Do **not** upload `node_modules`, `.next` or your local `.env`.

---

## 7. `.env` (production)

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Generate secrets (run 3 times, use a different value for each):

```bash
openssl rand -hex 32
```

Minimum production values (everything else can stay as in `.env.example`, or be set from **Admin → Integrations**):

```ini
# ---------- core ----------
NODE_ENV=production
APP_URL=https://app.yourdomain.com
APP_TIMEZONE=Asia/Kolkata

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=hbs
DB_PASSWORD=StrongDbPass!
DB_NAME=gmb_ai

SESSION_SECRET=<openssl rand -hex 32>        # also the scheduler key (x-scheduler-key)
APP_ENCRYPTION_KEY=<openssl rand -hex 32>    # ⚠️ NEVER change after first start (encrypted Google tokens/keys become unreadable)
API_KEY_PEPPER=<openssl rand -hex 32>

# ---------- AI ----------
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_TEXT_MODEL=llama3.2                   # or qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_TIMEOUT_MS=180000                     # CPU models are slower - give them time
OLLAMA_NUM_CTX=8192                          # context window (prompts carry business knowledge)
AI_PROVIDER=auto                             # text: Ollama -> Gemini (when Ollama is down/off)
IMAGE_PROVIDER=gemini                        # images: Gemini only
GEMINI_API_KEY=<key>                         # images + text fallback
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
OPENAI_API_KEY=                              # leave empty (not needed)
IMAGE_OPTIONS_COUNT=1                        # one image per post / per click
IMAGE_OPTIONS_COUNT_MAX=1
AI_TIMEOUT_MS=60000
AI_IMAGE_TIMEOUT_MS=120000
AI_JOB_CONCURRENCY=2

# ---------- storage (outside code folder) ----------
STORAGE_PROVIDER=                            # blank = chain; "disk" to force local; or S3/R2/Cloudinary keys
IMAGE_STORAGE_DIR=/var/lib/hbs-suite/storage/images
REPORT_STORAGE_DIR=/var/lib/hbs-suite/storage/reports
SUPPORT_STORAGE_DIR=/var/lib/hbs-suite/storage/support

# ---------- Google Business Profile ----------
GMB_PROVIDER=google
GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_REDIRECT_URI=https://app.yourdomain.com/api/gmb/callback
GOOGLE_LOGIN_REDIRECT_URI=https://app.yourdomain.com/api/auth/google/callback

# ---------- mail ----------
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@yourdomain.com
SMTP_PASS=<mail password>
SMTP_FROM=HBS Suite <no-reply@yourdomain.com>
MAIL_WORKER_INTERVAL_MS=5000

# ---------- payments ----------
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=<secret>
RAZORPAY_WEBHOOK_SECRET=<any strong string, same in Razorpay dashboard>

# ---------- Meta (FB / Instagram, test mode) ----------
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=<any strong string>

# ---------- crons (defaults shown; IST because TZ=Asia/Kolkata) ----------
CALENDAR_POST_CRON=*/2 * * * *
NIGHTLY_CRON=0 0 * * *
AUTO_PUBLISH_CRON=*/5 * * * *
REVIEW_SYNC_CRON=*/30 * * * *
BILLING_CRON=30 1 * * *
IMAGE_CLEANUP_CRON=0 2 * * *
HOUSEKEEPING_CRON=30 2 * * *
LISTING_HEALTH_CRON=0 3 * * *
HEALTH_CRON=5 * * * *

AI_DEBUG=false
```

> Moving from an old server? Copy the **same** `APP_ENCRYPTION_KEY` and `SESSION_SECRET` from the old `.env`, otherwise connected GMB accounts must be reconnected.

---

## 8. Install, database, build

```bash
cd /var/www/hbs-suite
npm ci                 # or npm install if no package-lock.json
```

### 8.1 Database

**Fresh install (new server, empty DB):**

```bash
npm run db:setup                       # imports db/schema.sql (all tables, v1 → v11) + demo data
```

Seeded super admin: `superadmin@gmbai.cloud` / `super123` → **change email + password immediately** and delete the demo tenants (`hovermedia.in`, `peakdigital.in`) from **Admin → Tenants**.

> ⚠️ `db:setup` / `schema.sql` **re-creates tables** — run it only on an empty DB, never on a live one.

**Moving an existing database** (from local/XAMPP or old server):

```bash
# on old machine
mysqldump -u root -p --single-transaction --routines --triggers gmb_ai > gmb_ai.sql
# copy to VPS, then
mariadb -u hbs -p gmb_ai < gmb_ai.sql
# apply only the upgrades it doesn't have yet (all are safe to re-run), in this order:
for f in upgrade-security-mail upgrade-google-auth upgrade-image-storage upgrade-image-regen \
         upgrade-image-dedupe upgrade-signup-payments upgrade-v5-platform upgrade-v6-reviews-rank \
         upgrade-v6-1-google-link-fix upgrade-v7-gmb-sync upgrade-v8-bulk-connect-autopost \
         upgrade-v9-theme-social upgrade-v10-keywords-reviews-autopay upgrade-v11-roles-prompts-brand; do
  echo "== $f"; mariadb -u hbs -p'StrongDbPass!' gmb_ai < db/$f.sql || break
done
```

Copy old `storage/` contents into `/var/lib/hbs-suite/storage/` (images, reports, support).

### 8.2 Build

```bash
npm run build          # needs internet (downloads Google fonts) - normal on the VPS
```

Quick test before PM2:

```bash
npx next start -p 3258 -H 127.0.0.1 &
sleep 5 && curl -s http://127.0.0.1:3258/api/health; echo
kill %1
```

Expected: `{"status":"ok",...}`.

---

## 9. PM2 — web + all workers

`ecosystem.config.cjs` is already in the project root (3 apps: `hbs-web`, `hbs-scheduler`, `hbs-mail`, logs in `/var/log/hbs-suite/`).

```bash
cd /var/www/hbs-suite
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs hbs-scheduler --lines 30      # should print: [scheduler ...] started {...} -> https://app.yourdomain.com
```

Auto-start on reboot:

```bash
pm2 save
pm2 startup systemd -u hbs --hp /home/hbs     # prints a sudo command -> copy & run it (as root)
```

Log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

Useful:

```bash
pm2 status | pm2 monit
pm2 logs hbs-web --lines 100
pm2 restart hbs-scheduler
pm2 reload hbs-web           # zero-downtime restart after deploy
```

> The scheduler calls the app through `APP_URL` (`/api/ai/nightly`, `/api/cron/calendar-post`) with header `x-scheduler-key = SESSION_SECRET`. So Nginx + SSL (next step) must be working, and **`APP_URL` must be the real https domain**.

---

## 10. Nginx + SSL

```bash
apt -y install nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/hbs-suite`:

```nginx
upstream hbs_web {
    server 127.0.0.1:3258;
    keepalive 64;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name app.yourdomain.com;

    # uploads: logos, product images, CSV/Excel bulk import, support attachments
    client_max_body_size 50M;

    # long AI routes (nightly job maxDuration 800s, image generation, website builder)
    proxy_connect_timeout 60s;
    proxy_send_timeout    900s;
    proxy_read_timeout    900s;
    send_timeout          900s;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    # Next static assets - long cache
    location /_next/static/ {
        proxy_pass http://hbs_web;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://hbs_web;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
        proxy_buffering off;               # streaming AI responses
    }
}
```

```bash
ln -s /etc/nginx/sites-available/hbs-suite /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

certbot --nginx -d app.yourdomain.com --redirect -m you@yourdomain.com --agree-tos -n
systemctl list-timers | grep certbot      # auto-renew is installed
```

Check: `curl -s https://app.yourdomain.com/api/health` → `{"status":"ok"}`.

> Using Cloudflare proxy (orange cloud)? Cloudflare cuts requests at **100 s**. Either keep the DNS record grey (DNS only) or set `APP_URL` for the scheduler to bypass it — the nightly AI call can run for minutes.

---

## 11. External dashboards — URLs to set

| Service | Where | Value |
|---|---|---|
| Google Cloud → OAuth client (Web) | Authorized JavaScript origins | `https://app.yourdomain.com` |
| | Authorized redirect URIs | `https://app.yourdomain.com/api/gmb/callback`<br>`https://app.yourdomain.com/api/auth/google/callback` |
| Google OAuth consent screen | App domain / privacy / terms | your domain pages; publish app (or keep test users) |
| Google Pub/Sub (optional, live reviews) | Push endpoint | see `PUBSUB_SETUP.md` (replace host with your domain) |
| Razorpay → Webhooks | URL | `https://app.yourdomain.com/api/payments/razorpay/webhook` |
| | Events | `payment.captured, order.paid, subscription.authenticated, subscription.activated, subscription.charged, subscription.pending, subscription.halted, subscription.cancelled, subscription.completed` |
| | Secret | same as `RAZORPAY_WEBHOOK_SECRET` |
| Razorpay | Subscriptions | must be enabled for Autopay |
| Meta app → Facebook Login | Valid OAuth redirect | `https://app.yourdomain.com/api/social/callback` |
| Meta → Webhooks (Instagram/Page) | Callback / verify token | `https://app.yourdomain.com/api/meta/webhook` / `META_WEBHOOK_VERIFY_TOKEN` |
| Hostinger email | SPF / DKIM / DMARC | enable in hPanel → Emails so OTP mails don't land in spam |

---

## 12. First login & admin setup

1. Open `https://app.yourdomain.com/login` → super admin → **change password**.
2. **Own company account** (unlimited credits, never billed):
   ```bash
   cd /var/www/hbs-suite
   npm run own-company -- --email=you@hoverbusiness.com --password='StrongPass!' --name="Your Name" --company="HOVER BUSINESS SERVICES LLP"
   ```
3. **Admin → Web settings**: Platform name `HBS Suite`, logo, SEO title, **Post automation** (Auto from plans / Manual), **Calendar auto-post = On**.
4. **Admin → Integrations**: verify Gemini / Google / SMTP / Razorpay / Meta keys (DB values override `.env`; scheduler reloads them every 5 min).
5. **Admin → Prompts**: tune AI prompts if needed. **Admin → Image styles**: test each style (Test button).
6. **Admin → Plans**: check prices/credits; enable FB/Instagram per tenant from tenant detail.
7. **Admin → System health**: heartbeats `scheduler`, `calendar_post`, `auto_publish`, `review_sync` should be green within 2–5 min.
8. In a tenant: connect a GMB → open the client → **Automation check** should be all green → add a calendar post 5 min ahead → it should publish (scheduler runs every 2 min).

---

## 13. Backups

`/home/hbs/backup.sh`:

```bash
#!/usr/bin/env bash
set -e
D=$(date +%F_%H%M)
B=/var/backups/hbs-suite
mysqldump -u hbs -p'StrongDbPass!' --single-transaction --routines --triggers gmb_ai | gzip > $B/db_$D.sql.gz
tar -czf $B/storage_$D.tar.gz -C /var/lib/hbs-suite storage
cp /var/www/hbs-suite/.env $B/env_$D.bak && chmod 600 $B/env_$D.bak
find $B -type f -mtime +14 -delete
```

```bash
chmod +x /home/hbs/backup.sh
crontab -u hbs -e
# daily 04:15 IST (before the 05:00 calendar posts)
15 4 * * * /home/hbs/backup.sh >> /var/log/hbs-suite/backup.log 2>&1
```

Also turn on **Hostinger weekly VPS snapshots** (hPanel → VPS → Backups) and copy backups off-server sometimes (Google Drive / R2). **Keep a copy of `.env` safe — without `APP_ENCRYPTION_KEY` the encrypted tokens can't be recovered.**

---

## 14. Updating (new zip / git pull)

```bash
su - hbs
cd /var/www/hbs-suite
/home/hbs/backup.sh                              # always backup first

git pull                                          # or unzip only-changed-files zip over the folder:
# unzip -o ~/HBS-update.zip -d /var/www/hbs-suite

npm ci                                            # only if package.json changed
# run any NEW db/upgrade-*.sql shipped with the update
mariadb -u hbs -p gmb_ai < db/upgrade-vXX-....sql

npm run build
pm2 reload hbs-web
pm2 restart hbs-scheduler hbs-mail
pm2 logs --lines 30
```

Never overwrite the server `.env` with a local one.

---

## 15. Troubleshooting

| Problem | Check / Fix |
|---|---|
| Posts not auto-publishing | `pm2 status` → hbs-scheduler online? `pm2 logs hbs-scheduler` → look for `calendar-post failed`. Admin → System health → `calendar_post` heartbeat. Admin → Web settings → Calendar auto-post = On. Client's GMB connected & location selected. Post time is IST (default 05:00). |
| `calendar-post failed: HTTP 401` | `SESSION_SECRET` differs between web & scheduler (both read the same `.env` → `pm2 restart all` after edits). |
| `calendar-post failed: fetch failed` / 502 | `APP_URL` wrong / SSL not ready / hbs-web down. Test `curl https://app.yourdomain.com/api/health`. |
| Nightly AI 504 | Nginx `proxy_read_timeout` < 900s, or Cloudflare 100 s limit. |
| AI very slow / timeouts | Use `llama3.2`, set `AI_TIMEOUT_MS=180000`, `AI_JOB_CONCURRENCY=2`, check `htop`. `journalctl -u ollama -f`. |
| Ollama "model not found" | `ollama list` — name in `.env` must match exactly (`llama3.2`, `qwen2.5:7b`). |
| Images not generated | Ollama can't make images → set `GEMINI_API_KEY` (or OpenAI/HF). Admin → Image styles → Test. |
| Emails not sent | `pm2 logs hbs-mail`; SMTP port 465 + `SMTP_SECURE=true`; Admin → System → email queue. |
| Google "redirect_uri_mismatch" | Redirect URIs in Google Cloud must exactly equal section 11 (https, no trailing slash). |
| "Unable to decrypt" / GMB disconnected after move | `APP_ENCRYPTION_KEY` changed — restore the old one. |
| Build fails fetching fonts | VPS needs outbound internet during `npm run build`. |
| 413 Request Entity Too Large | Raise `client_max_body_size` in Nginx. |
| Uploaded images 404 after deploy | Storage dirs must point to `/var/lib/hbs-suite/storage/...` (section 7) and be owned by `hbs`. |
| Out of memory during build | Swap enabled? `free -h`. Stop Ollama temporarily: `systemctl stop ollama`, build, start again. |

Health commands:

```bash
pm2 status
curl -s https://app.yourdomain.com/api/health
systemctl status mariadb ollama nginx --no-pager
ollama ps
df -h && free -h
tail -f /var/log/hbs-suite/scheduler.out.log
```

---

## 16. Go-live checklist

- [ ] DNS → VPS IP, SSL green padlock
- [ ] `.env` production values, `APP_URL=https://…`, secrets generated, `chmod 600 .env`, copy saved offline
- [ ] DB imported / upgrades v11 applied
- [ ] Ollama running on 127.0.0.1, `llama3.2` + `nomic-embed-text` pulled, `OLLAMA_ENABLED=true`
- [ ] Gemini key set (images)
- [ ] `pm2 status`: hbs-web, hbs-scheduler, hbs-mail **online**; `pm2 save` + startup done
- [ ] Google OAuth / Razorpay webhook / Meta URLs updated to the domain
- [ ] Demo data removed, admin password changed, own-company account created
- [ ] Admin → System health green; test calendar post published on GMB
- [ ] Backup cron + Hostinger snapshots on
