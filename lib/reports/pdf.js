import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const FONT_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "lib", "reports", "fonts");
const F = {
  regular: path.join(FONT_DIR, "inter-latin-400-normal.woff"),
  semibold: path.join(FONT_DIR, "inter-latin-600-normal.woff"),
  bold: path.join(FONT_DIR, "inter-latin-700-normal.woff"),
  deva: path.join(FONT_DIR, "noto-sans-devanagari-devanagari-400-normal.woff"),
};
const C = {
  brand: "#F53236", ink: "#18181b", body: "#3f3f46", muted: "#71717a", line: "#e4e4e7", soft: "#f4f4f5",
  green: "#059669", red: "#e11d48", blue: "#0284c7", violet: "#7c3aed", amber: "#d97706",
};
const PAGE = { w: 595.28, h: 841.89, m: 40 };
const W = PAGE.w - PAGE.m * 2;
const DEVA = /[\u0900-\u097F]+/g;
const n = (v) => Number(v || 0).toLocaleString("en-IN");
// Inter latin subset: keep printable latin + common punctuation, drop other scripts/emoji
const clean = (s) => String(s ?? "").replace(/[^\u0000-\u024F\u2010-\u2027\u2030-\u205E\u0900-\u097F\n]/g, "").replace(/\s+\n/g, "\n");

function fontsReady(doc) {
  const ok = fs.existsSync(/*turbopackIgnore: true*/ F.regular);
  if (ok) {
    doc.registerFont("R", F.regular);
    doc.registerFont("S", F.semibold);
    doc.registerFont("B", F.bold);
    doc.registerFont("D", F.deva);
  } else {
    doc.registerFont("R", "Helvetica");
    doc.registerFont("S", "Helvetica-Bold");
    doc.registerFont("B", "Helvetica-Bold");
    doc.registerFont("D", "Helvetica");
  }
}

/** Writes text that may mix Latin + Devanagari (Hindi reviews) with the right font per run. */
function mixed(doc, text, x, y, opts = {}, font = "R") {
  const str = clean(text);
  const parts = [];
  let last = 0;
  for (const m of str.matchAll(DEVA)) {
    if (m.index > last) parts.push([font, str.slice(last, m.index)]);
    parts.push(["D", m[0]]);
    last = m.index + m[0].length;
  }
  if (last < str.length) parts.push([font, str.slice(last)]);
  if (!parts.length) parts.push([font, ""]);
  parts.forEach(([f, t], i) => {
    doc.font(f);
    const o = { ...opts, continued: i < parts.length - 1 };
    if (i === 0) doc.text(t, x, y, o);
    else doc.text(t, o);
  });
}

function delta(v) {
  if (v === null || v === undefined) return { text: "no prior data", color: C.muted };
  if (v === 0) return { text: "0% vs previous", color: C.muted };
  return { text: `${v > 0 ? "+" : ""}${v}% vs previous`, color: v > 0 ? C.green : C.red };
}

function sectionTitle(doc, title, y, sub) {
  doc.font("B").fontSize(13).fillColor(C.ink).text(title, PAGE.m, y);
  if (sub) doc.font("R").fontSize(8.5).fillColor(C.muted).text(sub, PAGE.m, y + 17);
  return y + (sub ? 32 : 22);
}

function ensure(doc, y, need) {
  if (y + need > PAGE.h - 60) {
    doc.addPage();
    return PAGE.m;
  }
  return y;
}

function kpi(doc, x, y, w, label, value, d, color) {
  doc.roundedRect(x, y, w, 64, 10).fill(C.soft);
  doc.rect(x, y + 12, 3, 40).fill(color);
  doc.font("R").fontSize(8).fillColor(C.muted).text(label.toUpperCase(), x + 14, y + 11, { width: w - 20, characterSpacing: 0.4 });
  doc.font("B").fontSize(19).fillColor(C.ink).text(value, x + 14, y + 23, { width: w - 20 });
  const dd = delta(d);
  doc.font("S").fontSize(7.5).fillColor(dd.color).text(dd.text, x + 14, y + 47, { width: w - 20 });
}

