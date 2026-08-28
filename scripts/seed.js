/**
 * Creates the database, imports db/schema.sql and loads demo data.
 * Run:  npm run db:setup
 * XAMPP must be running (Apache not required, MySQL is).
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

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  console.log("> importing schema...");
  const schema = fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8");
  await conn.query(schema);
  await conn.query(`USE \`${DB}\``);

  console.log("> seeding users...");
  const adminPw = await bcrypt.hash("admin123", 10);
  const empPw = await bcrypt.hash("seo123", 10);
  const [admin] = await conn.query(
    "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
    ["Admin", "admin@hover.in", adminPw, "ADMIN"]
  );
  const employees = [];
  for (const [name, email] of [["Ravi Sharma", "ravi@hover.in"], ["Neha Gupta", "neha@hover.in"]]) {
    const [u] = await conn.query(
      "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
      [name, email, empPw, "EMPLOYEE"]
    );
    const [e] = await conn.query("INSERT INTO employees (user_id,department) VALUES (?,?)", [u.insertId, "GMB/SEO"]);
    employees.push(e.insertId);
  }
  await conn.query("INSERT INTO employees (user_id,department) VALUES (?,?)", [admin.insertId, "Management"]);

  console.log("> seeding clients...");
  const clients = JSON.parse(fs.readFileSync(path.join(root, "db", "seed-data.json"), "utf8"));
  let idx = 0;

  for (const c of clients) {
    const employeeId = employees[idx % employees.length];
    const [res] = await conn.query(
      `INSERT INTO clients
        (business_name,business_category,description,phone,website,address,city,state,country,
         preferred_language,content_tone,posting_frequency,gmb_location_id,gmb_connection_status,
         assigned_employee_id,approved_claims,prohibited_claims)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        c.business_name, c.business_category, c.description, c.phone, c.website, c.address,
        c.city, c.state, "India", "English", c.tone, idx % 3 === 0 ? "DAILY" : "WEEKLY",
        `mock_loc_${1000 + idx}`, "MOCK_CONNECTED", employeeId,
        JSON.stringify([]), JSON.stringify(["free treatment", "100% guaranteed results"]),
      ]
    );
    const clientId = res.insertId;

    await conn.query(
      `INSERT INTO gmb_profiles
        (client_id,location_name,category,address,phone,website,opening_hours,map_url,rating,review_count,connection_status,provider,last_synced_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        clientId, `${c.business_name} - ${c.city}`, c.business_category,
        `${c.address}, ${c.city}, ${c.state}`, c.phone, c.website,
        JSON.stringify({ mon_sat: "10:00 - 19:00", sun: idx % 2 ? "Closed" : "11:00 - 16:00" }),
        `https://maps.google.com/?q=${encodeURIComponent(c.business_name + " " + c.city)}`,
        (4 + Math.random()).toFixed(2), 20 + Math.floor(Math.random() * 300),
        "MOCK_CONNECTED", "mock",
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
        "INSERT INTO keywords (client_id,keyword,kw_type,source,reason,relevance_score,priority,has_volume_data) VALUES (?,?,?,?,?,?,?,0)",
        [clientId, k.toLowerCase(), "PRIMARY", "CLIENT", "Provided by client", 90, "HIGH"]
      );
    }

    // previous published posts (mock) + embeddings for duplicate detection
    let p = 0;
    for (const title of c.posts) {
      const description =
        `${c.business_name} offers ${c.services[p % c.services.length]} for customers in ${c.locations[0]}. ` +
        `Our team focuses on clear guidance and reliable service. Contact us to know more.`;
      const [post] = await conn.query(
        `INSERT INTO gmb_posts (client_id,title,description,cta,post_type,status,provider,is_mock,external_id,published_at)
         VALUES (?,?,?,?,?,?,?,1,?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [clientId, title, description, "Learn More", "Service", "PUBLISHED", "mock", `mock_seed_${clientId}_${p}`, 7 + p * 5]
      );
      const vec = await embedder.embed(`${title}\n${description}`);
      await conn.query(
        `INSERT INTO ai_tasks (client_id,status,post_type,topic,title,description,cta,primary_keyword,
                               secondary_keywords,hashtags,embedding,qa_score,qa_status,published_at,scheduled_date)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(CURDATE(), INTERVAL ? DAY))`,
        [
          clientId, "PUBLISHED", "Service", title, title, description, "Learn More",
          c.keywords[0], JSON.stringify(c.keywords.slice(1, 3)),
          JSON.stringify(["#" + c.business_category.replace(/\W/g, ""), "#" + c.city.replace(/\W/g, "")]),
          JSON.stringify(vec), 90 + (p % 8), "PASS", 7 + p * 5, 7 + p * 5,
        ]
      );
      for (let d = 0; d < 5; d++) {
        await conn.query(
          `INSERT INTO gmb_performance (client_id,post_id,stat_date,views,clicks,calls,direction_requests,is_mock)
           VALUES (?,?,DATE_SUB(CURDATE(), INTERVAL ? DAY),?,?,?,?,1)`,
          [clientId, post.insertId, d, 50 + Math.floor(Math.random() * 200), 5 + Math.floor(Math.random() * 30),
           Math.floor(Math.random() * 12), Math.floor(Math.random() * 15)]
        );
      }
      p++;
    }

    // content calendar: today + next 4 days
    for (let d = 0; d <= 4; d++) {
      const service = c.services[(idx + d) % c.services.length];
      await conn.query(
        "INSERT INTO content_calendar (client_id,scheduled_date,post_type,topic,status,assigned_employee_id) VALUES (?,?,?,?,?,?)",
        [clientId, iso(d), POST_TYPES[(idx + d) % POST_TYPES.length], d % 2 === 0 ? `${service} in ${c.locations[0]}` : null, "SCHEDULED", employeeId]
      );
    }
    idx++;
    console.log(`  + ${c.business_name}`);
  }

  await conn.end();
  console.log("\nDone.");
  console.log("Login: admin@hover.in / admin123   |   ravi@hover.in / seo123");
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
