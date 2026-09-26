import net from "node:net";

async function get(url, opts = {}) {
  const res = await fetch(url, { ...opts, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${body.slice(0, 160)}`);
  }
  return res;
}

const basic = (u, p) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;

/** Returns a short success message or throws. Never echoes secrets. */
export async function runIntegrationTest(id, v) {
  switch (id) {
    case "razorpay":
      await get("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: basic(v.key_id, v.key_secret) } });
      return `Authenticated (${String(v.key_id).startsWith("rzp_test_") ? "test" : "live"} mode)`;
    case "firebase": {
      const { fcmAccessToken } = await import("../push/fcm.js");
      await fcmAccessToken(v.service_account, { force: true });
      return "Service account OK - FCM access token issued";
    }
    case "gemini":
      await get(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(v.api_key)}`);
      return "API key valid";
    case "openai":
      await get("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${v.api_key}` } });
      return "API key valid";
    case "huggingface":
      await get("https://huggingface.co/api/whoami-v2", { headers: { Authorization: `Bearer ${v.api_key}` } });
      return "Token valid";
    case "ollama":
      await get(`${String(v.base_url || "http://127.0.0.1:11434").replace(/\/$/, "")}/api/tags`, v.api_key ? { headers: { Authorization: `Bearer ${v.api_key}` } } : {});
      return "Server reachable";
    case "google":
      if (!/\.apps\.googleusercontent\.com$/.test(v.client_id || "")) throw new Error("Client ID should end with .apps.googleusercontent.com");
      if (!v.client_secret) throw new Error("Client secret missing");
      await get("https://accounts.google.com/.well-known/openid-configuration");
      return "Credentials look valid (full check happens on the first client connect)";
    case "google_places": {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": v.api_key, "X-Goog-FieldMask": "places.id" },
        body: JSON.stringify({ textQuery: "dentist in Delhi", pageSize: 1 }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      return "Places API (New) reachable";
    }
    case "smtp": {
      const nodemailer = (await import("nodemailer")).default;
      const t = nodemailer.createTransport({
        host: v.host,
        port: Number(v.port || 587),
        secure: String(v.secure) === "true",
        auth: v.user ? { user: v.user, pass: v.pass } : undefined,
        connectionTimeout: 8000,
      });
      await t.verify();
      return "SMTP login OK";
    }
    case "s3":
    case "r2":
    case "cloudinary": {
      const { getStorageChain, resetStorageChain } = await import("../storage/index.js");
      resetStorageChain();
      const chain = getStorageChain();
      if (!chain.length) throw new Error("No storage provider configured");
      return `Configured - active chain: ${chain.map((p) => p.name).join(" -> ")}`;
    }
    case "analytics":
      if (!/^G-[A-Z0-9]{4,}$/.test(v.measurement_id || "")) throw new Error("Measurement ID should look like G-XXXXXXX");
      return "Format OK";
    case "webhooks": {
      const u = new URL(v.url);
      if (u.protocol !== "https:") throw new Error("Webhook URL must be https");
      await new Promise((resolve, reject) => {
        const s = net.connect({ host: u.hostname, port: Number(u.port || 443), timeout: 6000 }, () => { s.end(); resolve(); });
        s.on("error", reject);
        s.on("timeout", () => { s.destroy(); reject(new Error("Timeout")); });
      });
      return "Endpoint reachable";
    }
    default:
      throw new Error("No test available");
  }
}
