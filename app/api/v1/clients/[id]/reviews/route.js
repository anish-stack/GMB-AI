import { publicApi, notFound } from "@/lib/api/public.js";
import { one } from "@/lib/db";
import { providerFor } from "@/lib/gmb/provider";

export const dynamic = "force-dynamic";

export const GET = publicApi({ scope: "reviews:read", endpoint: "reviews.list" }, async ({ params, tenantId }) => {
  const c = await one("SELECT id FROM clients WHERE id=? AND tenant_id=?", [Number(params.id), tenantId]);
  if (!c) throw notFound("Client not found");
  const r = await (await providerFor(c.id)).getReviews(c.id);
  return {
    average_rating: Number(r.average_rating || 0),
    total: Number(r.total ?? (r.items || []).length),
    items: (r.items || []).slice(0, 100).map((x) => ({
      id: x.id, author: x.author, rating: x.rating, comment: x.comment || "", created_at: x.created_at,
      reply: x.reply?.comment ? { comment: x.reply.comment, updated_at: x.reply.updated_at || null } : null,
    })),
  };
});
