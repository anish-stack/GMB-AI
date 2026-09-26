import { guard } from "@/lib/saas/guard.js";
import { latestIdForUser } from "@/lib/notifications/service.js";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events: pushes { unread, lastId } whenever the user's
 * notifications change. The connection closes after ~5 minutes and the
 * browser's EventSource reconnects automatically.
 */
export async function GET(request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const userId = g.ctx.userId;
  const encoder = new TextEncoder();
  let timer;
  const stream = new ReadableStream({
    async start(controller) {
      let last = -1;
      let ticks = 0;
      const send = (event, data) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const tick = async () => {
        try {
          const s = await latestIdForUser(userId);
          if (s.lastId !== last) {
            last = s.lastId;
            send("notifications", s);
          } else if (ticks % 5 === 0) controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* db hiccup - try next tick */
        }
        ticks += 1;
        if (ticks > 75) {
          clearInterval(timer);
          controller.close();
        }
      };
      controller.enqueue(encoder.encode("retry: 5000\n\n"));
      await tick();
      timer = setInterval(tick, 4000);
      request.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try { controller.close(); } catch { /* closed */ }
      });
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
