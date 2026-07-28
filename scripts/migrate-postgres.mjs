import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run PostgreSQL migrations.");
}

const migrationPath = resolve(
  process.cwd(),
  "db/migrations/0001_agentscope_trace.sql",
);
const sql = await readFile(migrationPath, "utf8");
const pool = new pg.Pool({ connectionString, max: 1 });

try {
  await pool.query(sql);
  console.log("Applied AgentScope migration 0001_agentscope_trace.");
} finally {
  await pool.end();
}
