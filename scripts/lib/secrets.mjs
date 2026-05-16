// scripts/lib/secrets.mjs
// Carga secretos desde variables de entorno. Lee también desde un .env.scripts
// local en la raíz del repo (gitignored), para no tener que exportar vars cada vez.
//
// Uso desde otro script:
//   import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
//
// .env.scripts (en la raíz, gitignored) — formato:
//   SUPABASE_SERVICE_ROLE=eyJhbGciOi...
//   R2_ACCESS_KEY_ID=...
//   R2_SECRET_ACCESS_KEY=...

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ENV_FILE = path.resolve(__dirname, "../../.env.scripts");

if (fs.existsSync(ENV_FILE)) {
  const raw = fs.readFileSync(ENV_FILE, "utf8");
  for (const line of raw.split(/\r?\n/)) {
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

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(
      `\nFaltó ${name}.\n` +
        `Definilo en .env.scripts (en la raíz del repo) o exportalo en la shell.\n` +
        `Ejemplo .env.scripts:\n` +
        `  SUPABASE_SERVICE_ROLE=eyJhbGciOi...\n` +
        `  R2_ACCESS_KEY_ID=...\n` +
        `  R2_SECRET_ACCESS_KEY=...\n`
    );
    process.exit(1);
  }
  return v;
}

export const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://qccfsbjshlomvyfabtra.supabase.co";
export const SUPABASE_SERVICE_ROLE = required("SUPABASE_SERVICE_ROLE");

export const R2 = {
  accountId: process.env.R2_ACCOUNT_ID ?? "c80fd3d522f165db46f0eef13f65d471",
  accessKeyId: required("R2_ACCESS_KEY_ID"),
  secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  bucket: process.env.R2_BUCKET ?? "cancerianasmakeup",
  prefix: process.env.R2_PREFIX ?? "CANCERIANAS PRODUCTOS",
  publicBaseUrl:
    process.env.R2_PUBLIC_BASE_URL ??
    "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev",
};
