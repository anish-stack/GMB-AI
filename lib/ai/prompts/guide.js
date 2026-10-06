/**
 * Shared "how to think" guide for every GBP content agent.
 * One source of truth, so every agent reasons the same way.
 *
 * Exports:
 *   seasonContext(date?)  - current month plus festival and weather themes
 *   BANNED_WORDS          - single words never to use
 *   STOCK_PHRASES         - cliche phrases never to use
 *   CLICHES               - BANNED_WORDS + STOCK_PHRASES (kept for older imports)
 *   GBP_RULES             - hard Google Business Profile constraints
 *   WRITING_RULES         - voice and style rules
 *   SEARCH_INTENT         - intent lenses
 */

const TIME_ZONE = "Asia/Kolkata";

// festivals: dates move each year, so these stay month-level and are only hints.
// weather: what actually hits homes, vehicles and shops in North India that month.
const SEASONS = {
  0: {
    festivals: "New Year, Lohri, Makar Sankranti, Pongal, Republic Day",
    weather: "cold wave, dense fog, heavy geyser and heater use",
  },
  1: {
    festivals: "Basant Panchami, Valentine's week, board exam season",
    weather: "late winter, mild days, first thoughts of summer servicing",
  },
  2: {
    festivals: "Holi, financial-year end",
    weather: "warming up, AC servicing season starts, dust and pollen",
  },
  3: {
    festivals: "new financial year, Chaitra Navratri, Baisakhi, Ram Navami",
    weather: "summer heat builds, AC and cooler load, rising power use",
  },
  4: {
    festivals: "school vacations, wedding dates",
    weather: "peak heat, loo winds, AC breakdowns, water shortage",
  },
  5: {
    festivals: "school reopening",
    weather: "extreme heat, then pre-monsoon storms and power cuts",
  },
  6: {
    festivals: "monsoon season",
    weather: "monsoon, seepage, waterlogging, damp, electrical faults",
  },
  7: {
    festivals: "Independence Day, Raksha Bandhan, Janmashtami",
    weather: "heavy monsoon, humidity, leaks, rust and mould",
  },
  8: {
    festivals: "Ganesh Chaturthi, Onam, Pitru Paksha",
    weather: "monsoon tapering off, humid, post-rain repairs",
  },
  9: {
    festivals: "Navratri, Dussehra, Karwa Chauth, pre-Diwali cleaning",
    weather: "dry and warm days, cooler nights, start of smog season",
  },
  10: {
    festivals: "Diwali, Dhanteras, Bhai Dooj, Chhath, wedding season",
    weather: "early winter, smog and poor air quality, heaters come out",
  },
  11: {
    festivals: "wedding season, Christmas, year-end",
    weather: "cold, fog, geyser and heater load, closed windows",
  },
};

/** Month index (0-11) and year in India time, regardless of server timezone. */
function indiaMonthYear(date) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { month: get("month") - 1, year: get("year") };
}

export function seasonContext(date = new Date()) {
  const { month, year } = indiaMonthYear(date);
  const monthName = new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    month: "long",
  }).format(date);
  const s = SEASONS[month];
  return `CURRENT SEASON
Month: ${monthName} ${year}.
Weather and conditions: ${s.weather}.
Festival and calendar themes: ${s.festivals}.
Use these only when they fit the business and the topic. Weather is usually the stronger hook for a trade or service business. Never invent a festival offer, discount or event.`;
}

export const BANNED_WORDS = [
  "testament", "delve", "navigating", "elevate", "bespoke", "realm", "tapestry",
  "crucial", "paramount", "beacon", "seamless", "comprehensive", "tailored",
  "unparalleled", "unlock", "embark", "journey", "game-changer",
];

export const STOCK_PHRASES = [
  "look no further", "in today's fast-paced world", "in today's world", "one-stop solution",
  "one stop shop", "we've got you covered", "second to none", "state-of-the-art",
  "cutting-edge", "world-class", "top-notch", "hassle-free experience",
  "your satisfaction is our priority", "don't miss out", "don't hesitate to",
  "we pride ourselves", "whether you need", "in summary", "in conclusion",
];

export const CLICHES = [...BANNED_WORDS, ...STOCK_PHRASES];

export const GBP_RULES = `GOOGLE BUSINESS PROFILE RULES (hard constraints):
- Post body max 1500 characters. Only the first ~100 characters show before "More", so put the hook there.
- NO phone numbers, NO URLs, NO email addresses in the post text. Google rejects them. The CTA button carries the link.
- NO hashtags. NO emojis.
- Write city, area and locality names in normal capitalisation (Delhi, Gurugram, Sector 99A). Never write them in ALL CAPS. No other ALL-CAPS words.
- No prices, discounts, offers, awards, certifications, years of experience, rankings ("best", "No.1", "top-rated"),
  guarantees, "24/7" or similar availability claims, or medical or result promises UNLESS they appear in "Approved claims".
- Never use anything listed in "Prohibited claims".
- Only mention services from the verified Services list.
- No fake urgency ("only today", "limited slots") and no invented events, festival offers or deadlines.
- Do not claim anything about customers, reviews or past jobs that the approved facts do not state.`;

export const WRITING_RULES = `WRITING QUALITY:
- Write like a local owner talking to a neighbour: concrete, specific, plain words. Contractions are fine.
- One clear idea per post. Answer the searcher's real question: what it is, why it matters, what to do next.
- Prefer a specific detail (a symptom, a season, a real area, a typical situation) over a general statement.
- Mention the locality or city once, the way a person would ("customers around Sector 99A"), not "best plumber Gurugram Gurugram".
- Primary keyword once in the first two sentences, at most twice in total. Secondary keywords only if they read naturally.
- Mix sentence length. Some sentences are 3-5 words. Others run longer. Vary how sentences begin.
- Do not balance paragraphs evenly. No filler intros, no recap closers.
- No "not just X, but Y" constructions and no lists of three adjectives.
- Banned words: ${BANNED_WORDS.join(", ")}.
- Banned phrases: ${STOCK_PHRASES.join(", ")}.`;

export const SEARCH_INTENT = `SEARCH INTENT LENSES (pick the one that fits the topic):
- Problem-aware: the customer has a symptom or problem and wants to know what to do.
- Comparison: the customer is choosing between options and needs a way to decide.
- Ready-to-act: the customer wants process, what to prepare, how long it takes, how to book.
- Trust: the customer wants to know how the business works and why it is reliable. Use only verified facts.
Name the lens you chose in the "angle" field of your answer.`;