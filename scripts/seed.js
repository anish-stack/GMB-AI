/**
 * Creates the database, imports db/schema.sql and loads SaaS demo data:
 *   - platform super admin
 *   - 4 plans + credit packs + coupons + platform settings
 *   - 2 demo tenants (agencies) with owners, staff, clients, calendar and history
 *
 * Run:  npm run db:setup      (XAMPP MySQL must be running)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { MockProvider } from "../lib/ai/providers/mock.js";

const root = process.cwd();
const DB = process.env.DB_NAME || "gmb_ai";
const embedder = new MockProvider();

const POST_TYPES = ["Service", "Educational", "Offer", "Local", "FAQ", "Awareness", "Seasonal", "Promotional"];

function iso(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function periodEnd(cycle = "MONTHLY") {
  const d = new Date();
  if (cycle === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function period() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const PLANS = [
  {
    name: "Free", slug: "free", tagline: "Try the full pipeline on two clients",
    price_monthly: 0, price_yearly: 0, trial_days: 0, sort_order: 1,
    max_clients: 2, max_team_members: 1, max_gmb_profiles: 2, max_posts_month: 10,
    max_scheduled_posts: 10, max_keywords_client: 25, ai_credits_month: 300, credit_rollover: 0,
    f_image_generation: 1, f_bulk_actions: 0, f_advanced_analytics: 0, f_api_access: 0,
    f_white_label: 0, f_google_publish: 0, f_auto_publish: 0, f_priority_support: 0, f_export_reports: 0,
    highlights: ["2 clients", "10 scheduled posts", "300 AI credits", "Mock publishing only"],
  },
  {
    name: "Starter", slug: "starter", tagline: "For a solo SEO running a handful of listings",
    price_monthly: 999, price_yearly: 9990, trial_days: 14, sort_order: 2,
    max_clients: 10, max_team_members: 3, max_gmb_profiles: 10, max_posts_month: 120,
    max_scheduled_posts: 200, max_keywords_client: 100, ai_credits_month: 3000, credit_rollover: 0,
    f_image_generation: 1, f_bulk_actions: 1, f_advanced_analytics: 0, f_api_access: 0,
    f_white_label: 0, f_google_publish: 1, f_auto_publish: 0, f_priority_support: 0, f_export_reports: 1,
    highlights: ["10 clients", "Unlimited scheduling", "3,000 AI credits", "Live Google publishing"],
  },
  {
    name: "Agency", slug: "agency", tagline: "Multiple clients, a team and real reporting",
    price_monthly: 2999, price_yearly: 29990, trial_days: 14, sort_order: 3,
    max_clients: 60, max_team_members: 10, max_gmb_profiles: 60, max_posts_month: 600,
    max_scheduled_posts: 1000, max_keywords_client: 300, ai_credits_month: 12000, credit_rollover: 1,
    f_image_generation: 1, f_bulk_actions: 1, f_advanced_analytics: 1, f_api_access: 1,
    f_white_label: 1, f_google_publish: 1, f_auto_publish: 0, f_priority_support: 1, f_export_reports: 1,
    highlights: ["60 clients", "10 team members", "12,000 AI credits", "White label + API"],
  },
  {
    name: "Enterprise", slug: "enterprise", tagline: "Unlimited scale with priority support",
    price_monthly: 9999, price_yearly: 99990, trial_days: 0, sort_order: 4,
    max_clients: -1, max_team_members: -1, max_gmb_profiles: -1, max_posts_month: -1,
    max_scheduled_posts: -1, max_keywords_client: -1, ai_credits_month: 60000, credit_rollover: 1,
    f_image_generation: 1, f_bulk_actions: 1, f_advanced_analytics: 1, f_api_access: 1,
    f_white_label: 1, f_google_publish: 1, f_auto_publish: 1, f_priority_support: 1, f_export_reports: 1,
    highlights: ["Unlimited clients", "Unlimited team", "60,000 AI credits", "Auto publish"],
  },
];

const PACKS = [
  { name: "Top-up 1K", credits: 1000, price: 399, sort_order: 1 },
  { name: "Top-up 5K", credits: 5000, price: 1699, sort_order: 2 },
  { name: "Top-up 20K", credits: 20000, price: 5999, sort_order: 3 },
];

const TENANTS = [
  {
    name: "Hover Media", slug: "hover-media", city: "Delhi",
    owner: { name: "Rahul Verma", email: "owner@hovermedia.in", password: "owner123" },
    staff: [
      { name: "Ravi Sharma", email: "ravi@hovermedia.in", password: "seo123", role: "MANAGER" },
      { name: "Neha Gupta", email: "neha@hovermedia.in", password: "seo123", role: "MEMBER" },
    ],
    planSlug: "agency", cycle: "MONTHLY", clients: 6,
  },
  {
    name: "Peak Digital", slug: "peak-digital", city: "Noida",
    owner: { name: "Sana Khan", email: "owner@peakdigital.in", password: "owner123" },
    staff: [{ name: "Amit Rao", email: "amit@peakdigital.in", password: "seo123", role: "MEMBER" }],
    planSlug: "starter", cycle: "MONTHLY", clients: 4,
  },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  console.log("> importing schema...");
  await conn.query(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
  await conn.query(`USE \`${DB}\``);

  // ---------- platform settings ----------
  console.log("> platform settings...");
  const settings = {
    platform_name: "GMB AI Cloud",
    support_email: "support@hovermedia.in",
    currency: "INR",
    tax_percent: 18,
    default_trial_days: 14,
    allow_signup: 1,
    default_plan_slug: "free",
    grace_days_past_due: 5,
    invoice_prefix: "INV",
    razorpay_enabled: 0,
    razorpay_key_id: "",
    razorpay_key_secret: "",
    credit_costs: { research: 1, keyword: 1, topic: 1, content: 2, hashtag: 1, qa: 1, recommendation: 1, embedding: 0, image: 5 },
  };
  for (const [k, v] of Object.entries(settings)) {
    await conn.query("INSERT INTO platform_settings (skey, svalue) VALUES (?,?)", [
      k,
      typeof v === "object" ? JSON.stringify(v) : String(v),
    ]);
  }

  // ---------- plans ----------
  console.log("> plans...");
  const planIds = {};
  for (const p of PLANS) {
    const [res] = await conn.query(
      `INSERT INTO plans
        (name,slug,tagline,currency,price_monthly,price_yearly,trial_days,
         max_clients,max_team_members,max_gmb_profiles,max_posts_month,max_scheduled_posts,
         max_keywords_client,ai_credits_month,credit_rollover,
         f_image_generation,f_bulk_actions,f_advanced_analytics,f_api_access,f_white_label,
         f_google_publish,f_auto_publish,f_priority_support,f_export_reports,
         highlights,is_public,is_active,sort_order)
       VALUES (?,?,?,'INR',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,?)`,
      [
        p.name, p.slug, p.tagline, p.price_monthly, p.price_yearly, p.trial_days,
        p.max_clients, p.max_team_members, p.max_gmb_profiles, p.max_posts_month, p.max_scheduled_posts,
        p.max_keywords_client, p.ai_credits_month, p.credit_rollover,
        p.f_image_generation, p.f_bulk_actions, p.f_advanced_analytics, p.f_api_access, p.f_white_label,
        p.f_google_publish, p.f_auto_publish, p.f_priority_support, p.f_export_reports,
        JSON.stringify(p.highlights), p.sort_order,
      ]
    );
    planIds[p.slug] = res.insertId;
  }

  for (const pack of PACKS) {
    await conn.query(
      "INSERT INTO credit_packs (name,credits,price,currency,is_active,sort_order) VALUES (?,?,?,'INR',1,?)",
      [pack.name, pack.credits, pack.price, pack.sort_order]
    );
  }

  await conn.query(
    `INSERT INTO coupons (code,description,discount_type,discount_value,max_redemptions,valid_until,is_active)
     VALUES ('LAUNCH20','20% off the first invoice','PERCENT',20,100,DATE_ADD(CURDATE(), INTERVAL 90 DAY),1),
            ('FLAT500','Flat 500 off any plan','FLAT',500,0,NULL,1)`
  );

  // ---------- super admin ----------
  console.log("> super admin...");
  await conn.query("INSERT INTO users (tenant_id,name,email,password_hash,role) VALUES (NULL,?,?,?,?)", [
    "Platform Admin",
    "superadmin@gmbai.cloud",
    await bcrypt.hash("super123", 10),
    "SUPER_ADMIN",
  ]);

  // ---------- tenants ----------
  const allClients = JSON.parse(fs.readFileSync(path.join(root, "db", "seed-data.json"), "utf8"));
  let clientCursor = 0;

  for (const t of TENANTS) {
    console.log(`> tenant: ${t.name}`);
    const plan = PLANS.find((p) => p.slug === t.planSlug);
    const planId = planIds[t.planSlug];

    const [tRes] = await conn.query(
      `INSERT INTO tenants (name,slug,company_email,phone,city,state,country,status)
       VALUES (?,?,?,?,?,?, 'India','ACTIVE')`,
      [t.name, t.slug, t.owner.email, "+91 98110 00000", t.city, "Delhi"]
    );
    const tenantId = tRes.insertId;

    const [ownerRes] = await conn.query(
      "INSERT INTO users (tenant_id,name,email,password_hash,role) VALUES (?,?,?,?,'OWNER')",
      [tenantId, t.owner.name, t.owner.email, await bcrypt.hash(t.owner.password, 10)]
    );
    await conn.query("UPDATE tenants SET owner_user_id=? WHERE id=?", [ownerRes.insertId, tenantId]);
    const [ownerEmp] = await conn.query(
      "INSERT INTO employees (tenant_id,user_id,department) VALUES (?,?,?)",
      [tenantId, ownerRes.insertId, "Management"]
    );

    const employees = [ownerEmp.insertId];
    for (const s of t.staff) {
      const [u] = await conn.query(
        "INSERT INTO users (tenant_id,name,email,password_hash,role) VALUES (?,?,?,?,?)",
        [tenantId, s.name, s.email, await bcrypt.hash(s.password, 10), s.role]
      );
      const [e] = await conn.query("INSERT INTO employees (tenant_id,user_id,department) VALUES (?,?,?)", [
        tenantId, u.insertId, "GMB/SEO",
      ]);
      employees.push(e.insertId);
    }

    // subscription + wallet
    const price = t.cycle === "YEARLY" ? plan.price_yearly : plan.price_monthly;
    const [subRes] = await conn.query(
      `INSERT INTO subscriptions
        (tenant_id,plan_id,status,billing_cycle,price,currency,current_period_start,current_period_end,overrides)
       VALUES (?,?,'ACTIVE',?,?, 'INR', CURDATE(), ?, '{}')`,
      [tenantId, planId, t.cycle, price, periodEnd(t.cycle)]
    );

    await conn.query(
      "INSERT INTO credit_wallets (tenant_id,plan_credits,purchased_credits,lifetime_granted) VALUES (?,?,?,?)",
      [tenantId, plan.ai_credits_month, 0, plan.ai_credits_month]
    );
    await conn.query(
      `INSERT INTO credit_ledger (tenant_id,delta,bucket,reason,balance_after,note)
       VALUES (?,?,'PLAN','PLAN_ALLOCATION',?,'Initial cycle allocation')`,
      [tenantId, plan.ai_credits_month, plan.ai_credits_month]
    );
    await conn.query(
      "INSERT INTO subscription_events (subscription_id,tenant_id,event,to_plan_id,actor,note) VALUES (?,?,'CREATED',?,'seed','Seeded account')",
      [subRes.insertId, tenantId, planId]
    );

    if (price > 0) {
      const tax = Math.round(price * 0.18 * 100) / 100;
      const [inv] = await conn.query(
        `INSERT INTO invoices (invoice_no,tenant_id,subscription_id,type,subtotal,discount,tax,total,currency,status,period_start,period_end,paid_at)
         VALUES (?,?,?,'SUBSCRIPTION',?,0,?,?, 'INR','PAID',CURDATE(),?,NOW())`,
        [`INV-SEED-${tenantId}`, tenantId, subRes.insertId, price, tax, price + tax, periodEnd(t.cycle)]
      );
      await conn.query(
        "INSERT INTO invoice_items (invoice_id,label,qty,unit_price,amount) VALUES (?,?,1,?,?)",
        [inv.insertId, `${plan.name} plan (${t.cycle.toLowerCase()})`, price, price]
      );
      await conn.query(
        "INSERT INTO payments (tenant_id,invoice_id,amount,currency,gateway,status) VALUES (?,?,?,'INR','MANUAL','SUCCESS')",
        [tenantId, inv.insertId, price + tax]
      );
    }

    // ---------- clients ----------
    let idx = 0;
    let creditsUsed = 0;
    let generated = 0;

    for (let n = 0; n < t.clients; n++) {
      const c = allClients[clientCursor % allClients.length];
      clientCursor++;
      const employeeId = employees[idx % employees.length];

      const [res] = await conn.query(
        `INSERT INTO clients
          (tenant_id,business_name,business_category,description,phone,website,address,city,state,country,
           preferred_language,content_tone,posting_frequency,gmb_location_id,gmb_connection_status,
           assigned_employee_id,approved_claims,prohibited_claims)
         VALUES (?,?,?,?,?,?,?,?,?, 'India','English',?,?,?, 'MOCK_CONNECTED',?,?,?)`,
        [
          tenantId, c.business_name, c.business_category, c.description, c.phone, c.website, c.address,
          c.city, c.state, c.tone, idx % 3 === 0 ? "DAILY" : "WEEKLY",
          `mock_loc_${tenantId}_${1000 + idx}`, employeeId,
          JSON.stringify([]), JSON.stringify(["free treatment", "100% guaranteed results"]),
        ]
      );
      const clientId = res.insertId;

      await conn.query(
        `INSERT INTO gmb_profiles
          (tenant_id,client_id,location_name,category,address,phone,website,opening_hours,map_url,rating,review_count,connection_status,provider,last_synced_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, 'MOCK_CONNECTED','mock',NOW())`,
        [
          tenantId, clientId, `${c.business_name} - ${c.city}`, c.business_category,
          `${c.address}, ${c.city}, ${c.state}`, c.phone, c.website,
          JSON.stringify({ mon_sat: "10:00 - 19:00", sun: idx % 2 ? "Closed" : "11:00 - 16:00" }),
          `https://maps.google.com/?q=${encodeURIComponent(c.business_name + " " + c.city)}`,
          (4 + Math.random()).toFixed(2), 20 + Math.floor(Math.random() * 300),
        ]
      );

      for (const s of c.services) {
        await conn.query("INSERT INTO gmb_services (client_id,name,description) VALUES (?,?,?)", [
          clientId, s, `${s} offered by ${c.business_name}`,
        ]);
      }
      for (const l of c.locations) {
        await conn.query("INSERT INTO target_locations (client_id,name) VALUES (?,?)", [clientId, l]);
      }
      for (const k of c.keywords) {
        await conn.query(
          "INSERT INTO keywords (tenant_id,client_id,keyword,kw_type,source,reason,relevance_score,priority,has_volume_data) VALUES (?,?,?,?,?,?,?,?,0)",
          [tenantId, clientId, k.toLowerCase(), "PRIMARY", "CLIENT", "Provided by client", 90, "HIGH"]
        );
      }

      // published history + embeddings for duplicate detection
      let p = 0;
      for (const title of c.posts) {
        const description =
          `${c.business_name} offers ${c.services[p % c.services.length]} for customers in ${c.locations[0]}. ` +
          `Our team focuses on clear guidance and reliable service. Contact us to know more.`;
        const [post] = await conn.query(
          `INSERT INTO gmb_posts (tenant_id,client_id,title,description,cta,post_type,status,provider,is_mock,external_id,published_at)
           VALUES (?,?,?,?,?,?,'PUBLISHED','mock',1,?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
          [tenantId, clientId, title, description, "Learn More", "Service", `mock_seed_${clientId}_${p}`, 7 + p * 5]
        );
        const vec = await embedder.embed(`${title}\n${description}`);
        const [task] = await conn.query(
          `INSERT INTO ai_tasks (tenant_id,client_id,status,post_type,topic,title,description,cta,primary_keyword,
                                 secondary_keywords,hashtags,embedding,qa_score,qa_status,credits_used,published_at,scheduled_date)
           VALUES (?,?,'PUBLISHED','Service',?,?,?,?,?,?,?,?,?,'PASS',12, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(CURDATE(), INTERVAL ? DAY))`,
          [
            tenantId, clientId, title, title, description, "Learn More",
            c.keywords[0], JSON.stringify(c.keywords.slice(1, 3)),
            JSON.stringify(["#" + c.business_category.replace(/\W/g, ""), "#" + c.city.replace(/\W/g, "")]),
            JSON.stringify(vec), 90 + (p % 8), 7 + p * 5, 7 + p * 5,
          ]
        );
        creditsUsed += 12;
        generated++;

        await conn.query(
          `INSERT INTO ai_executions (tenant_id,task_id,client_id,agent,provider,model,input_tokens,output_tokens,estimated_cost,credits_charged,duration_ms,status,attempt)
           VALUES (?,?,?, 'content','mock','seed',800,320,0.0012,2,1400,'SUCCESS',1)`,
          [tenantId, task.insertId, clientId]
        );

        for (let d = 0; d < 5; d++) {
          await conn.query(
            `INSERT INTO gmb_performance (tenant_id,client_id,post_id,stat_date,views,clicks,calls,direction_requests,is_mock)
             VALUES (?,?,?,DATE_SUB(CURDATE(), INTERVAL ? DAY),?,?,?,?,1)`,
            [tenantId, clientId, post.insertId, d, 50 + Math.floor(Math.random() * 200), 5 + Math.floor(Math.random() * 30),
             Math.floor(Math.random() * 12), Math.floor(Math.random() * 15)]
          );
        }
        p++;
      }

      // calendar: today + next 4 days
      for (let d = 0; d <= 4; d++) {
        const service = c.services[(idx + d) % c.services.length];
        await conn.query(
          "INSERT INTO content_calendar (tenant_id,client_id,scheduled_date,post_type,topic,status,assigned_employee_id) VALUES (?,?,?,?,?, 'SCHEDULED',?)",
          [tenantId, clientId, iso(d), POST_TYPES[(idx + d) % POST_TYPES.length], d % 2 === 0 ? `${service} in ${c.locations[0]}` : null, employeeId]
        );
      }
      idx++;
      console.log(`  + ${c.business_name}`);
    }

    // usage counters + wallet consumption so the dashboards are not empty
    const pr = period();
    for (const [metric, used] of [
      ["posts_generated", generated],
      ["posts_published", generated],
      ["ai_calls", generated],
      ["credits", creditsUsed],
    ]) {
      await conn.query(
        "INSERT INTO usage_counters (tenant_id,period,metric,used) VALUES (?,?,?,?)",
        [tenantId, pr, metric, used]
      );
    }
    await conn.query(
      "UPDATE credit_wallets SET plan_credits = GREATEST(0, plan_credits - ?), lifetime_used = ? WHERE tenant_id=?",
      [creditsUsed, creditsUsed, tenantId]
    );

    await conn.query(
      `INSERT INTO notifications (tenant_id,type,title,body,link)
       VALUES (?, 'INFO','Workspace ready','Demo clients, calendar and history have been seeded.','/dashboard')`,
      [tenantId]
    );
  }

  // Posting plans for every seeded client (2 months, from the 1st of this month).
  await conn.query(`INSERT INTO client_posting_plans (tenant_id,client_id,start_date,duration_months,end_date,posts_per_week,total_posts,status,notes,created_by)
    SELECT c.tenant_id, c.id, DATE_FORMAT(CURDATE(),'%Y-%m-01'), 2, DATE_SUB(DATE_ADD(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL 2 MONTH), INTERVAL 1 DAY), 3, 24, 'ACTIVE', 'Seed plan', 'seed'
      FROM clients c WHERE NOT EXISTS (SELECT 1 FROM client_posting_plans p WHERE p.client_id=c.id)`);

  await conn.end();
  console.log("\nDone.\n");
  console.log("SUPER ADMIN   superadmin@gmbai.cloud / super123      -> /admin");
  console.log("TENANT OWNER  owner@hovermedia.in    / owner123      -> /dashboard  (Agency plan)");
  console.log("TENANT STAFF  ravi@hovermedia.in     / seo123        (Manager)");
  console.log("              neha@hovermedia.in     / seo123        (Member)");
  console.log("TENANT 2      owner@peakdigital.in   / owner123      (Starter plan)");
  console.log("              amit@peakdigital.in    / seo123        (Member)");
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
