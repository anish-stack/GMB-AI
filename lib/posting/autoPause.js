import "server-only";
import { getSettings, setSettings } from "../saas/settings.js";

/**
 * Admin master switch: pause ALL automatic publishing to Google
 * (calendar auto-post + auto-publish of approved/QA posts) in one click.
 *
 *   autopublish_paused      1 = nothing goes to Google automatically
 *   autopublish_paused_at   when it was paused (ISO)
 *   autopublish_resume_from local "YYYY-MM-DD HH:MM" of the last resume - posts whose time
 *                           fell inside the pause are NOT published on resume (no flood);
 *                           they wait in the review queue for a manual publish.
 * AI writing (nightly job / preparing calendar posts) keeps running while paused.
 */
const TZ = () => process.env.APP_TIMEZONE || "Asia/Kolkata";

export function localStamp(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}

export async function autoPauseState({ fresh = true } = {}) {
  const s = await getSettings({ fresh });
  return {
    paused: Number(s.autopublish_paused || 0) === 1,
    pausedAt: s.autopublish_paused_at || null,
    pausedBy: s.autopublish_paused_by || null,
    resumeFrom: s.autopublish_resume_from || null,
  };
}

export async function setAutoPause(paused, by = null) {
  const patch = paused
    ? { autopublish_paused: 1, autopublish_paused_at: new Date().toISOString(), autopublish_paused_by: by || "" }
    : { autopublish_paused: 0, autopublish_resume_from: localStamp() };
  await setSettings(patch);
  return autoPauseState();
}
