// scripts/provision-store.mjs
// Aplica TODAS las migraciones de supabase/migrations a una base, en orden por
// nombre de archivo, y lleva registro de lo aplicado para poder correrlo las
// veces que haga falta sin repetir nada.
//
// Sirve igual para la base de Buenos Aires y para la de Mar del Plata: lo único
// que cambia son las credenciales.
//
// USO
// ---
//   # ver qué falta aplicar (no toca nada)
//   DB_HOST=aws-0-us-east-1.pooler.supabase.com DB_USER=postgres.<ref> DB_PASS=xxx \
//     node scripts/provision-store.mjs --dry-run
//
//   # aplicar todo lo pendiente
//   DB_HOST=... DB_USER=... DB_PASS=... node scripts/provision-store.mjs
//
//   # base ya montada a mano: marcar todo como aplicado sin ejecutar
//   DB_HOST=... DB_USER=... DB_PASS=... node scripts/provision-store.mjs --baseline
//
// Las variables se pueden dejar fijas en .env.scripts (gitignored).
// DB_PASS es la contraseña de Postgres del proyecto: Supabase → Settings → Database.
// DB_HOST/DB_USER salen de "Connection pooling" (session mode, puerto 5432, que
// es el que soporta DDL).

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import { Client } from "pg";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");
const ENV_FILE = path.resolve(__dirname, "../.env.scripts");

// Mismo cargador que usa scripts/lib/secrets.mjs, replicado acá para que este
// script no dependa de credenciales de Supabase/R2 que no necesita.
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

// Línea suelta del tipo:  ALTER TYPE x ADD VALUE IF NOT EXISTS 'y' BEFORE 'z';
// Anclada a principio de línea, así no matchea las que están comentadas.
const ALTER_ENUM_RE = /^[ \t]*ALTER[ \t]+TYPE[ \t]+[^;]*?ADD[ \t]+VALUE[^;]*;[ \t]*$/gim;

const DRY_RUN = process.argv.includes("--dry-run");
const BASELINE = process.argv.includes("--baseline");

const DB = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME ?? "postgres",
};

const faltantes = ["DB_HOST", "DB_USER", "DB_PASS"].filter((n) => !process.env[n]);
if (faltantes.length) {
  console.error(
    `\nFaltan variables: ${faltantes.join(", ")}\n` +
      `Definilas en .env.scripts o pasalas en la línea de comando.\n` +
      `  DB_HOST=aws-0-<region>.pooler.supabase.com\n` +
      `  DB_USER=postgres.<project-ref>\n` +
      `  DB_PASS=<password de Postgres>\n`
  );
  process.exit(1);
}

const files = (await fsp.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

console.log(`\nPostgres  : ${DB.user}@${DB.host}:${DB.port}`);
console.log(`Migraciones encontradas: ${files.length}`);
if (DRY_RUN) console.log("Modo      : DRY RUN (no ejecuta nada)");
if (BASELINE) console.log("Modo      : BASELINE (marca como aplicadas sin ejecutar)");
console.log();

const client = new Client({
  ...DB,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

let procesadas = 0;
let salteadas = 0;

try {
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const done = new Set(
    (await client.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename)
  );

  for (const file of files) {
    if (done.has(file)) {
      salteadas++;
      console.log(`  ·  ${file}  (ya aplicada)`);
      continue;
    }

    if (DRY_RUN) {
      procesadas++;
      console.log(`  →  ${file}  (pendiente)`);
      continue;
    }

    if (BASELINE) {
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      procesadas++;
      console.log(`  ✎  ${file}  (marcada, no ejecutada)`);
      continue;
    }

    const sql = await fsp.readFile(path.join(MIGRATIONS_DIR, file), "utf8");

    // Postgres no deja USAR un valor de enum en la misma transacción donde se
    // agregó. Varias migraciones agregan un valor y lo usan más abajo, y por eso
    // traían instrucciones para aplicarlas a mano en dos pasos. Acá se hace solo:
    // los ALTER TYPE ... ADD VALUE salen primero, cada uno con autocommit, y
    // recién después va el resto dentro de su transacción.
    const alters = sql.match(ALTER_ENUM_RE) ?? [];
    const resto = sql.replace(ALTER_ENUM_RE, "");

    try {
      for (const alter of alters) {
        await client.query(alter);
      }
      await client.query("BEGIN");
      if (resto.trim()) await client.query(resto);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      procesadas++;
      console.log(`  ✔  ${file}${alters.length ? `  (${alters.length} enum aparte)` : ""}`);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`\n  ✖  ${file}\n     ${e.message}\n`);
      console.error(
        `Se detuvo acá. Las ${procesadas} migraciones anteriores quedaron aplicadas;\n` +
          `arreglá esta y volvé a correr el script: retoma desde donde quedó.\n`
      );
      process.exit(2);
    }
  }

  console.log(
    `\n${DRY_RUN ? "Pendientes" : BASELINE ? "Marcadas" : "Aplicadas"}: ${procesadas}   Ya estaban: ${salteadas}`
  );

  if (!DRY_RUN && !BASELINE && procesadas > 0) {
    const t = await client.query(
      "SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname='public'"
    );
    console.log(`Tablas en public: ${t.rows[0].n}`);
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("Schema cache de PostgREST recargado.");
  }
  console.log();
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}
