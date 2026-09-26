import { publicApi, pageParams } from "@/lib/api/public.js";
import { query } from "@/lib/db";
import { clientOut } from "@/lib/api/serializers.js";

export const dynamic = "force-dynamic";

/** GET /api/v1/clients?page=1&limit=20&search= */
export const GET = publicApi({ scope: "clients:read", endpoint: "clients.list" }, async ({ request, tenantId }) => {
  const { sp, limit, offset, page } = pageParams(request);
  const search = (sp.get("search") || "").trim().slice(0, 80);
  const where = ["tenant_id=?"];
  const params = [tenantId];
  if (search) {
    where.push("(business_name LIKE ? OR city LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  const [rows, [{ n }]] = await Promise.all([
    query(`SELECT * FROM clients WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) n FROM clients WHERE ${where.join(" AND ")}`, params),
  ]);
  return { items: rows.map(clientOut), page, limit, total: Number(n) };
});
