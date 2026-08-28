import { query, one } from "../db.js";

export async function dashboardStats() {
  const today = new Date().toISOString().slice(0, 10);

  const [counts] = await query(
    `SELECT
       (SELECT COUNT(*) FROM clients WHERE active=1) AS total_clients,
       (SELECT COUNT(*) FROM gmb_profiles) AS total_profiles,
       (SELECT COUNT(*) FROM ai_tasks WHERE DATE(created_at)=?) AS generated_today,
       (SELECT COUNT(*) FROM ai_tasks WHERE status IN ('READY_FOR_REVIEW','NEEDS_REVIEW')) AS awaiting,
       (SELECT COUNT(*) FROM ai_tasks WHERE status='READY_FOR_REVIEW') AS ready,
       (SELECT COUNT(*) FROM ai_tasks WHERE status='NEEDS_REVIEW') AS needs_review,
       (SELECT COUNT(*) FROM ai_tasks WHERE status='REJECTED') AS rejected,
       (SELECT COUNT(*) FROM ai_tasks WHERE status='PUBLISHED') AS published,
       (SELECT COUNT(*) FROM ai_tasks WHERE status='FAILED') AS failed,
       (SELECT COUNT(*) FROM ai_executions WHERE status='FAILED') AS ai_errors,
       (SELECT COUNT(*) FROM ai_executions) AS ai_calls,
       (SELECT ROUND(AVG(qa_score),1) FROM ai_tasks WHERE qa_score IS NOT NULL) AS avg_score,
       (SELECT ROUND(AVG(duration_ms)) FROM ai_executions WHERE status='SUCCESS') AS avg_duration,
       (SELECT ROUND(SUM(estimated_cost),4) FROM ai_executions) AS total_cost`,
    [today]
  );

  const totalDecided = Number(counts.published) + Number(counts.rejected);
  return {
    ...counts,
    ai_success_rate: counts.ai_calls ? Math.round(((counts.ai_calls - counts.ai_errors) / counts.ai_calls) * 100) : 100,
    rejection_rate: totalDecided ? Math.round((counts.rejected / totalDecided) * 100) : 0,
  };
}

export async function statusBreakdown() {
  return query("SELECT status, COUNT(*) AS total FROM ai_tasks GROUP BY status ORDER BY total DESC");
}

export async function agentUsage() {
  return query(
    `SELECT agent, COUNT(*) AS calls,
            SUM(status='FAILED') AS failures,
            ROUND(AVG(duration_ms)) AS avg_ms,
            SUM(COALESCE(input_tokens,0)) AS in_tokens,
            SUM(COALESCE(output_tokens,0)) AS out_tokens,
            ROUND(SUM(COALESCE(estimated_cost,0)),4) AS cost
       FROM ai_executions GROUP BY agent ORDER BY calls DESC`
  );
}

export async function performanceTotals() {
  return one(
    `SELECT COALESCE(SUM(views),0) views, COALESCE(SUM(clicks),0) clicks,
            COALESCE(SUM(calls),0) calls, COALESCE(SUM(direction_requests),0) directions
       FROM gmb_performance`
  );
}

export async function topClients(limit = 8) {
  return query(
    `SELECT c.id, c.business_name, c.city,
            COUNT(t.id) AS tasks,
            SUM(t.status='PUBLISHED') AS published,
            ROUND(AVG(t.qa_score),1) AS avg_score
       FROM clients c LEFT JOIN ai_tasks t ON t.client_id=c.id
      GROUP BY c.id ORDER BY published DESC, tasks DESC LIMIT ${Number(limit)}`
  );
}
