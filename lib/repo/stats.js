import { query, one } from "../db.js";

function t(tenantId, alias = "") {
  const p = alias ? `${alias}.` : "";
  return tenantId ? ` AND ${p}tenant_id=${Number(tenantId)}` : "";
}

export async function dashboardStats(tenantId = null) {
  const today = new Date().toISOString().slice(0, 10);
  const s = (alias = "") => t(tenantId, alias);

  const [counts] = await query(
    `SELECT
       (SELECT COUNT(*) FROM clients WHERE active=1${s()}) AS total_clients,
       (SELECT COUNT(*) FROM gmb_profiles WHERE 1=1${s()}) AS total_profiles,
       (SELECT COUNT(*) FROM ai_tasks WHERE DATE(created_at)=?${s()}) AS generated_today,
       (SELECT COUNT(*) FROM ai_tasks WHERE status IN ('READY_FOR_REVIEW','NEEDS_REVIEW')${s()}) AS awaiting,
       (SELECT COUNT(*) FROM ai_tasks WHERE status='READY_FOR_REVIEW'${s()}) AS ready,
       (SELECT COUNT(*) FROM ai_tasks WHERE status='NEEDS_REVIEW'${s()}) AS needs_review,
       (SELECT COUNT(*) FROM ai_tasks WHERE status='REJECTED'${s()}) AS rejected,
       (SELECT COUNT(*) FROM ai_tasks WHERE status='PUBLISHED'${s()}) AS published,
       (SELECT COUNT(*) FROM ai_tasks WHERE status='FAILED'${s()}) AS failed,
       (SELECT COUNT(*) FROM ai_executions WHERE status='FAILED'${s()}) AS ai_errors,
       (SELECT COUNT(*) FROM ai_executions WHERE 1=1${s()}) AS ai_calls,
       (SELECT ROUND(AVG(qa_score),1) FROM ai_tasks WHERE qa_score IS NOT NULL${s()}) AS avg_score,
       (SELECT ROUND(AVG(duration_ms)) FROM ai_executions WHERE status='SUCCESS'${s()}) AS avg_duration,
       (SELECT ROUND(SUM(estimated_cost),4) FROM ai_executions WHERE 1=1${s()}) AS total_cost,
       (SELECT COALESCE(SUM(credits_charged),0) FROM ai_executions WHERE 1=1${s()}) AS credits_used`,
    [today]
  );

  const totalDecided = Number(counts.published) + Number(counts.rejected);
  return {
    ...counts,
    ai_success_rate: counts.ai_calls ? Math.round(((counts.ai_calls - counts.ai_errors) / counts.ai_calls) * 100) : 100,
    rejection_rate: totalDecided ? Math.round((counts.rejected / totalDecided) * 100) : 0,
  };
}

export async function statusBreakdown(tenantId = null) {
  return query(
    `SELECT status, COUNT(*) AS total FROM ai_tasks WHERE 1=1${t(tenantId)} GROUP BY status ORDER BY total DESC`
  );
}

export async function dailyTaskTrend(days = 7, tenantId = null) {
  return query(
    `SELECT DATE(created_at) AS day,
            COUNT(*) AS generated,
            SUM(status='PUBLISHED') AS published,
            SUM(status='REJECTED') AS rejected
       FROM ai_tasks
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${Number(days) - 1} DAY)${t(tenantId)}
      GROUP BY DATE(created_at)
      ORDER BY day ASC`
  );
}

export async function agentUsage(tenantId = null) {
  return query(
    `SELECT agent, COUNT(*) AS calls,
            SUM(status='FAILED') AS failures,
            ROUND(AVG(duration_ms)) AS avg_ms,
            SUM(COALESCE(input_tokens,0)) AS in_tokens,
            SUM(COALESCE(output_tokens,0)) AS out_tokens,
            SUM(COALESCE(credits_charged,0)) AS credits,
            ROUND(SUM(COALESCE(estimated_cost,0)),4) AS cost
       FROM ai_executions WHERE 1=1${t(tenantId)} GROUP BY agent ORDER BY calls DESC`
  );
}

export async function performanceTotals(tenantId = null) {
  return one(
    `SELECT COALESCE(SUM(views),0) views, COALESCE(SUM(clicks),0) clicks,
            COALESCE(SUM(calls),0) calls, COALESCE(SUM(direction_requests),0) directions
       FROM gmb_performance WHERE 1=1${t(tenantId)}`
  );
}

export async function topClients(limit = 8, tenantId = null) {
  return query(
    `SELECT c.id, c.business_name, c.city,
            COUNT(t.id) AS tasks,
            SUM(t.status='PUBLISHED') AS published,
            ROUND(AVG(t.qa_score),1) AS avg_score
       FROM clients c LEFT JOIN ai_tasks t ON t.client_id=c.id
      WHERE 1=1${tenantId ? ` AND c.tenant_id=${Number(tenantId)}` : ""}
      GROUP BY c.id ORDER BY published DESC, tasks DESC LIMIT ${Number(limit)}`
  );
}
