/**
 * Every third-party integration the platform uses.
 * field.secret  -> encrypted, never sent to the browser (only "configured" + mask)
 * field.env     -> runtime process.env name the rest of the code already reads
 * field.public  -> safe to expose to the browser (Firebase web config, GA id)
 */
export const INTEGRATIONS = [
  {
    id: "razorpay",
    name: "Razorpay",
    group: "Payments",
    docs: "https://dashboard.razorpay.com/app/keys",
    fields: [
      {
        key: "key_id",
        label: "Key ID",
        env: "RAZORPAY_KEY_ID",
        placeholder: "rzp_live_...",
      },
      {
        key: "key_secret",
        label: "Key secret",
        env: "RAZORPAY_KEY_SECRET",
        secret: true,
      },
      {
        key: "webhook_secret",
        label: "Webhook secret",
        env: "RAZORPAY_WEBHOOK_SECRET",
        secret: true,
        hint: "Webhook URL: {APP_URL}/api/payments/razorpay/webhook",
      },
    ],
  },
  {
    id: "firebase",
    name: "Firebase Cloud Messaging",
    group: "Notifications",
    docs: "https://console.firebase.google.com",
    fields: [
      { key: "api_key", label: "Web API key", public: true },
      { key: "auth_domain", label: "Auth domain", public: true },
      {
        key: "project_id",
        label: "Project ID",
        public: true,
        env: "FIREBASE_PROJECT_ID",
      },
      {
        key: "messaging_sender_id",
        label: "Messaging sender ID",
        public: true,
      },
      { key: "app_id", label: "App ID", public: true },
      {
        key: "vapid_key",
        label: "Web push certificate (VAPID public key)",
        public: true,
      },
      {
        key: "service_account",
        label: "Service account JSON",
        secret: true,
        multiline: true,
        env: "FIREBASE_SERVICE_ACCOUNT",
        hint: "Project settings -> Service accounts -> Generate new private key",
      },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    group: "AI",
    fields: [
      { key: "api_key", label: "API key", env: "GEMINI_API_KEY", secret: true },
      {
        key: "text_model",
        label: "Text model",
        env: "GEMINI_TEXT_MODEL",
        placeholder: "gemini-2.5-flash",
      },
      { key: "image_model", label: "Image model", env: "GEMINI_IMAGE_MODEL" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    group: "AI",
    fields: [
      { key: "api_key", label: "API key", env: "OPENAI_API_KEY", secret: true },
      { key: "text_model", label: "Text model", env: "OPENAI_TEXT_MODEL" },
      { key: "image_model", label: "Image model", env: "OPENAI_IMAGE_MODEL" },
    ],
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    group: "AI",
    fields: [
      { key: "api_key", label: "API token", env: "HF_API_KEY", secret: true },
      { key: "text_model", label: "Text model", env: "HF_TEXT_MODEL" },
      { key: "image_model", label: "Image model", env: "HF_IMAGE_MODEL" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    group: "AI",
    fields: [
      {
        key: "base_url",
        label: "Base URL",
        env: "OLLAMA_BASE_URL",
        placeholder: "http://127.0.0.1:11434",
      },
      {
        key: "api_key",
        label: "API key (optional)",
        env: "OLLAMA_API_KEY",
        secret: true,
      },
      { key: "text_model", label: "Text model", env: "OLLAMA_TEXT_MODEL" },
    ],
    envWhenEnabled: { OLLAMA_ENABLED: "1" },
  },
  {
    id: "google",
    name: "Google APIs / Business Profile",
    group: "Google",
    fields: [
      { key: "client_id", label: "OAuth client ID", env: "GOOGLE_CLIENT_ID" },
      {
        key: "client_secret",
        label: "OAuth client secret",
        env: "GOOGLE_CLIENT_SECRET",
        secret: true,
      },
      {
        key: "redirect_uri",
        label: "Redirect URI",
        env: "GOOGLE_REDIRECT_URI",
        placeholder: "{APP_URL}/api/gmb/callback",
      },
      {
        key: "pubsub_topic",
        label: "Pub/Sub topic (real-time reviews)",
        placeholder: "projects/my-project/topics/gbp-notifications",
        hint: "Grant mybusiness-api-pubsub@system.gserviceaccount.com the Pub/Sub Publisher role on this topic.",
      },
      {
        key: "pubsub_push_token",
        label: "Push endpoint token",
        secret: true,
        hint: "Push subscription URL: {APP_URL}/api/gmb/pubsub?token=<this value>",
      },
    ],
    envWhenEnabled: { GMB_PROVIDER: "google" },
  },
  {
    id: "google_places",
    name: "Google Places API (rank grid)",
    group: "Google",
    docs: "https://console.cloud.google.com/apis/library/places.googleapis.com",
    fields: [
      {
        key: "api_key",
        label: "API key",
        secret: true,
        hint: "Enable Places API (New) + Maps Static API. Restrict the key to these APIs and your server IP.",
      },
      {
        key: "api_key",
        label: "API key",
        env: "GOOGLE_PLACES_API_KEY",
        secret: true,
        hint: "Enable Places API (New) + Maps Static API. Restrict the key to these APIs and your server IP.",
      },
    ],
  },
  {
    id: "smtp",
    name: "SMTP email",
    group: "Email",
    fields: [
      { key: "host", label: "Host", env: "SMTP_HOST" },
      { key: "port", label: "Port", env: "SMTP_PORT", placeholder: "587" },
      {
        key: "secure",
        label: "Secure (true/false)",
        env: "SMTP_SECURE",
        placeholder: "false",
      },
      { key: "user", label: "Username", env: "SMTP_USER" },
      { key: "pass", label: "Password", env: "SMTP_PASS", secret: true },
      {
        key: "from",
        label: "From address",
        env: "SMTP_FROM",
        placeholder: "GMB AI <no-reply@domain.com>",
      },
    ],
  },
  {
    id: "s3",
    name: "AWS S3 storage",
    group: "Storage",
    fields: [
      { key: "bucket", label: "Bucket", env: "AWS_S3_BUCKET" },
      { key: "region", label: "Region", env: "AWS_S3_REGION" },
      {
        key: "access_key_id",
        label: "Access key ID",
        env: "AWS_ACCESS_KEY_ID",
      },
      {
        key: "secret_access_key",
        label: "Secret access key",
        env: "AWS_SECRET_ACCESS_KEY",
        secret: true,
      },
      {
        key: "public_url",
        label: "Public URL (CDN)",
        env: "AWS_S3_PUBLIC_URL",
      },
    ],
  },
  {
    id: "r2",
    name: "Cloudflare R2 storage",
    group: "Storage",
    fields: [
      { key: "account_id", label: "Account ID", env: "R2_ACCOUNT_ID" },
      { key: "bucket", label: "Bucket", env: "R2_BUCKET" },
      { key: "access_key_id", label: "Access key ID", env: "R2_ACCESS_KEY_ID" },
      {
        key: "secret_access_key",
        label: "Secret access key",
        env: "R2_SECRET_ACCESS_KEY",
        secret: true,
      },
      { key: "public_url", label: "Public URL", env: "R2_PUBLIC_URL" },
    ],
  },
  {
    id: "cloudinary",
    name: "Cloudinary storage",
    group: "Storage",
    fields: [
      { key: "cloud_name", label: "Cloud name", env: "CLOUDINARY_CLOUD_NAME" },
      { key: "api_key", label: "API key", env: "CLOUDINARY_API_KEY" },
      {
        key: "api_secret",
        label: "API secret",
        env: "CLOUDINARY_API_SECRET",
        secret: true,
      },
      { key: "folder", label: "Folder", env: "CLOUDINARY_FOLDER" },
    ],
  },
  {
    id: "analytics",
    name: "Google Analytics",
    group: "Analytics",
    fields: [
      {
        key: "measurement_id",
        label: "GA4 measurement ID",
        public: true,
        placeholder: "G-XXXXXXX",
      },
    ],
  },
  {
    id: "webhooks",
    name: "Outgoing webhooks",
    group: "Webhooks",
    fields: [
      {
        key: "url",
        label: "Endpoint URL",
        placeholder: "https://example.com/hooks/gmb",
      },
      {
        key: "secret",
        label: "Signing secret",
        secret: true,
        hint: "Requests carry X-Signature: sha256 HMAC of the body",
      },
      {
        key: "events",
        label: "Events (comma separated)",
        placeholder: "post.published,report.shared,ticket.created",
      },
    ],
  },
];

export const INTEGRATION_IDS = INTEGRATIONS.map((i) => i.id);
export const byId = (id) => INTEGRATIONS.find((i) => i.id === id) || null;
