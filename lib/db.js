import mysql from "mysql2/promise";

// Single pool shared across hot-reloads in dev
const globalForDb = globalThis;

function createPool() {
  return mysql.createPool({
    host: "127.0.0.1",
    port: 3306,
    user: "gmb_ai_user",
    password: "YOUR_PASSWORD",
    database: "gmb_ai",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: ["DATE"],
    charset: "utf8mb4_unicode_ci",
  });
}

export const pool = globalForDb.__gmbPool || createPool();
if (!globalForDb.__gmbPool) globalForDb.__gmbPool = pool;

/** Run a query, return rows array */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Run a query, return first row or null */
export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/** INSERT helper -> returns insertId */
export async function insert(table, data) {
  const keys = Object.keys(data);
  const sql = `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(",")})
               VALUES (${keys.map(() => "?").join(",")})`;
  const [res] = await pool.execute(sql, keys.map((k) => normalize(data[k], k)));
  return res.insertId;
}

/** UPDATE helper by id */
export async function update(table, id, data) {
  const keys = Object.keys(data);
  if (!keys.length) return 0;
  const sql = `UPDATE \`${table}\` SET ${keys.map((k) => `\`${k}\`=?`).join(",")} WHERE id=?`;
  const [res] = await pool.execute(sql, [...keys.map((k) => normalize(data[k], k)), id]);
  return res.affectedRows;
}

/**
 * MySQL closes the connection (write ECONNRESET) when a single statement is
 * larger than max_allowed_packet - 1 MB by default in XAMPP. Fail loudly with a
 * useful message instead of losing the connection mid-pipeline.
 */
const MAX_VALUE_BYTES = Number(process.env.DB_MAX_VALUE_BYTES || 900000);

function normalize(v, key = "value") {
  if (v === undefined) return null;
  if (v instanceof Date) return v;
  if (Array.isArray(v) || (v && typeof v === "object")) v = JSON.stringify(v);
  if (typeof v === "string" && Buffer.byteLength(v) > MAX_VALUE_BYTES) {
    throw new Error(
      `Column "${key}" is ${Math.round(Buffer.byteLength(v) / 1024)} KB, over the ${Math.round(
        MAX_VALUE_BYTES / 1024
      )} KB limit. Store large files on disk and save a URL, or raise max_allowed_packet in my.ini.`
    );
  }
  return v;
}

/** Safe JSON parse for TEXT columns */
export function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
