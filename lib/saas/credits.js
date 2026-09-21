import { query, one, insert } from "../db.js";
import { QuotaError } from "./constants.js";
import { creditCosts } from "./settings.js";

export async function getWallet(tenantId) {
  let w = await one("SELECT * FROM credit_wallets WHERE tenant_id=?", [tenantId]);
  if (!w) {
    await query(
      "INSERT IGNORE INTO credit_wallets (tenant_id, plan_credits, purchased_credits) VALUES (?,0,0)",
      [tenantId]
    );
    w = await one("SELECT * FROM credit_wallets WHERE tenant_id=?", [tenantId]);
  }
  const plan = Number(w.plan_credits || 0);
  const purchased = Number(w.purchased_credits || 0);
  return {
    ...w,
    plan_credits: plan,
    purchased_credits: purchased,
    balance: plan + purchased,
  };
}

async function ledger(tenantId, delta, bucket, reason, balanceAfter, extra = {}) {
  await insert("credit_ledger", {
    tenant_id: tenantId,
    delta,
    bucket,
    reason,
    ref_type: extra.refType || null,
    ref_id: extra.refId || null,
    balance_after: balanceAfter,
    note: extra.note || null,
  });
}

/** Add credits. bucket PLAN (reset each cycle) or PURCHASED (never expires). */
export async function grantCredits(tenantId, amount, { bucket = "PLAN", reason = "ADMIN_GRANT", note = null, refType = null, refId = null } = {}) {
  const credits = Math.max(0, Math.round(Number(amount) || 0));
  if (!credits) return getWallet(tenantId);
  await getWallet(tenantId);
  const column = bucket === "PURCHASED" ? "purchased_credits" : "plan_credits";
  await query(
    `UPDATE credit_wallets
        SET ${column} = ${column} + ?, lifetime_granted = lifetime_granted + ?
      WHERE tenant_id=?`,
    [credits, credits, tenantId]
  );
  const w = await getWallet(tenantId);
  await ledger(tenantId, credits, bucket, reason, w.balance, { note, refType, refId });
  return w;
}

/** Reset the plan bucket at the start of a billing period (rollover optional). */
export async function resetPlanCredits(tenantId, amount, { rollover = false } = {}) {
  const w = await getWallet(tenantId);
  const carry = rollover ? w.plan_credits : 0;
  const next = Math.max(0, Math.round(Number(amount) || 0)) + carry;
  await query(
    "UPDATE credit_wallets SET plan_credits=?, lifetime_granted=lifetime_granted+? WHERE tenant_id=?",
    [next, Math.max(0, next - carry), tenantId]
  );
  const nw = await getWallet(tenantId);
  await ledger(tenantId, next - w.plan_credits, "PLAN", "PLAN_ALLOCATION", nw.balance, {
    note: rollover ? `Cycle refill (rollover ${carry})` : "Cycle refill",
  });
  return nw;
}

export async function hasCredits(tenantId, amount) {
  const w = await getWallet(tenantId);
  return w.balance >= Math.max(0, Number(amount) || 0);
}

export async function assertCredits(tenantId, amount) {
  const need = Math.max(0, Number(amount) || 0);
  const w = await getWallet(tenantId);
  if (w.balance < need) {
    throw new QuotaError(
      `Not enough AI credits. Needed ${need}, available ${w.balance}. Buy a credit pack or upgrade your plan.`,
      "NO_CREDITS",
      { needed: need, balance: w.balance }
    );
  }
  return w;
}

/** Debit credits, plan bucket first, then purchased. Returns credits actually charged. */
export async function consumeCredits(tenantId, amount, { reason = "AI_TEXT", refType = null, refId = null, note = null } = {}) {
  const need = Math.max(0, Math.round(Number(amount) || 0));
  if (!tenantId || !need) return 0;
  const w = await getWallet(tenantId);
  if (w.balance < need) {
    throw new QuotaError(
      `Not enough AI credits. Needed ${need}, available ${w.balance}.`,
      "NO_CREDITS",
      { needed: need, balance: w.balance }
    );
  }
  const fromPlan = Math.min(w.plan_credits, need);
  const fromPurchased = need - fromPlan;
  await query(
    `UPDATE credit_wallets
        SET plan_credits = plan_credits - ?,
            purchased_credits = purchased_credits - ?,
            lifetime_used = lifetime_used + ?
      WHERE tenant_id=?`,
    [fromPlan, fromPurchased, need, tenantId]
  );
  const nw = await getWallet(tenantId);
  if (fromPlan) await ledger(tenantId, -fromPlan, "PLAN", reason, nw.balance, { refType, refId, note });
  if (fromPurchased) await ledger(tenantId, -fromPurchased, "PURCHASED", reason, nw.balance, { refType, refId, note });
  return need;
}

export async function creditCostFor(unit) {
  const costs = await creditCosts();
  return Number(costs[unit] ?? 1);
}

/** Estimated credits for one complete post generation run. */
export async function estimatePostCost({ withImage = true } = {}) {
  const c = await creditCosts();
  const text = ["research", "keyword", "topic", "content", "hashtag", "qa"].reduce(
    (sum, k) => sum + Number(c[k] || 0),
    0
  );
  return text + (withImage ? Number(c.image || 0) : 0);
}

export async function listLedger(tenantId, limit = 100) {
  return query(
    `SELECT * FROM credit_ledger WHERE tenant_id=? ORDER BY id DESC LIMIT ${Number(limit)}`,
    [tenantId]
  );
}

export async function creditUsageByDay(tenantId, days = 14) {
  return query(
    `SELECT DATE(created_at) AS day, SUM(-delta) AS used
       FROM credit_ledger
      WHERE tenant_id=? AND delta < 0 AND created_at >= DATE_SUB(CURDATE(), INTERVAL ${Number(days)} DAY)
      GROUP BY DATE(created_at) ORDER BY day ASC`,
    [tenantId]
  );
}

/** Debit without throwing - used mid-pipeline so a run is never lost on a rounding edge. */
export async function tryConsume(tenantId, amount, opts = {}) {
  if (!tenantId) return 0;
  try {
    return await consumeCredits(tenantId, amount, opts);
  } catch {
    const w = await getWallet(tenantId);
    if (w.balance <= 0) return 0;
    try {
      return await consumeCredits(tenantId, w.balance, opts);
    } catch {
      return 0;
    }
  }
}
