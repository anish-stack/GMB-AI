import { query, one, insert, update } from "../db.js";

export const RESERVED = ["terms", "privacy", "disclaimer", "about", "faq", "support"];
const bad = (m, status = 400) => Object.assign(new Error(m), { status });

export async function listPages({ publishedOnly = false } = {}) {
  try {
    return await query(`SELECT id, slug, title, seo_title, seo_description, status, show_in_footer, sort_order, updated_by, created_at, updated_at FROM cms_pages ${publishedOnly ? "WHERE status='PUBLISHED'" : ""} ORDER BY sort_order, title`);
  } catch {
    return [];
  }
}

export async function footerPages() {
  try {
    return await query("SELECT slug, title FROM cms_pages WHERE status='PUBLISHED' AND show_in_footer=1 ORDER BY sort_order, title");
  } catch {
    return [];
  }
}

export async function getPage(slugOrId, { publishedOnly = true } = {}) {
  const byId = typeof slugOrId === "number";
  try {
    return await one(`SELECT * FROM cms_pages WHERE ${byId ? "id=?" : "slug=?"} ${publishedOnly ? "AND status='PUBLISHED'" : ""}`, [slugOrId]);
  } catch {
    return null;
  }
}

function clean(input) {
  const slug = String(input.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  if (!slug) throw bad("Slug is required.");
  const title = String(input.title || "").trim().slice(0, 200);
  if (!title) throw bad("Title is required.");
  return {
    slug,
    title,
    content: String(input.content || "").slice(0, 200000),
    seo_title: input.seo_title ? String(input.seo_title).slice(0, 200) : null,
    seo_description: input.seo_description ? String(input.seo_description).slice(0, 320) : null,
    status: input.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    show_in_footer: input.show_in_footer ? 1 : 0,
    sort_order: Number(input.sort_order) || 0,
  };
}

export async function savePage(id, input, actor) {
  const data = { ...clean(input), updated_by: actor };
  const dupe = await one("SELECT id FROM cms_pages WHERE slug=? AND id<>?", [data.slug, Number(id) || 0]);
  if (dupe) throw bad("Another page already uses this slug.", 409);
  if (id) {
    await update("cms_pages", Number(id), data);
    return Number(id);
  }
  return insert("cms_pages", data);
}

export async function deletePage(id) {
  const p = await one("SELECT slug FROM cms_pages WHERE id=?", [Number(id)]);
  if (!p) throw bad("Not found", 404);
  if (RESERVED.includes(p.slug)) throw bad("Legal/system pages can be unpublished but not deleted.");
  await query("DELETE FROM cms_pages WHERE id=?", [Number(id)]);
}
