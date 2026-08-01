import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run PostgreSQL migrations.");
}

const migrationDirectory = resolve(process.cwd(), "db/migrations");
const migrations = (await readdir(migrationDirectory))
  .filter((filename) => /^\d+_.+\.sql$/.test(filename))
  .sort();
const pool = new pg.Pool({ connectionString, max: 1 });

try {
  for (const migration of migrations) {
    const sql = await readFile(resolve(migrationDirectory, migration), "utf8");
    await pool.query(sql);
    console.log(`Applied AgentScope migration ${migration}.`);
  }
} finally {
  await pool.end();
}
