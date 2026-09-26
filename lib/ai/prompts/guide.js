/**
 * Shared "how to think" guide for every GBP content agent.
 * One source of truth, so every agent reasons the same way.
 */

const SEASONS = {
  0: "New Year, Makar Sankranti / Lohri / Pongal, Republic Day, winter",
  1: "Valentine's week, exam season, late winter",
  2: "Holi, financial-year end, early summer",
  3: "new financial year, Navratri (Chaitra), Baisakhi, summer heat",
  4: "peak summer, school vacations",
  5: "monsoon arrival, school reopening",
  6: "monsoon, rainy-season care",
  7: "Independence Day, Raksha Bandhan, Janmashtami, monsoon",
  8: "Ganesh Chaturthi, Onam, end of monsoon",
  9: "Navratri, Dussehra, festive shopping, pre-Diwali cleaning",
  10: "Diwali, Bhai Dooj, Chhath, wedding season, early winter",
  11: "wedding season, Christmas, year-end, winter",
};

export function seasonContext(date = new Date()) {
  const month = date.toLocaleString("en-IN", { month: "long" });
  return `Current month: ${month} ${date.getFullYear()}. Seasonal themes that MAY be relevant (only if they fit the business naturally; never invent a festival offer): ${SEASONS[date.getMonth()]}.`;
}

export const CLICHES = [
  "look no further", "in today's fast-paced world", "unlock", "elevate your", "one-stop solution",
  "one stop shop", "we've got you covered", "second to none", "state-of-the-art", "cutting-edge",
  "world-class", "top-notch", "delve", "embark", "journey", "seamless", "game-changer",
  "hassle-free experience", "your satisfaction is our priority", "don't miss out",
];

export const GBP_RULES = `GOOGLE BUSINESS PROFILE RULES (hard constraints):
- Post body max 1500 characters. Only the first ~100 characters show before "More" - put the hook there.
- NO phone numbers, NO URLs, NO email addresses in the post text (Google rejects them; the CTA button carries the link).
- No ALL-CAPS words for emphasis, no more than 1 emoji, no hashtags inside the body.
- No prices, discounts, offers, awards, certifications, years of experience, rankings ("best", "No.1"),
  guarantees or medical/result promises UNLESS they appear in "Approved claims".
- Never use anything listed in "Prohibited claims".
- Only mention services from the verified Services list.`;

export const WRITING_RULES = `WRITING QUALITY:
- Write like a local owner talking to a neighbour: concrete, specific, plain words.
- One clear idea per post. Answer the searcher's real question (what, why it matters, what to do next).
- Mention the locality/city once, naturally - the way a person would ("patients in Indirapuram"), not "best dentist Ghaziabad Ghaziabad".
- Primary keyword once in the first two sentences, at most twice total. Secondary keywords only if they read naturally.
- Short sentences. Vary sentence openings. No filler intros.
- Banned clichés: ${CLICHES.join(", ")}.`;

export const SEARCH_INTENT = `SEARCH INTENT LENSES (pick the one that fits the topic):
- Problem-aware: customer has a symptom/problem and wants to know what to do.
- Comparison: customer is choosing between options and needs a way to decide.
- Ready-to-act: customer wants availability, process, what to bring, how long it takes.
- Trust: customer wants to know how the business works and why it is reliable (use only verified facts).`;
