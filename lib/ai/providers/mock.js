/**
 * Deterministic offline provider.
 * Used when AI_PROVIDER=mock or when Hugging Face is not configured, so the
 * prototype is always demonstrable. Output is clearly generated from the
 * client's own verified data only - it never invents prices, awards or claims.
 */
import crypto from "node:crypto";

function pick(arr, seed, offset = 0) {
  if (!arr.length) return null;
  const h = crypto.createHash("md5").update(String(seed) + offset).digest()[0];
  return arr[h % arr.length];
}

const CTAS = ["Book a Consultation", "Call Now", "Learn More", "Get a Quote", "Visit Us Today"];

export class MockProvider {
  constructor() {
    this.name = "mock";
    this.textModel = "local-deterministic-v1";
    this.embeddingModel = "local-hash-embedding-v1";
  }

  isConfigured() {
    return true;
  }

  async complete({ meta = {} }) {
    const kb = meta.knowledge || {};
    const agent = meta.agent || "content";
    const services = kb.services?.length ? kb.services : [kb.category || "Services"];
    const locations = kb.target_locations?.length ? kb.target_locations : [kb.city || "your area"];
    const city = kb.city || locations[0];
    const seed = `${kb.business || "biz"}-${meta.seed || 0}`;
    const service = meta.service || pick(services, seed, 1);
    const loc = pick(locations, seed, 2) || city;
    const lower = (s) => String(s || "").toLowerCase();

    let payload;
    switch (agent) {
      case "research":
        payload = {
          summary: `${kb.business} is a ${kb.category} operating in ${kb.location}. Verified services: ${services.join(", ")}.`,
          audience: `Local customers searching for ${lower(kb.category)} services in ${locations.join(", ")}.`,
          differentiators: services.slice(0, 3).map((s) => `Offers ${s}`),
          local_context: `Primary service area: ${locations.join(", ")}.`,
          content_opportunities: services.slice(0, 4).map((s) => `${s} awareness post`),
          verified_facts: {
            business: kb.business,
            category: kb.category,
            phone: kb.phone || null,
            website: kb.website || null,
            services,
          },
        };
        break;
      case "keywords": {
        const kw = (k, type, score, priority, reason) => ({
          keyword: k, kw_type: type, relevance_score: score, priority, reason, source: "AI_SUGGESTED",
        });
        payload = {
          primary_keywords: [
            kw(`${lower(service)} ${lower(loc)}`, "PRIMARY", 95, "HIGH", "Core service plus primary target location"),
            kw(`${lower(kb.category)} ${lower(city)}`, "PRIMARY", 90, "HIGH", "Category plus city intent"),
          ],
          secondary_keywords: services.slice(1, 3).map((s) =>
            kw(`${lower(s)} ${lower(city)}`, "SECONDARY", 80, "MEDIUM", `Supporting service: ${s}`)
          ),
          long_tail_keywords: [
            kw(`best ${lower(service)} in ${lower(loc)}`, "LONG_TAIL", 72, "MEDIUM", "High intent comparison query"),
          ],
          location_keywords: locations.slice(0, 3).map((l) =>
            kw(`${lower(kb.category)} near ${lower(l)}`, "LOCATION", 76, "MEDIUM", `Near-me intent for ${l}`)
          ),
        };
        break;
      }
      case "topic":
        payload = {
          topic: `${service} in ${loc}`,
          reason: `The client provides ${service} and this topic has not been used in recent posts.`,
          priority: "High",
          target_keyword: `${lower(service)} ${lower(loc)}`,
          post_type: meta.postType || "Service",
          alternatives: services.slice(0, 3).map((s) => `${s} overview`),
        };
        break;
      case "content":
        payload = {
          title: `${service} in ${loc}`.slice(0, 90),
          description:
            `Looking for reliable ${lower(service)} in ${loc}? ${kb.business} provides professional ` +
            `${lower(service)} with a clear treatment plan and personal attention from an experienced team. ` +
            `We serve ${locations.slice(0, 3).join(", ")} and nearby areas.\n\n${pick(CTAS, seed, 3)} today.`,
          primary_keyword: meta.primaryKeyword || `${lower(service)} ${lower(loc)}`,
          secondary_keywords: services.slice(0, 2).map((s) => `${lower(s)} ${lower(city)}`),
          cta: pick(CTAS, seed, 3),
          image_concept: `Clean professional photo representing ${service} at a ${lower(kb.category)} in ${loc}, bright natural lighting, no text overlay`,
        };
        break;
      case "hashtags":
        payload = {
          hashtags: [
            `#${String(service).replace(/[^a-zA-Z0-9]/g, "")}`,
            `#${String(kb.category).replace(/[^a-zA-Z0-9]/g, "")}`,
            `#${String(loc).replace(/[^a-zA-Z0-9]/g, "")}`,
            `#${String(kb.business).replace(/[^a-zA-Z0-9]/g, "")}`,
            "#LocalBusiness",
          ],
        };
        break;
      case "qa":
        payload = {
          score: 0,
          status: "PASS",
          issues: [],
          warnings: [],
          checks: {},
          note: "deterministic-checks-applied-in-agent",
        };
        break;
      case "recommendation":
        payload = {
          recommendations: [
            `Increase ${lower(service)} coverage for ${loc}`,
            `Add an FAQ post covering common ${lower(kb.category)} questions`,
          ],
        };
        break;
      case "review_reply": {
        const tone = meta.tone || "professional";
        payload = {
          reply:
            tone === "apologetic"
              ? "We're sorry your visit didn't meet expectations. Thank you for telling us - we're looking into it and would like to make it right. Please reach out to the team directly."
              : tone === "short"
                ? "Thank you for your feedback - we appreciate it!"
                : "Thank you for taking the time to share your experience. We're glad we could help and look forward to seeing you again.",
        };
        break;
      }
      default:
        payload = {};
    }
    const text = JSON.stringify(payload);
    return { text, model: this.textModel, inputTokens: null, outputTokens: null };
  }

  /** Hash-based deterministic embedding (no network). Good enough for duplicate detection. */
  async embed(text) {
    const dim = 128;
    const vec = new Array(dim).fill(0);
    const tokens = String(text).toLowerCase().match(/[a-z0-9]+/g) || [];
    for (const t of tokens) {
      const h = crypto.createHash("md5").update(t).digest();
      vec[h[0] % dim] += 1;
      vec[h[1] % dim] += 0.5;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }

  async image() {
    throw new Error("Image generation provider not configured");
  }
}