function barChart(doc, x, y, w, h, series, { color = C.blue, labelEvery = 7 } = {}) {
  const max = Math.max(1, ...series.map((s) => s.value));
  doc.save();
  for (let i = 0; i <= 4; i++) {
    const gy = y + h - (h * i) / 4;
    doc.moveTo(x, gy).lineTo(x + w, gy).lineWidth(0.4).strokeColor(C.line).stroke();
    doc.font("R").fontSize(6.5).fillColor(C.muted).text(n(Math.round((max * i) / 4)), x - 30, gy - 4, { width: 26, align: "right" });
  }
  const bw = w / Math.max(1, series.length);
  series.forEach((s, i) => {
    const bh = (s.value / max) * h;
    doc.roundedRect(x + i * bw + bw * 0.18, y + h - bh, Math.max(1, bw * 0.64), Math.max(0.5, bh), Math.min(2, bw * 0.2)).fill(color);
    const lastOk = i === series.length - 1 && (series.length - 1) % labelEvery >= labelEvery / 2;
    if (series.length <= 14 || i % labelEvery === 0 || lastOk) {
      doc.font("R").fontSize(6.5).fillColor(C.muted).text(s.label, x + i * bw - 10, y + h + 4, { width: bw + 20, align: "center" });
    }
  });
  doc.restore();
}

function hbars(doc, x, y, w, rows, color) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  rows.forEach((r, i) => {
    const ry = y + i * 22;
    doc.font("R").fontSize(8.5).fillColor(C.body);
    mixed(doc, r.label, x, ry + 2, { width: 150, ellipsis: true, lineBreak: false });
    doc.roundedRect(x + 158, ry + 3, w - 220, 9, 4).fill(C.soft);
    doc.roundedRect(x + 158, ry + 3, Math.max(3, ((w - 220) * r.value) / max), 9, 4).fill(r.color || color);
    doc.font("S").fontSize(8.5).fillColor(C.ink).text(n(r.value), x + w - 56, ry + 2, { width: 56, align: "right" });
  });
  return y + rows.length * 22;
}

