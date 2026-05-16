import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const SAPHIRUS_CATEGORY_ID = "59f56e54-33fd-4ee8-91b0-e2855411c92b";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "D_NQ_NP_2X_938207-MLA108947721183_032026-F.webp", nice: "vvlove-royal-sweety-peonies-cover.webp" },
  { local: "D_NQ_NP_2X_942999-MLA108167529084_032026-F.webp", nice: "vvlove-royal-sweety-magenta-frasco.webp" },
  { local: "D_NQ_NP_2X_879689-MLA108167739204_032026-F.webp", nice: "vvlove-royal-sweety-marble-lifestyle.webp" },
];

const payload = {
  name: "Royal Sweety Pour Femme — Body Mist V.V.LOVE (250 ml)",
  slug: "vvlove-royal-sweety-body-mist-250ml",
  description:
    "Royal Sweety Pour Femme de V.V.LOVE — un body mist floral dulce con vibra romántica y femenina, presentado en frasco con rayas verticales y tapa fucsia. Para mujeres libres que aman las fragancias \"pour femme\" tipo clásico con un giro moderno.\n\nFamilia olfativa: floral dulce — pétalos rosados con un fondo suave y femenino. Ideal para uso diario, looks de día y como base para combinar con tu perfume principal.\n\nCaracterísticas:\n\n- 🌸 Familia floral dulce — pétalos rosados, fondo suave\n- 💗 Frasco con rayas plateadas y tapa fucsia metalizada\n- 🌟 Fórmula body mist (fragrance mist / brume parfumée) — ligera y refrescante\n- 💎 250 ml / 8.4 fl.oz — rendidor para uso diario\n- ✨ Versátil: piel, ropa o cabello\n- 💫 Estela suave y prolongada\n- 🐰 Cruelty Free\n\nModo de uso: rociá a 15-20 cm de la piel sobre puntos de pulso (cuello, muñecas, escote). También funciona perfecto sobre el cabello para fijar el aroma toda la jornada. Tip: aplicalo después del baño sobre la piel todavía tibia — la fragancia se fija mejor y dura más.\n\nFormato 250 ml con vaporizador. Pieza de colección — ya casi no se consigue en Argentina.",
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
