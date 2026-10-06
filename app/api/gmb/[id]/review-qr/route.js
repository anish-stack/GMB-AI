import { createElement as h } from "react";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { guard } from "@/lib/saas/guard.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { one } from "@/lib/db";
import { getFlow } from "@/lib/reviews/flow.js";
import { listingLinks } from "@/lib/gmb/links.js";
import { toDataUrl } from "@/lib/images/creative.js";

export const dynamic = "force-dynamic";

/**
 * GET ?format=png|svg            -> branded QR (logo in the middle, high error correction)
 *     ?poster=1                  -> printable A4 poster (style / accent / copy from the flow settings)
 * The QR points to the smart review flow (mode AI) or straight to Google's review box (mode DIRECT).
 */
const STYLES = {
  vibrant: { bg: (a) => `linear-gradient(160deg, ${a} 0%, #111827 100%)`, card: "#ffffff", text: "#ffffff", sub: "rgba(255,255,255,.85)", inner: "#0f172a" },
  minimal: { bg: () => "#ffffff", card: "#ffffff", text: "#0f172a", sub: "#475569", inner: "#0f172a", border: true },
  midnight: { bg: () => "#0b1020", card: "#ffffff", text: "#ffffff", sub: "#cbd5e1", inner: "#0f172a" },
  cream: { bg: () => "#fbf6ea", card: "#ffffff", text: "#3b2f1e", sub: "#6b5a3e", inner: "#3b2f1e", double: true },
};

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
  const flow = await getFlow(clientId);
  const links = await listingLinks(clientId);
  const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const url = flow.mode === "DIRECT" ? links?.review : `${base}/review/${flow.slug}`;
  if (!url) return Response.json({ error: "No Google review link yet - connect & sync Google first." }, { status: 404 });
  const accent = flow.poster.accent || "#0EA5E9";
  const file = `${flow.slug}-review-qr`;

  if (sp.get("format") === "svg" && !sp.get("poster")) {
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "H", color: { dark: "#0f172a", light: "#ffffff" } });
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `inline; filename="${file}.svg"` } });
  }

  const qrPng = await QRCode.toBuffer(url, { type: "png", width: 900, margin: 1, errorCorrectionLevel: "H", color: { dark: "#0f172a", light: "#ffffff" } });
  const qr = `data:image/png;base64,${qrPng.toString("base64")}`;
  const c = await one("SELECT business_name, logo_url FROM clients WHERE id=?", [clientId]);
  const logo = await toDataUrl(c?.logo_url);

  const qrBlock = (size) =>
    h("div", { style: { position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: size * 0.08, padding: size * 0.05, boxShadow: "0 10px 30px rgba(0,0,0,.18)" } },
      h("img", { src: qr, width: size * 0.9, height: size * 0.9 }),
      logo
        ? h("div", { style: { position: "absolute", width: size * 0.22, height: size * 0.22, borderRadius: size * 0.05, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `${Math.round(size * 0.012)}px solid ${accent}` } },
            h("img", { src: logo, width: size * 0.17, height: size * 0.17, style: { objectFit: "contain", borderRadius: size * 0.03 } }))
        : h("div", { style: { position: "absolute", width: size * 0.2, height: size * 0.2, borderRadius: size * 0.05, background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.08, fontWeight: 700 } }, "G"),
    );

  if (!sp.get("poster")) {
    const res = new ImageResponse(
      h("div", { style: { width: 1000, height: 1100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#ffffff" } },
        h("div", { style: { display: "flex", padding: 26, borderRadius: 60, background: accent } }, qrBlock(820)),
        h("div", { style: { marginTop: 34, fontSize: 46, fontWeight: 700, color: "#0f172a", display: "flex" } }, "Scan to review us"),
      ),
      { width: 1000, height: 1100 },
    );
    return new Response(await res.arrayBuffer(), { headers: { "Content-Type": "image/png", "Content-Disposition": `${sp.get("download") ? "attachment" : "inline"}; filename="${file}.png"` } });
  }

  // ---------- printable poster (A4 @ 150 dpi) ----------
  const p = flow.poster;
  const st = STYLES[p.style] || STYLES.minimal;
  const star = (k) => h("svg", { key: k, width: 64, height: 64, viewBox: "0 0 24 24" }, h("path", { d: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z", fill: "#f59e0b" }));
  const tree = h("div", { style: { width: 1240, height: 1754, display: "flex", padding: 50, background: st.bg(accent) } },
    h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", borderRadius: 50, padding: "90px 80px 60px", border: st.border ? `16px solid ${accent}` : st.double ? `10px double ${accent}` : "0", background: p.style === "vibrant" || p.style === "midnight" ? "transparent" : "#ffffff" } },
      h("div", { style: { display: "flex", fontSize: 54, fontWeight: 800, letterSpacing: 2, color: "#4285F4" } }, "G", h("span", { style: { color: "#EA4335" } }, "o"), h("span", { style: { color: "#FBBC05" } }, "o"), h("span", { style: { color: "#4285F4" } }, "g"), h("span", { style: { color: "#34A853" } }, "l"), h("span", { style: { color: "#EA4335" } }, "e")),
      h("div", { style: { marginTop: 24, fontSize: 92, fontWeight: 800, color: st.text, textAlign: "center", lineHeight: 1.05, textTransform: "uppercase", display: "flex" } }, p.headline),
      h("div", { style: { marginTop: 18, fontSize: 40, color: st.sub, display: "flex" } }, p.subtitle),
      h("div", { style: { display: "flex", gap: 10, marginTop: 26 } }, ...[0, 1, 2, 3, 4].map(star)),
      h("div", { style: { display: "flex", alignItems: "center", gap: 60, marginTop: 70 } },
        h("div", { style: { display: "flex", flexDirection: "column", gap: 34, width: 420 } },
          ...p.steps.map((s, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 20 } },
            h("div", { style: { width: 64, height: 64, borderRadius: 32, background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800 } }, String(i + 1)),
            h("div", { style: { fontSize: 34, fontWeight: 600, color: st.text, display: "flex", width: 330 } }, s)))),
        h("div", { style: { display: "flex", padding: 22, borderRadius: 56, background: "#0f172a" } }, qrBlock(520)),
      ),
      h("div", { style: { flex: 1, display: "flex" } }),
      h("div", { style: { display: "flex", alignItems: "center", gap: 20, padding: "20px 34px", borderRadius: 999, background: "#ffffff", boxShadow: "0 8px 24px rgba(0,0,0,.12)" } },
        logo ? h("img", { src: logo, width: 72, height: 72, style: { borderRadius: 16, objectFit: "contain" } }) : null,
        h("div", { style: { fontSize: 40, fontWeight: 800, color: "#0f172a", display: "flex" } }, c?.business_name || "")),
      p.footer ? h("div", { style: { marginTop: 22, fontSize: 26, color: st.sub, display: "flex" } }, p.footer) : null,
    ),
  );
  const res = new ImageResponse(tree, { width: 1240, height: 1754 });
  return new Response(await res.arrayBuffer(), { headers: { "Content-Type": "image/png", "Content-Disposition": `${sp.get("download") ? "attachment" : "inline"}; filename="${file}-poster.png"` } });
}
