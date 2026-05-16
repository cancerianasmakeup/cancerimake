import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

const productImages = [
  { local: "D_NQ_NP_2X_906363-MLA99862369195_112025-F.webp", nice: "mely-body-butter-collage.webp" },
  { local: "D_NQ_NP_2X_679684-MLA99379264820_112025-F.webp", nice: "mely-body-butter-variantes.webp" },
  { local: "D_NQ_NP_2X_938617-MLA91428395922_092025-F.webp", nice: "mely-body-butter-apilado.webp" },
];

const payload = {
  name: "Body Butter Mely Skincare 110 g",
  slug: "body-butter-mely-skincare-110gr",
  description:
    "Body Butter Mely Skincare 110 g — la manteca corporal hidratante y nutritiva que está volando del shop. Textura cremosa tipo merengue que se absorbe rápido y deja la piel suave, perfumada y muy hidratada. Para mujeres libres que cuidan su piel y disfrutan del ritual.\n\nIngrediente clave: hialuronato de sodio, que retiene la humedad en la piel y ayuda a mantenerla suave, elástica y flexible durante todo el día.\n\nDisponible en 3 aromas (elegí tu favorito al agregar al carrito):\n\n- 🌹 Rosas — clásico floral, suave y romántico\n- 🥥 Manteca de Karité — el más nutritivo, sin perfume fuerte, ideal para pieles sensibles\n- 🍇 Frambuesa — frutal-dulce, fresco, ideal para verano\n\nModo de uso: aplicá una porción sobre la piel limpia después de la ducha o cuando la sientas seca. Masajeá hasta absorber. Se puede usar todos los días.\n\nContenido neto: 110 g por pote. Frasco transparente con tapa de color (cambia según el aroma).",
  category_id: SKINCARE_CATEGORY_ID,
  price: 8000,
  compare_price: 10500,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 180,
  length_cm: 8,
  width_cm: 8,
  height_cm: 6,
};

const variants = [
  { name: "Rosas",             color_hex: "#FFC0CB", stock: 2 },
  { name: "Manteca de Karité", color_hex: "#A8DD9D", stock: 0 },
  { name: "Frambuesa",         color_hex: "#C8A2D8", stock: 2 },
];

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

  const imageUrls = [];
  for (const f of productImages) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2:", url);
    imageUrls.push(url);
  }

  const totalStock = variants.reduce((s, v) => s + v.stock, 0);
  console.log(`  Stock total (suma variantes): ${totalStock}`);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: imageUrls,
  }]);
  console.log("  Product ID:", product.id);

  const variantRows = variants.map((v) => ({
    product_id: product.id,
    name: v.name,
    attributes: { color_hex: v.color_hex },
    price_diff: 0,
    stock: v.stock,
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
