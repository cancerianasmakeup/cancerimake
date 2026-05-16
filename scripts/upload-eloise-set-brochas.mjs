import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "445a015fa7815be2f1887d32f0847aa7394235e59c4ee32df76b1d06882c376c175389-ec57bbaa904bffe52e17398163036351-480-0.webp", nice: "eloise-brochas-mano-lifestyle.webp" },
  { local: "whatsapp-image-2026-04-09-at-14-42-49-1-ef3f3731c7aca52db217757566425746-1024-1024-b1a19892d6651153fb17785292034815-1024-1024.webp", nice: "eloise-brochas-estuche-cerrado.webp" },
];

const payload = {
  name: "Set 10 Brochas + Estuche — Eloise",
  slug: "eloise-set-10-brochas-estuche",
  description:
    "Set de 10 Brochas Profesionales Eloise — un kit completo para mujeres libres que aman hacer su make en casa sin complicaciones. Incluye estuche rosa pastel tipo cartera con cierre que organiza todas las brochas en un solo lugar — ideal para tocador, viaje o trabajo.\n\nEl set cubre las necesidades clave del rostro y los ojos: base, polvos, rubor, contorno, blending, sombras, delineado, cejas. Mango dorado-rosado tipo \"rose gold\" + cerdas sintéticas tipo pluma rosa que aplican el producto suave y parejo sin desperdiciar.\n\n**Incluye 10 brochas:**\n\n- 1 brocha grande tipo abanico (rubor / polvo / iluminador)\n- 1 brocha grande de polvo / contorno suave\n- 1 brocha tipo difuminadora tapered\n- 2 brochas medianas (base / corrector / blush en crema)\n- 2 brochas pequeñas (sombras / blending de ojos)\n- 1 brocha plana tipo packing (sombra densa)\n- 1 brocha lineal (delineado / detalles)\n- 1 brocha de cejas + spoolie\n\n**Estuche rosa pastel Eloise:**\n\n- 🌸 Tela rosa pastel suave\n- 🔒 Solapa con cierre tipo botón\n- 👜 Bolsillo frontal\n- ✨ Branding Eloise dorado\n\nIdeal para regalar — el packaging es súper presentable y el set rinde para principiantes y para makeup lovers que ya tienen idea. Apto para todo tipo de producto: polvos, cremas y líquidos.\n\nCódigo Eloise: LMN2567882 / LDM266545.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 6000,
  compare_price: 8000,
  stock: 4,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 300,
  length_cm: 22,
  width_cm: 12,
  height_cm: 4,
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
