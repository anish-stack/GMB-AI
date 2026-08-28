/**
 * Cost tracking helpers.
 * Real per-token pricing depends on the provider/plan, so cost is only
 * calculated when explicitly configured. Otherwise it is stored as NULL
 * instead of an invented number.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.round(String(text).length / 4));
}

export function estimateCost({ inputTokens, outputTokens }) {
  const inRate = Number(process.env.AI_COST_PER_1K_INPUT || 0);
  const outRate = Number(process.env.AI_COST_PER_1K_OUTPUT || 0);
  if (!inRate && !outRate) return null;
  const cost = ((inputTokens || 0) / 1000) * inRate + ((outputTokens || 0) / 1000) * outRate;
  return Number(cost.toFixed(6));
}
