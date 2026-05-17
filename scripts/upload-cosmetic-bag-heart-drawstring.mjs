import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "D_NQ_NP_2X_842507-CBT88088887583_072025-F.webp", nice: "neceser-corazones-rojos-cordon-cover.webp" },
  { local: "D_NQ_NP_2X_959260-CBT88088561617_072025-F.webp", nice: "neceser-corazones-rojos-cordon-lifestyle.webp" },
];

const payload = {
  name: "Neceser Corazones Rojos con Cordón — Cosmetic Storage Bag",
  slug: "neceser-corazones-rojos-cordon",
  description:
    "Neceser con estampa de corazones rojos sobre fondo crema y cierre tipo cordón ajustable (drawstring). Diseño tipo bolsa redonda muy cute, perfecto para llevar el make en la cartera o para tener en el tocador. Estilo japonés/coreano kawaii ❤️.\n\nCaracterísticas:\n\n- ❤️ **Estampa de corazones rojos** sobre fondo crema — color clásico romántico\n- 🎀 **Cierre tipo cordón ajustable** (drawstring) que se ata con moñito\n- 🧶 **Tela de pana suave** (corduroy) tipo terciopelo\n- 📦 Formato cuadrado/redondo que se adapta al contenido\n- 💄 Capacidad ideal para perfumes mini, brochas, labiales, polvos, paletas chicas\n- 🌸 Ideal para regalar — pieza linda de tocador\n\n⚠ Stock muy limitado: 3 unidades disponibles.\n\nTip: también funciona como bolsita de regalo para sorprender, o para guardar accesorios del bolso.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 8000,
  compare_price: 12000,
  stock: 3,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 80,
  length_cm: 18,
  width_cm: 15,
  height_cm: 8,
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

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: ACCESORIOS_CATEGORY_ID,
    is_primary: true,
  }]);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
