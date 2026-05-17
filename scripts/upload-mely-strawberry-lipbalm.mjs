import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const PARA_NINAS_CATEGORY_ID = "efc8cc64-7c06-4bbd-b002-c8a8e0385714";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "1754581436189-my8020111.webp", nice: "mely-strawberry-lipbalm-display-cover.webp" },
];

const variantSpecs = [
  { name: "Rosa claro",   color_hex: "#F4B6C2", stock: 8, file: "1755796327566-my802011-rosaclaro2-jpgweb.webp",  nice: "mely-strawberry-rosa-claro.webp" },
  { name: "Rosa coral",   color_hex: "#E76A8C", stock: 8, file: "}.webp",                                          nice: "mely-strawberry-rosa-coral.webp" },
  { name: "Rojo intenso", color_hex: "#C42044", stock: 8, file: "1755796327023-my802011-rojo2-jpgweb.webp",        nice: "mely-strawberry-rojo.webp" },
];

const payload = {
  name: "Strawberry Lip Balm con Charm — Mely Beauty",
  slug: "mely-strawberry-lip-balm-charm",
  description:
    "Strawberry Lip Balm de Mely Beauty 🍓 — bálsamo labial hidratante con forma de frutilla 3D + charm de conejito coleccionable colgante. Súper cute, súper kawaii. Bálsamo de uso diario para tener los labios suaves todo el día.\n\n¡Uso diario! Ideal para regalar a chicas 🎁\n\nCaracterísticas:\n\n- 🍓 **Forma de frutilla** con hojitas verdes — pieza super coleccionable\n- 🐰 **Charm de conejito** colgante con cadenita — cada packaging viene con un dije distinto\n- 💧 **Bálsamo labial hidratante** — fórmula tipo bálsamo suave\n- 🌸 **Color suave** que se activa al contacto con los labios\n- 💋 Aroma sutil a frutilla\n- 🐰 Cruelty Free\n- 📦 Vienen en blíster individual con ilustración cute\n\nDisponible en 3 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Rosa claro** — rosa pastel suave para uso diario\n- **Rosa coral** — rosa-coral fresco\n- **Rojo intenso** — rojo cereza vibrante\n\nModo de uso: aplicá directo sobre los labios cuando los sientas resecos. Apto para uso diario, varias veces. El charm queda increíble colgado de la mochila, del estuche o de la cartera.\n\nMarca Mely Beauty.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3600,
  compare_price: 4500,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 20,
  length_cm: 6,
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

  const galleryUrls = [];
  for (const f of galleryImages) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2 galería:", url);
    galleryUrls.push(url);
  }

  const variantUrls = [];
  for (const v of variantSpecs) {
    const full = path.join(downloadsDir, v.file);
    const url = await uploadToR2(client, full, v.nice);
    console.log(`  R2 ${v.name}:`, url);
    variantUrls.push(url);
  }

  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: [...galleryUrls, ...variantUrls], // incluir variantes en la galería principal
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock total:", totalStock);

  await postRest("product_categories", [
    { product_id: product.id, category_id: MAQUILLAJE_CATEGORY_ID, is_primary: true  },
    { product_id: product.id, category_id: PARA_NINAS_CATEGORY_ID, is_primary: false },
  ]);
  console.log("  Categorías: Maquillaje (primary) + Para Niñas");

  const variantRows = variantSpecs.map((v, i) => ({
    product_id: product.id,
    name: v.name,
    attributes: { color_hex: v.color_hex },
    price_diff: 0,
    stock: v.stock,
    image_url: variantUrls[i],
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
