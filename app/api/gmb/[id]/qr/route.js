import { createElement as h } from "react";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { guard } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { one } from "@/lib/db";
import { listingLinks } from "@/lib/gmb/links.js";
import { toDataUrl } from "@/lib/images/creative.js";

export const dynamic = "force-dynamic";

const TITLES = { review: "Review us on Google", maps: "Find us on Google Maps", search: "See us on Google", website: "Visit our website" };

/**
 * GET ?target=review|maps|search|website&format=png|svg|json&poster=1
 *   png/svg  -> plain QR code
 *   poster=1 -> printable A5-ratio poster (logo, name, QR, call to action)
 */
export async function GET(request, { params }) {
  const g = await guard(request, { permission: "gmb.view" });
  if (g.error) return g.error;
  const { id } = await params;
  const clientId = Number(id);
  try {
    await assertClientInTenant(clientId, g.ctx.tenantId);
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const sp = new URL(request.url).searchParams;
  const target = TITLES[sp.get("target")] ? sp.get("target") : "review";
  const links = await listingLinks(clientId);
  const url = links?.[target];
  if (sp.get("format") === "json") return Response.json({ ok: true, links });
  if (!url) return Response.json({ error: `No ${target} link yet - connect & sync Google first.` }, { status: 404 });

  const dark = "#0B2A5B";
  const file = `${links.business.replace(/[^\w]+/g, "-").toLowerCase()}-${target}-qr`;
  if (sp.get("format") === "svg" && !sp.get("poster")) {
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark, light: "#ffffff" } });
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `inline; filename="${file}.svg"` } });
  }
  const png = await QRCode.toBuffer(url, { type: "png", width: 1024, margin: 2, errorCorrectionLevel: "M", color: { dark, light: "#ffffff" } });
  if (!sp.get("poster")) {
    return new Response(png, { headers: { "Content-Type": "image/png", "Content-Disposition": `inline; filename="${file}.png"`, "Cache-Control": "private, max-age=300" } });
  }

  const c = await one("SELECT logo_url, city FROM clients WHERE id=?", [clientId]);
  const logo = await toDataUrl(c?.logo_url);
  const qr = `data:image/png;base64,${png.toString("base64")}`;
  const tree = h(
    "div",
    { style: { width: 1240, height: 1754, display: "flex", flexDirection: "column", alignItems: "center", background: "#ffffff", fontFamily: "sans-serif", padding: 90 } },
    logo ? h("img", { src: logo, width: 200, height: 200, style: { width: 200, height: 200, objectFit: "contain" } }) : null,
    h("div", { style: { fontSize: 64, fontWeight: 700, color: dark, marginTop: 30, textAlign: "center" } }, links.business),
    c?.city ? h("div", { style: { fontSize: 36, color: "#64748b", marginTop: 8 } }, c.city) : null,
    h("div", { style: { fontSize: 80, fontWeight: 700, color: "#111827", marginTop: 70, textAlign: "center" } }, TITLES[target]),
    target === "review"
      ? h("div", { style: { display: "flex", gap: 14, marginTop: 20 } },
          ...[0, 1, 2, 3, 4].map((i) => h("svg", { key: i, width: 84, height: 84, viewBox: "0 0 24 24" }, h("path", { d: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z", fill: "#f59e0b" }))))
      : null,
    h("img", { src: qr, width: 760, height: 760, style: { marginTop: 50, borderRadius: 40, border: `14px solid ${dark}` } }),
    h("div", { style: { fontSize: 40, color: "#334155", marginTop: 50 } }, "Scan with your phone camera"),
  );
  const res = new ImageResponse(tree, { width: 1240, height: 1754 });
  return new Response(await res.arrayBuffer(), { headers: { "Content-Type": "image/png", "Content-Disposition": `inline; filename="${file}-poster.png"` } });
}
