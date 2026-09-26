import { publicApi, notFound } from "@/lib/api/public.js";
import { one } from "@/lib/db";
import { postOut } from "@/lib/api/serializers.js";

export const dynamic = "force-dynamic";

export const GET = publicApi({ scope: "posts:read", endpoint: "posts.get" }, async ({ params, tenantId }) => {
  const t = await one("SELECT * FROM ai_tasks WHERE id=? AND tenant_id=?", [Number(params.id), tenantId]);
  if (!t) throw notFound("Post not found");
  return postOut(t);
});
