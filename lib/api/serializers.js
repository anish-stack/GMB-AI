export const clientOut = (c) => ({
  id: c.id,
  business_name: c.business_name,
  category: c.business_category,
  city: c.city,
  website: c.website,
  phone: c.phone,
  active: Boolean(c.active),
  gmb_status: c.gmb_connection_status,
  created_at: c.created_at,
});

export const postOut = (t) => ({
  id: t.id,
  client_id: t.client_id,
  status: t.status,
  post_type: t.post_type,
  topic: t.topic,
  title: t.title,
  description: t.description,
  cta: t.cta,
  image_url: t.image_url && !String(t.image_url).startsWith("data:") ? t.image_url : null,
  qa_score: t.qa_score,
  scheduled_date: t.scheduled_date ? String(t.scheduled_date).slice(0, 10) : null,
  published_at: t.published_at,
  created_at: t.created_at,
  source: t.source || "app",
});

export const planOut = (u) =>
  u.plan
    ? {
        state: u.state,
        start_date: u.plan.start_date,
        end_date: u.plan.end_date,
        duration_months: u.plan.duration_months,
        posts_per_week: u.plan.posts_per_week,
        posting_days: u.plan.posting_days,
        total_posts: u.total,
        used: u.used,
        remaining: u.remaining,
        breakdown: u.counts,
        this_week: u.week,
      }
    : { state: "NO_PLAN" };
