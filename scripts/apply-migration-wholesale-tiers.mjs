import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const password = process.env.DB_PASS;
if (!password) {
  console.error("Faltó DB_PASS. Ejecutá así:\n  DB_PASS=tu_password node scripts/apply-migration-wholesale-tiers.mjs");
  process.exit(1);
}

const SQL_FILE = path.resolve(
  process.cwd(),
  "supabase/migrations/20260701000000_product_wholesale_tiers.sql"
);

const client = new Client({
  // Pooler IPv4 (session mode = 5432 — necesario para DDL)
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 5432,
  user: "postgres.qccfsbjshlomvyfabtra",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  console.log("Leyendo", SQL_FILE);
  const sql = await fs.readFile(SQL_FILE, "utf8");
  console.log("Conectando al pooler IPv4 (session mode)…");
  await client.connect();
  console.log("Conectado. Ejecutando migración…\n");
  await client.query(sql);
  console.log("✔ Migración aplicada.\n");

  const r = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'wholesale_tiers'
  `);
  console.log("Columna wholesale_tiers:", r.rows[0] ?? "NO ENCONTRADA");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}
