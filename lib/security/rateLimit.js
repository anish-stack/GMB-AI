import "server-only";
import { one, query } from "../db.js";

/**
 * Minimal DB-backed rate limiter (sliding window over rate_limit_hits).
 * Good enough for a single-app-server prototype and survives serverless
 * cold starts / multiple instances, unlike an in-memory Map. For real scale,
 * swap the two queries below for Redis INCR + EXPIRE - call sites don't change.
 *
 * Usage:
 *   const rl = await rateLimit(`login:${ip}`, { max: 8, windowSec: 300 });
 *   if (!rl.allowed) return NextResponse.json({ error: rl.message }, { status: 429 });
 */
export async function rateLimit(key, { max = 10, windowSec = 60 } = {}) {
  try {
    await query("INSERT INTO rate_limit_hits (rkey) VALUES (?)", [key]);
    const row = await one(
      "SELECT COUNT(*) AS n FROM rate_limit_hits WHERE rkey=? AND created_at >= (NOW() - INTERVAL ? SECOND)",
      [key, windowSec]
    );
    const count = Number(row?.n || 0);
    if (count % 50 === 0) {
      // occasional best-effort cleanup so the table doesn't grow forever
      query("DELETE FROM rate_limit_hits WHERE created_at < (NOW() - INTERVAL 1 DAY)").catch(() => {});
    }
    if (count > max) {
      return { allowed: false, remaining: 0, message: "Too many attempts. Please wait a few minutes and try again." };
    }
    return { allowed: true, remaining: max - count };
  } catch (err) {
    // Never let a rate-limit bug take the whole endpoint down.
    console.error("[rate-limit] failed, allowing request:", err.message);
    return { allowed: true, remaining: max, degraded: true };
  }
}

/** Pulls a best-effort client IP out of a Next.js Request (works behind common proxies too). */
export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
