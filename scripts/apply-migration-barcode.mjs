import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const password = process.env.DB_PASS;
if (!password) {
  console.error("Faltó DB_PASS. Ejecutá así:\n  DB_PASS=tu_password node scripts/apply-migration-barcode.mjs");
  process.exit(1);
}

const SQL_FILE = path.resolve(
  process.cwd(),
  "supabase/migrations/20260806000000_product_barcode.sql"
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
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'barcode'
  `);
  console.log("Columna barcode:", r.rows[0] ?? "NO ENCONTRADA");

  const idx = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'products' AND indexname = 'products_barcode_unique_idx'
  `);
  console.log("Índice único:", idx.rows[0]?.indexname ?? "NO ENCONTRADO");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}
