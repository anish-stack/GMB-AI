/** v11.3.1: no "Looking for" opener, no opening hours in post text.  node scripts/test-v11-3-1.mjs */
import { stripTimingsAndOpeners, mentionsHours, startsWithStockOpener, policyFindings } from "../lib/ai/textPolicy.js";
const R = [];
const ok = (n, c, i = "") => R.push([c ? "PASS" : "FAIL", n, String(i).slice(0, 200)]);
const body = "Our team handles laser hair removal, acne treatment and scar care for customers across New Delhi. We start by understanding your skin and explain every option in plain words before any session begins.";
const post = `Looking for reliable skin brightening treatment in Delhi? Many people put it off because they are not sure what to expect.\n\n${body}\n\nReach out to HOK Aesthetics today. Open 10am to 7pm.`;
const out = stripTimingsAndOpeners(post);
ok("removes 'Looking for ...?' opener", !/looking for/i.test(out) && out.startsWith("Many people"), out.slice(0, 60));
ok("removes 'Open 10am to 7pm'", !/10am|7pm|open 10/i.test(out), out.slice(-60));
ok("keeps the rest + paragraphs", out.includes(body) && out.split("\n\n").length === 3 && out.endsWith("Reach out to HOK Aesthetics today."));
for (const t of ["Timings: Mon-Sat 9 to 6.", "We are open daily from 9am.", "Visit us between 10:30 am - 8 pm.", "Open Monday to Saturday.", "Our working hours are 9-6."]) ok(`detects hours: ${t}`, mentionsHours(t));
for (const t of ["We finish most jobs in 2 to 3 days.", "Book a session for 30 minutes.", "Serving Sector 18 to Sector 62 in Noida.", "Results show in 4-6 weeks."]) ok(`keeps normal sentence: ${t}`, !mentionsHours(t));
ok("'Are you looking for' detected", startsWithStockOpener("Are you looking for a dentist in Rohini? We can help."));
ok("short text keeps opener (nothing left otherwise)", stripTimingsAndOpeners("Looking for a dentist? Call us.").startsWith("Looking for"));
const f = policyFindings("x", post);
ok("QA warns about hours + opener", f.warnings.some((w) => /opening hours/.test(w)) && f.warnings.some((w) => /Looking for/.test(w)), JSON.stringify(f.warnings));
// no CTA button on images (v11.3.2)
const { withoutButton, DEFAULT_POSTER_PROMPT } = await import("../lib/images/styles.js");
const old = 'Headline "{{headline}}"\n4. A rounded button at the bottom-left in {{brand_color}} with the text "{{cta}}"\nStyle: clean';
const nb = withoutButton(old);
ok("old/admin prompt: button line removed + no-button rule", !/rounded button|\{\{cta\}\}/.test(nb) && /do NOT draw any button/.test(nb) && nb.includes("Style: clean"), nb);
ok("default poster prompt has no button line", !/rounded button|\{\{cta\}\}/.test(DEFAULT_POSTER_PROMPT));

for (const [s, n, i] of R) console.log(`${s.padEnd(4)}  ${n}${i ? `  [${i}]` : ""}`);
console.log(`\n${R.filter((x) => x[0] === "PASS").length}/${R.length} passed`);
process.exit(R.some((x) => x[0] === "FAIL") ? 1 : 0);
