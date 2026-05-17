import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "1751644788535-my801003-1-6bdbef00f36561a9b217528719964331-1024-1024.webp", nice: "mely-lip-oil-display-cover.webp" },
  { local: "SaveClip.App_610612013_17867329971535221_5946686831371073899_n.jpg",         nice: "mely-lip-oil-lifestyle.jpg" },
  { local: "SaveClip.App_610617631_17867329962535221_7608728521992824636_n.jpg",         nice: "mely-lip-oil-4-tonos-fila.jpg" },
];

const variantSpecs = [
  { name: "Tono 01 — Transparente glow",  color_hex: "#F4E4D8", stock: 4 },
  { name: "Tono 02 — Rosa palo",          color_hex: "#E5AFB8", stock: 4 },
  { name: "Tono 03 — Rosa fucsia",        color_hex: "#D2387E", stock: 4 },
  { name: "Tono 04 — Cobre shimmer",      color_hex: "#B07050", stock: 4 },
  { name: "Tono 05 — Cereza",             color_hex: "#C42044", stock: 4 },
  { name: "Tono 06 — Nude shimmer",       color_hex: "#D4A98B", stock: 4 },
];

const payload = {
  name: "Lip Oil con Destellos — Mely Beauty",
  slug: "mely-lip-oil-destellos",
  description:
    "Lip Oil de Mely Beauty — aceite labial con destellos shimmer en frasco mini cute con tapa verde. Hidratación + brillo + un toque de color. Para mujeres libres que aman labios glossy con vibe juicy y un destello sutil. \"Hidratación y brillo para tus labios\" 🌿✨\n\nCaracterísticas:\n\n- 💧 **Lip Oil hidratante** — fórmula tipo aceite que cuida los labios mientras los embellece\n- ✨ **Con destellos shimmer** — partículas brillantes que captan la luz desde cualquier ángulo\n- 🌸 **No pegajoso** — sensación liviana tipo bálsamo\n- 🌿 Diseño verde lima pastel — tendencia matcha vibes\n- 💋 Aplicador integrado tipo doe-foot\n- 🐰 Cruelty Free\n\nDisponible en 6 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Transparente glow (sin color, solo hidratación + destellos)\n- **Tono 02** — Rosa palo (rosa suave natural)\n- **Tono 03** — Rosa fucsia (pink intenso vibrante)\n- **Tono 04** — Cobre shimmer (marrón cálido con shimmer dorado)\n- **Tono 05** — Cereza (rojo cereza glossy)\n- **Tono 06** — Nude shimmer (nude rosado con destellos)\n\nModo de uso: aplicá una capa directo sobre los labios con el aplicador. Para look más jugoso, segunda capa. Funciona también encima de tu labial mate favorito para sumar brillo y destellos.\n\nTip: aplicalo por la noche antes de dormir — los labios amanecen hidratados y suaves.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2800,
  compare_price: 3800,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 15,
  length_cm: 8,
  width_cm: 2,
  height_cm: 2,
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

  const variantReferenceImage = galleryUrls[0];
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock total:", totalStock);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: MAQUILLAJE_CATEGORY_ID,
    is_primary: true,
  }]);

  const variantRows = variantSpecs.map((v) => ({
    product_id: product.id,
    name: v.name,
    attributes: { color_hex: v.color_hex },
    price_diff: 0,
    stock: v.stock,
    image_url: variantReferenceImage,
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
