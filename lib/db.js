import pg from "pg";
const { Pool } = pg;

let pool;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 8,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
export async function query(text, params=[]) {
  const started=Date.now();
  const result=await db().query(text, params);
  return { ...result, elapsed: Date.now()-started };
}
