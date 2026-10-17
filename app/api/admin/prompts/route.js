import { route } from "@/lib/saas/routeKit.js";
import { query } from "@/lib/db";
import { PROMPT_ENTRIES, PROMPT_KEYS } from "@/lib/ai/promptRegistry.js";
import { savePromptOverride, deletePromptOverride, clearPromptCache } from "@/lib/ai/promptStore.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

/** GET -> every editable prompt with its default and the current override. */
export const GET = route({ superAdmin: true }, async () => {
  clearPromptCache();
  const rows = await query("SELECT pkey, content, updated_by, updated_at FROM ai_prompts").catch(() => []);
  const byKey = Object.fromEntries(rows.map((r) => [r.pkey, r]));
  return {
    items: PROMPT_ENTRIES.map((e) => ({
      ...e,
      value: byKey[e.key] ? byKey[e.key].content : e.default,
      overridden: Boolean(byKey[e.key]),
      updated_by: byKey[e.key]?.updated_by || null,
      updated_at: byKey[e.key]?.updated_at || null,
    })),
  };
});

/** PUT { key, content } -> save override · DELETE ?key= -> back to default */
export const PUT = route({ superAdmin: true }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  if (!PROMPT_KEYS.has(b.key)) throw Object.assign(new Error("Unknown prompt"), { status: 400 });
  const content = String(b.content ?? "");
  if (content.length > 20000) throw Object.assign(new Error("Prompt is too long (max 20,000 characters)"), { status: 400 });
  const e = PROMPT_ENTRIES.find((x) => x.key === b.key);
  if (e.kind !== "extra" && !content.trim()) throw Object.assign(new Error("This prompt can't be empty - use Reset to go back to the default"), { status: 400 });
  if (content === e.default) await deletePromptOverride(b.key);
  else await savePromptOverride(b.key, content, ctx.name);
  await audit(ctx, "AI_PROMPT_UPDATED", { entity: "prompt", meta: { key: b.key, chars: content.length } });
  return { key: b.key, overridden: content !== e.default };
});

export const DELETE = route({ superAdmin: true }, async ({ ctx, request }) => {
  const key = new URL(request.url).searchParams.get("key");
  if (!PROMPT_KEYS.has(key)) throw Object.assign(new Error("Unknown prompt"), { status: 400 });
  await deletePromptOverride(key);
  await audit(ctx, "AI_PROMPT_RESET", { entity: "prompt", meta: { key } });
  return { key };
});
