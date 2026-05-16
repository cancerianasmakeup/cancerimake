import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID  = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const PARA_NINAS_CATEGORY_ID  = "efc8cc64-7c06-4bbd-b002-c8a8e0385714";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "CS6857.jpg",                                nice: "pink21-strawberry-lipbalm-display-mano.jpg" },
  { local: "d2bb549c-9063-4ed6-b8cf-b56f775086c6.png",  nice: "pink21-strawberry-lipbalm-infografia.png" },
];

const payload = {
  name: "Fresh Collection Lipbalm Frutilla — Pink21",
  slug: "pink21-fresh-collection-lipbalm-frutilla",
  description:
    "Fresh Collection Lipbalm de Pink21 — bálsamo labial con forma de frutilla 🍓, súper cute y aesthetic. Pensado para chicas y mujeres libres que aman lo kawaii y cuidan sus labios todo el día. Entra perfecto en cualquier cartera y queda re lindo en el tocador.\n\nCaracterísticas:\n\n- 💧 **Moisturizing & smooth** — hidrata y suaviza los labios profundamente\n- 🍓 **Strawberry scented** — aroma a frutilla dulce y suave\n- 💖 **Cute & fun on the go** — forma de frutilla, ideal para llevar siempre\n- 🌿 Tapa verde tipo \"hojitas\" con cadenita decorativa\n- 🐰 Cruelty Free\n\nIdeal para regalar a chicas o como detalle aesthetic. Producto destacado de la colección Pink21 Fresh.\n\nModo de uso: abrí la frutilla (la parte verde es la tapa), pasá el bálsamo directo en los labios cuando los sientas resecos. Apto para uso diario, varias veces al día. Reaplicá cuando sientas que necesitás.\n\nDisponible por unidad (color del envase aleatorio rosa, fucsia o rojo según stock).",
  category_id: MAQUILLAJE_CATEGORY_ID, // primary
  price: 1500,
  compare_price: 2000,
  stock: 12,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
  length_cm: 5,
  width_cm: 5,
  height_cm: 5,
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

async function postRest(table, rows, prefer = "return=representation") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`POST ${table} failed (${res.status}): ${await res.text()}`);
  return res.json();
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

  const [product] = await postRest("products", [{ ...payload, images: urls }]);
  console.log("  Product ID:", product.id, " slug:", product.slug);

  await postRest("product_categories", [
    { product_id: product.id, category_id: MAQUILLAJE_CATEGORY_ID, is_primary: true  },
    { product_id: product.id, category_id: PARA_NINAS_CATEGORY_ID, is_primary: false },
  ]);
  console.log("  Categorías: Maquillaje (primary) + Para Niñas");
})().catch((err) => { console.error("Error:", err); process.exit(1); });
