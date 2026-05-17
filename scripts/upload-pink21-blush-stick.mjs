import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "50fdfb_fdd07fb3b6e443a5946ff4970241ef77~mv2.avif", nice: "pink21-blush-stick-display-cover.avif" },
  { local: "D_NQ_NP_2X_803231-MLA85033399403_052025-F.webp",   nice: "pink21-blush-stick-abierto-rosa.webp" },
  { local: "D_NQ_NP_2X_610571-MLA84818476164_052025-F.webp",   nice: "pink21-blush-stick-zoom-stick.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Love Story",     color_hex: "#E27C8E", stock: 4 },
  { name: "Tono 02 — So Pinky",       color_hex: "#E04A7A", stock: 4 },
  { name: "Tono 03 — Perfect Blush",  color_hex: "#D85F6A", stock: 4 },
  { name: "Tono 04 — Brown Sugar",    color_hex: "#A05A48", stock: 4 },
  { name: "Tono 05 — Deep Kiss",      color_hex: "#8E3038", stock: 4 },
  { name: "Tono 06 — Sunset Blush",   color_hex: "#C95A4C", stock: 4 },
];

const payload = {
  name: "Pink Blush Stick — Pink21 (The New Perfect Blush)",
  slug: "pink21-blush-stick-viral",
  description:
    "Pink Blush Stick de Pink21 — el rubor en barra viral que se hizo cult en TikTok 💕. \"The New Perfect Blush\" en stick súper portátil con tapa marrón nude tipo mini-vaso de café. Para mujeres libres que aman el blush stick — fácil de aplicar, queda glowy y dura todo el día.\n\nCaracterísticas:\n\n- 💗 **Fórmula stick cremosa** — buildable, blendeable, glowy natural\n- 🪄 **Aplicación con la barra directo en la piel** — dibujás 2-3 trazos y difuminás con dedo\n- ✨ Acabado satinado luminoso — no efecto polvo\n- 💎 Frasco marrón nude tipo \"latte\" — pieza preciosa para el tocador\n- 📱 Portátil — entra en cualquier neceser\n- 🐰 Cruelty Free · Aprobado ANMAT\n\nDisponible en 6 tonos con nombres icónicos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01 — Love Story** (rosa romántico clásico)\n- **Tono 02 — So Pinky** (pink intenso vibrante)\n- **Tono 03 — Perfect Blush** (rojo-rosado equilibrado)\n- **Tono 04 — Brown Sugar** (terracota cálido nude)\n- **Tono 05 — Deep Kiss** (vino-rojo profundo)\n- **Tono 06 — Sunset Blush** (coral cálido sunkissed)\n\nModo de uso:\n\n1. Destapá y girá la base del envase para sacar producto.\n2. Aplicá 2-3 trazos cortos en la zona alta del pómulo (\"manzanitas\").\n3. Difuminá con el dedo anular o esponja húmeda en movimientos circulares hacia la sien.\n4. Para más intensidad, capeá un segundo paso.\n\nTip pro: aplicalo también en el puente de la nariz y arco de cejas para efecto sunkissed. O en los labios como tinta — la fórmula stick funciona perfecto multi-uso.\n\nNUEVO Pink21.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 4000,
  compare_price: 5200,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
  length_cm: 7,
  width_cm: 3,
  height_cm: 3,
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

  const variantReferenceImage = galleryUrls[0]; // display con los 6 nombres
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
