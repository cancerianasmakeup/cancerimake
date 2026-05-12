import { Client } from "pg";

const password = process.env.DB_PASS;
if (!password) {
  console.error("DB_PASS env var required");
  process.exit(1);
}

const client = new Client({
  host: "db.qccfsbjshlomvyfabtra.supabase.co",
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  const v = await client.query("SELECT current_database() AS db, current_user AS usr, version()");
  console.log("CONNECT OK", v.rows[0]);

  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  );
  console.log("\nTABLES IN public (" + tables.rows.length + "):");
  tables.rows.forEach((r) => console.log("  - " + r.tablename));

  const fns = await client.query(
    "SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY proname"
  );
  console.log("\nFUNCTIONS IN public (" + fns.rows.length + "):");
  fns.rows.forEach((r) => console.log("  - " + r.proname));
} catch (e) {
  console.error("ERROR:", e.message);
  console.error("Code:", e.code, "| Errno:", e.errno);
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}
