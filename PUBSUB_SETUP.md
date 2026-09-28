# Real-time Google review notifications (Pub/Sub) - setup

Without Pub/Sub the app still works: reviews are synced every 30 minutes by the scheduler.
With Pub/Sub, Google pushes a message the moment a review is posted/edited, and the app
imports it, drafts (or auto-publishes) the AI reply and sends a push notification - usually
within seconds.

```
Customer posts review
   -> Google Business Profile
   -> Pub/Sub topic  (projects/<project>/topics/gbp-notifications)
   -> push subscription -> https://YOUR-DOMAIN/api/gmb/pubsub?token=SECRET
   -> review inbox + AI reply (+ auto-reply if enabled) + notification
```

## What you need
- The **same Google Cloud project** whose OAuth client you use to connect GMB accounts
  (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).
- The app reachable on a **public HTTPS URL** (Pub/Sub cannot push to `localhost`;
  for local testing use a tunnel like `cloudflared tunnel --url http://localhost:3258` or ngrok).
- At least one client connected to Google (Clients → client → Connect Google → Sync).

## Step 1 - Enable the APIs
Google Cloud Console → **APIs & Services → Library** → enable:
- **Cloud Pub/Sub API**
- **My Business Notifications API** (`mybusinessnotifications.googleapis.com`)
- (already enabled for GMB) Business Information API, Account Management API

## Step 2 - Create the topic
Console → **Pub/Sub → Topics → Create topic**
- Topic ID: `gbp-notifications`
- Uncheck "Add a default subscription"
- Copy the full name: `projects/<PROJECT_ID>/topics/gbp-notifications`

CLI alternative:
```bash
gcloud pubsub topics create gbp-notifications --project=<PROJECT_ID>
```

## Step 3 - Let Google publish to the topic (most-missed step)
Topic → **Permissions → Add principal**
- Principal: `mybusiness-api-pubsub@system.gserviceaccount.com`
- Role: **Pub/Sub Publisher**

```bash
gcloud pubsub topics add-iam-policy-binding gbp-notifications \
  --member="serviceAccount:mybusiness-api-pubsub@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher" --project=<PROJECT_ID>
```
Without this, "Enable" in the app succeeds but no messages ever arrive.

## Step 4 - Create a random push token
Any long random string, e.g.
```bash
openssl rand -hex 24
```

## Step 5 - Create the push subscription
Pub/Sub → **Subscriptions → Create subscription**
- Subscription ID: `gbp-notifications-push`
- Topic: `gbp-notifications`
- Delivery type: **Push**
- Endpoint URL: `https://YOUR-DOMAIN/api/gmb/pubsub?token=<TOKEN FROM STEP 4>`
- Acknowledgement deadline: 10 seconds (the app acks instantly and works after)
- Retry policy: "Retry after exponential backoff delay"

```bash
gcloud pubsub subscriptions create gbp-notifications-push \
  --topic=gbp-notifications \
  --push-endpoint="https://YOUR-DOMAIN/api/gmb/pubsub?token=<TOKEN>" \
  --ack-deadline=10 --project=<PROJECT_ID>
```

## Step 6 - Save topic + token in the app
Admin → **Integrations → Google APIs / Business Profile**
- *Pub/Sub topic*: `projects/gmb-api-507206/topics/gbp-notifications`
- *Push endpoint token*: the token from step 4
d144f3139db7803e3d88b02875d92044e8a03690f744bf5a
- Enable → **Save**

## Step 7 - Turn it on for every Google account
Admin → **Integrations** → card **"Real-time review notifications (Pub/Sub)"** →
**Enable for all accounts**. Each connected Google account should now show `enabled`.

(The app calls `PATCH accounts/{id}/notificationSetting` with the topic and the event types
`NEW_REVIEW, UPDATED_REVIEW, GOOGLE_UPDATE, DUPLICATE_LOCATION, LOSS_OF_VOICE_OF_MERCHANT,
NEW_CUSTOMER_MEDIA`.) Connect a new Google account later? Click **Enable for all accounts** again.

## Step 8 - Test
1. Pub/Sub → topic `gbp-notifications` → **Messages → Publish message** with this body
   (use a real location ID from a client's "Location ID"):
   ```json
   {"type":"GOOGLE_UPDATE","location":"accounts/123/locations/<LOCATION_ID>"}
   ```
   You should get a "Google edited …" notification in the app within seconds.
2. Real test: post a review on the business from another Google account → it appears in
   **Review inbox** (badge *real-time*) with an AI draft - or already replied if auto-reply is on.

## Auto-reply
- Admin → Web & maintenance → **Review auto-reply (platform switch)** must be *Allowed*.
- Per client: GMB profile → **Reviews** tab → **Auto-reply to reviews** ON + minimum stars
  (default 4★+). Lower ratings are never auto-published - they get a draft for a human.
- Only reviews from the last 14 days are auto-replied (old reviews imported on first sync
  are drafted, not published).

## Troubleshooting
| Symptom | Fix |
|---|---|
| "Enable" fails: `PERMISSION_DENIED` | Enable *My Business Notifications API*; the connected Google user must be owner/manager of the account |
| Enabled, but nothing arrives | Step 3 (publisher role) missing; or subscription endpoint wrong |
| Subscription shows errors 403 | Token in URL ≠ token saved in Integrations |
| 404 / timeouts | App not public on HTTPS, or a firewall blocks Google |
| Messages arrive, nothing in inbox | The location isn't connected in the app (client's `google_location_name` doesn't match) - Sync the client |
| Duplicates | Normal: Pub/Sub is at-least-once; the inbox de-duplicates by review ID |

Logs: server logs show `[pubsub] …` lines for handler errors; Admin → System health shows the
`review_sync` heartbeat (fallback sync).