/** Renders the full client-facing GMB report. Returns a Buffer. */
export function renderGmbReportPdf(r) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE.m, bufferPages: true, font: fs.existsSync(/*turbopackIgnore: true*/ F.regular) ? F.regular : "Helvetica", info: { Title: `GMB report - ${r.client.business_name}`, Author: r.client.agency_name || "GMB AI Cloud" } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    fontsReady(doc);

    const p = r.profile || {};
    const t = r.totals;
    const agency = r.client.agency_name || "Your agency";

    /* ---------- cover header ---------- */
    doc.rect(0, 0, PAGE.w, 150).fill(C.brand);
    doc.circle(PAGE.w - 40, 10, 90).fillOpacity(0.12).fill("#ffffff").fillOpacity(1);
    doc.font("S").fontSize(9).fillColor("#ffe4e6").text("GOOGLE BUSINESS PROFILE PERFORMANCE REPORT", PAGE.m, 34, { characterSpacing: 1 });
    doc.fillColor("#ffffff").fontSize(clean(r.client.business_name).length > 40 ? 19 : 24);
    mixed(doc, r.client.business_name, PAGE.m, 52, { width: W - 60, height: 58, ellipsis: true }, "B");
    doc.font("R").fontSize(10).fillColor("#ffe4e6").text(`${r.period.start}  to  ${r.period.end}  ·  ${r.period.days} days`, PAGE.m, 112);
    doc.font("S").fontSize(9).fillColor("#ffffff").text(`Prepared by ${clean(agency)}`, PAGE.m, 112, { width: W, align: "right" });
    doc.fontSize(26).font("B"); // reset

    /* ---------- business card ---------- */
    let y = 170;
    doc.roundedRect(PAGE.m, y, W, 92, 12).lineWidth(0.8).strokeColor(C.line).stroke();
    const left = [
      ["Category", p.category || r.client.business_category],
      ["Address", p.address || r.client.address],
      ["Phone", p.phone || r.client.phone],
    ];
    const right = [
      ["Website", (p.website || r.client.website || "").replace(/^https?:\/\//, "")],
      ["Rating", r.reviews.average ? `${r.reviews.average.toFixed(1)} / 5  (${n(r.reviews.total)} reviews)` : "-"],
      ["Profile health", `${r.health}%`],
    ];
    const col = (rows, x) =>
      rows.forEach(([k, v], i) => {
        doc.font("R").fontSize(7.5).fillColor(C.muted).text(k.toUpperCase(), x, y + 14 + i * 25, { characterSpacing: 0.4 });
        doc.fillColor(C.ink).fontSize(9.5);
        mixed(doc, v || "-", x, y + 24 + i * 25, { width: W / 2 - 30, ellipsis: true, lineBreak: false }, "S");
      });
    col(left, PAGE.m + 16);
    col(right, PAGE.m + W / 2 + 8);

    /* ---------- KPIs ---------- */
    y = 282;
    y = sectionTitle(doc, "Key results", y, `Compared with the previous ${r.period.days} days (${r.period.prevStart} to ${r.period.prevEnd})`);
    const kw = (W - 20) / 3;
    const kpis = [
      ["Total views", n(t.views), r.deltas.views, C.blue],
      ["Search views", n(t.search_views), r.deltas.search_views, C.violet],
      ["Maps views", n(t.maps_views), r.deltas.maps_views, C.amber],
      ["Website clicks", n(t.clicks), r.deltas.clicks, C.green],
      ["Calls", n(t.calls), r.deltas.calls, C.brand],
      ["Direction requests", n(t.direction_requests), r.deltas.direction_requests, C.blue],
    ];
    kpis.forEach((k, i) => kpi(doc, PAGE.m + (i % 3) * (kw + 10), y + Math.floor(i / 3) * 74, kw, ...k));
    y += 150;

    doc.roundedRect(PAGE.m, y, W, 46, 10).fill("#fff1f2");
    doc.font("B").fontSize(20).fillColor(C.brand).text(n(t.actions), PAGE.m + 16, y + 11);
    doc.font("S").fontSize(9).fillColor(C.ink).text("customer actions", PAGE.m + 100, y + 12);
    doc.font("R").fontSize(8.5).fillColor(C.body).text(
      `calls + website clicks + directions${t.messages || t.bookings ? " + messages + bookings" : ""} · ${t.conversion}% of views took an action · ${delta(r.deltas.actions).text}`,
      PAGE.m + 100, y + 25, { width: W - 116 },
    );
    y += 64;

    /* ---------- daily chart ---------- */
    y = ensure(doc, y, 190);
    y = sectionTitle(doc, "Daily profile views", y, "How many times the listing was shown on Google Search and Maps each day");
    const series = r.series.map((s) => ({ label: String(s.stat_date).slice(5).replace("-", "/"), value: Number(s.views || 0) }));
    if (series.length) barChart(doc, PAGE.m + 32, y + 6, W - 36, 120, series, { labelEvery: Math.ceil(series.length / 8) });
    else doc.font("R").fontSize(9).fillColor(C.muted).text("No performance data available for this period yet.", PAGE.m, y + 40);
    y += 150;

    /* ---------- page 2: actions + weekday + keywords ---------- */
    doc.addPage();
    y = PAGE.m;
    y = sectionTitle(doc, "What customers did", y, "Actions taken directly from the Google listing");
    y = hbars(doc, PAGE.m, y + 4, W, [
      { label: "Website clicks", value: t.clicks, color: C.green },
      { label: "Phone calls", value: t.calls, color: C.brand },
      { label: "Direction requests", value: t.direction_requests, color: C.blue },
      ...(t.messages ? [{ label: "Messages", value: t.messages, color: C.violet }] : []),
      ...(t.bookings ? [{ label: "Bookings", value: t.bookings, color: C.amber }] : []),
    ], C.blue) + 18;

    y = sectionTitle(doc, "Best days of the week", y, "Average daily views by weekday - plan posts and offers for the busiest days");
    const wmax = Math.max(1, ...r.weekdays.map((d) => d.value));
    const ww = W / 7;
    r.weekdays.forEach((d, i) => {
      const bh = (d.value / wmax) * 70;
      const x = PAGE.m + i * ww;
      doc.roundedRect(x + ww * 0.22, y + 78 - bh, ww * 0.56, Math.max(1, bh), 3).fill(d.value === wmax ? C.brand : "#fecdd3");
      doc.font("S").fontSize(8).fillColor(C.ink).text(d.label, x, y + 84, { width: ww, align: "center" });
      doc.font("R").fontSize(7).fillColor(C.muted).text(n(d.value), x, y + 96, { width: ww, align: "center" });
    });
    y += 122;

    y = ensure(doc, y, 120);
    y = sectionTitle(doc, "Top search terms", y, "What people typed on Google before finding the business (Google reports these monthly)");
    if (r.keywords.length) {
      y = hbars(doc, PAGE.m, y + 4, W, r.keywords.slice(0, 10).map((k) => ({ label: k.keyword, value: k.impressions })), C.violet) + 16;
    } else {
      doc.font("R").fontSize(9).fillColor(C.muted).text("Google hasn't shared search-term data for this listing yet.", PAGE.m, y + 2);
      y += 24;
    }

    /* ---------- reviews ---------- */
    y = ensure(doc, y, 200);
    y = sectionTitle(doc, "Reviews & reputation", y);
    const rv = r.reviews;
    const box = (x, label, value, color) => {
      doc.roundedRect(x, y, (W - 30) / 4, 52, 10).fill(C.soft);
      doc.font("B").fontSize(17).fillColor(color).text(value, x + 12, y + 10);
      doc.font("R").fontSize(7.5).fillColor(C.muted).text(label, x + 12, y + 33);
    };
    const bw4 = (W - 30) / 4 + 10;
    box(PAGE.m, "Average rating", rv.average ? rv.average.toFixed(1) : "-", C.amber);
    box(PAGE.m + bw4, "Total reviews", n(rv.total), C.ink);
    box(PAGE.m + bw4 * 2, `New in ${r.period.days} days`, n(rv.newInPeriod), C.green);
    box(PAGE.m + bw4 * 3, "Response rate", rv.responseRate === null ? "-" : `${rv.responseRate}%`, rv.responseRate >= 80 ? C.green : C.red);
    y += 66;
    y = hbars(doc, PAGE.m, y, W, rv.distribution.map((d) => ({ label: `${d.stars} star${d.stars > 1 ? "s" : ""}`, value: d.count, color: d.stars >= 4 ? C.green : d.stars === 3 ? C.amber : C.red })), C.amber) + 12;

    for (const rev of rv.recent.slice(0, 4)) {
      const body = clean(rev.comment || "(rating only)").slice(0, 260);
      doc.font("R").fontSize(8.5);
      const h = Math.min(60, doc.heightOfString(body, { width: W - 24 })) + 30;
      y = ensure(doc, y, h + 8);
      doc.roundedRect(PAGE.m, y, W, h, 8).lineWidth(0.6).strokeColor(C.line).stroke();
      doc.fillColor(C.ink).fontSize(8.5);
      mixed(doc, `${rev.author || "Google user"}`, PAGE.m + 12, y + 9, { lineBreak: false }, "S");
      doc.font("S").fontSize(8).fillColor(C.amber).text(`${"*".repeat(rev.rating)}${"-".repeat(5 - rev.rating)}  ${rev.rating}/5`, PAGE.m + 12, y + 9, { width: W - 24, align: "right" });
      doc.fillColor(C.body).fontSize(8.5);
      mixed(doc, body, PAGE.m + 12, y + 22, { width: W - 24, height: h - 26, ellipsis: true });
      y += h + 8;
    }

    /* ---------- page 3: posts, health, recommendations ---------- */
    doc.addPage();
    y = PAGE.m;
    y = sectionTitle(doc, "Posts published", y, `${r.posts.length} post(s) went live in this period`);
    if (r.posts.length) {
      doc.rect(PAGE.m, y, W, 20).fill(C.soft);
      doc.font("S").fontSize(8).fillColor(C.muted).text("DATE", PAGE.m + 10, y + 6).text("TITLE", PAGE.m + 90, y + 6).text("TYPE", PAGE.m + W - 90, y + 6);
      y += 24;
      for (const post of r.posts.slice(0, 18)) {
        y = ensure(doc, y, 20);
        doc.font("R").fontSize(8.5).fillColor(C.body).text(post.published_at ? new Date(post.published_at).toISOString().slice(0, 10) : "-", PAGE.m + 10, y);
        doc.fillColor(C.ink);
        mixed(doc, post.title || "Untitled", PAGE.m + 90, y, { width: W - 190, ellipsis: true, lineBreak: false }, "R");
        doc.font("R").fillColor(C.muted).text(post.post_type || "-", PAGE.m + W - 90, y, { width: 90 });
        y += 18;
        doc.moveTo(PAGE.m, y - 4).lineTo(PAGE.m + W, y - 4).lineWidth(0.3).strokeColor(C.line).stroke();
      }
      y += 12;
    } else {
      doc.font("R").fontSize(9).fillColor(C.muted).text("No posts were published in this period.", PAGE.m, y);
      y += 26;
    }

    y = ensure(doc, y, 190);
    y = sectionTitle(doc, `Profile health - ${r.health}%`, y, "A complete, active profile ranks higher and converts better");
    doc.roundedRect(PAGE.m, y, W, 8, 4).fill(C.soft);
    doc.roundedRect(PAGE.m, y, Math.max(8, (W * r.health) / 100), 8, 4).fill(r.health >= 80 ? C.green : r.health >= 50 ? C.amber : C.red);
    y += 18;
    r.checklist.forEach((c, i) => {
      const x = PAGE.m + (i % 2) * (W / 2);
      const cy = y + Math.floor(i / 2) * 20;
      doc.circle(x + 6, cy + 5, 5).fill(c.ok ? C.green : "#fecdd3");
      doc.font("B").fontSize(7).fillColor("#ffffff").text(c.ok ? "v" : "x", x + 3.5, cy + 1.2);
      doc.font("R").fontSize(9).fillColor(c.ok ? C.body : C.ink).text(c.label, x + 18, cy);
    });
    y += Math.ceil(r.checklist.length / 2) * 20 + 16;

    if (r.rank) {
      y = ensure(doc, y, 170);
      y = sectionTitle(doc, `Local rank - "${clean(r.rank.keyword)}"`, y, `${r.rank.grid} grid, ${r.rank.spacing} km apart · scanned ${new Date(r.rank.at).toISOString().slice(0, 10)}`);
      const bw3 = (W - 20) / 3;
      [["Average rank", String(r.rank.avg), C.blue], ["Top-3 coverage", `${r.rank.top3}%`, C.green], ["Found in top 20", `${r.rank.found}%`, C.violet]].forEach(([k, v, col], i) => {
        const x = PAGE.m + i * (bw3 + 10);
        doc.roundedRect(x, y, bw3, 46, 10).fill(C.soft);
        doc.font("B").fontSize(16).fillColor(col).text(v, x + 12, y + 8);
        doc.font("R").fontSize(7.5).fillColor(C.muted).text(k, x + 12, y + 30);
      });
      y += 58;
      if (r.rank.competitors.length) {
        doc.font("S").fontSize(8.5).fillColor(C.ink).text("Top competitors in the area", PAGE.m, y);
        y += 14;
        for (const c of r.rank.competitors) {
          doc.font("R").fontSize(8.5).fillColor(C.body);
          mixed(doc, `${c.name}  ·  ${c.rating ?? "-"}/5 (${c.reviews})  ·  avg rank ${c.avg_rank}`, PAGE.m + 8, y, { width: W - 16, lineBreak: false, ellipsis: true });
          y += 14;
        }
        y += 10;
      }
    }

    if (r.tips.length) {
      y = ensure(doc, y, 60 + r.tips.length * 18);
      y = sectionTitle(doc, "Recommended next steps", y);
      r.tips.forEach((tip, i) => {
        doc.circle(PAGE.m + 8, y + 6, 8).fill(C.brand);
        doc.font("B").fontSize(8).fillColor("#ffffff").text(String(i + 1), PAGE.m, y + 2, { width: 16, align: "center" });
        doc.font("R").fontSize(9.5).fillColor(C.ink);
        mixed(doc, tip, PAGE.m + 24, y, { width: W - 24 });
        y = doc.y + 8;
      });
    }

    const note =
      r.source === "mock"
        ? "Note: this listing is not yet connected to Google - figures are sample data."
        : r.source === "cache_fallback"
          ? "Note: live Google data was unavailable; figures come from the last successful sync."
          : "Source: Google Business Profile Performance API.";
    y = ensure(doc, y, 30);
    doc.font("R").fontSize(7.5).fillColor(C.muted).text(note, PAGE.m, y + 10, { width: W });

    /* ---------- footer on every page ---------- */
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // writing inside the bottom margin must not add a page
      doc.moveTo(PAGE.m, PAGE.h - 42).lineTo(PAGE.w - PAGE.m, PAGE.h - 42).lineWidth(0.4).strokeColor(C.line).stroke();
      doc.font("R").fontSize(7.5).fillColor(C.muted)
        .text(`${clean(agency)}  ·  Generated ${new Date(r.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`, PAGE.m, PAGE.h - 34, { width: W / 2, lineBreak: false })
        .text(`Page ${i + 1} of ${range.count}`, PAGE.m + W / 2, PAGE.h - 34, { width: W / 2, align: "right", lineBreak: false });
    }
    doc.end();
  });
}
