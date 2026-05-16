import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const SAPHIRUS_CATEGORY_ID = "59f56e54-33fd-4ee8-91b0-e2855411c92b";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "D_NQ_NP_2X_907953-MLU74085540816_012024-F.webp",   nice: "vvlove-blazing-rose-frasco-cover.webp" },
  { local: "D_NQ_NP_2X_952918-MLM107671348103_022026-F.webp", nice: "vvlove-blazing-rose-ficha-tecnica.webp" },
  { local: "D_NQ_NP_2X_682248-MLM106983161618_022026-F.webp", nice: "vvlove-blazing-rose-modelo-aplicando.webp" },
  { local: "D_NQ_NP_2X_777615-MLM107670692469_022026-F.webp", nice: "vvlove-blazing-rose-beneficios.webp" },
  { local: "D_NQ_NP_2X_916128-MLM106983311720_022026-F.webp", nice: "vvlove-blazing-rose-pareja-lifestyle.webp" },
  { local: "D_NQ_NP_2X_730527-MLM106983192118_022026-F.webp", nice: "vvlove-blazing-rose-forma-uso.webp" },
  { local: "D_NQ_NP_2X_618086-MLM106983311846_022026-F.webp", nice: "vvlove-blazing-rose-extra.webp" },
];

const payload = {
  name: "Blazing Rose — Body Mist V.V.LOVE (250 ml)",
  slug: "vvlove-blazing-rose-body-mist-250ml",
  description:
    "Blazing Rose de V.V.LOVE — un body mist floral frutal romántico en frasco iridiscente rosa nacarado con moño dorado, pensado para mujeres libres que aman las fragancias femeninas que dejan estela suave todo el día. Brume parfumée premium con atomizador en spray fino, lindo de tener en el tocador y de fotografiar.\n\nFamilia olfativa: floral frutal romántico.\n\n**Notas olfativas:**\n\n- 🌹 Flores Rosas — el corazón romántico de la fragancia\n- 🍎 Manzana Roja — toque frutal jugoso y luminoso\n\n**Características:**\n\n- 🌟 Bruma perfumada corporal (Fragrance Mist / Brume Parfumée)\n- 💎 Presentación iridiscente 250 ml / 8.4 fl.oz\n- 💨 Atomizador en spray fino\n- 🎀 Detalle elegante: listón dorado\n- 🌸 Uso diario, perfecto para día y noche\n- 🐰 Cruelty Free\n\n**Forma de uso:**\n\n1. **Piel limpia** — aplicalo después de la ducha, sobre piel seca o ligeramente húmeda.\n2. **Distancia correcta** — rociá a 15-20 cm para que la bruma quede uniforme.\n3. **Zonas clave** — cuello, clavículas, muñecas, detrás de las orejas, interior de codos y cabello (en nube ligera).\n4. **No frotes** — dejá secar; frotar rompe las notas.\n5. **Reaplicación** — reaplicá cada 3-5 horas para mantener la estela.\n\nTip: combinalo con tu hidratante corporal sin perfume — la fragancia se fija mejor sobre piel humectada.",
  category_id: SAPHIRUS_CATEGORY_ID,
  price: 10000,
  compare_price: 14000,
  stock: 2,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 320,
  length_cm: 18,
  width_cm: 6,
  height_cm: 6,
};

function sanitizeFileName(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function buildPublicUrl(baseUrl, key) {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${normalizedBase}/${encodedKey}`;
}
function contentTypeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  return "application/octet-stream";
}

async function uploadToR2(client, filepath, niceName) {
  const sanitized = sanitizeFileName(niceName) || "image";
  const key = `${R2.prefix}/${Date.now()}-${sanitized}`;
  const body = await fs.readFile(filepath);
  await client.send(new PutObjectCommand({
    Bucket: R2.bucket, Key: key, Body: body,
    ContentType: contentTypeFor(filepath),
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return buildPublicUrl(R2.publicBaseUrl, key);
}

(async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  });
  console.log(`Procesando: ${payload.name}`);
  const urls = [];
  for (const f of files) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2:", url);
    urls.push(url);
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ ...payload, images: urls }]),
  });
  if (!res.ok) throw new Error(`Insert failed (${res.status}): ${await res.text()}`);
  const inserted = await res.json();
  console.log("  ID:", inserted[0].id, "  slug:", inserted[0].slug);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
