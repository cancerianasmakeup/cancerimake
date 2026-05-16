import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "1-2025-09-01t193915-486-6a08239a32eafc770817567682546994-1024-1024.webp", nice: "pink21-intense-matte-display-abierto.webp" },
  { local: "1000186652-6d188d56191edb437f17593433496368-1024-1024.webp",               nice: "pink21-intense-matte-display-cerrado.webp" },
];

// 8 tonos del display (numerados 1-8, de izquierda a derecha viendo la caja).
// 48 unidades totales / 8 = 6 por variante.
const variantSpecs = [
  { name: "Tono 01 — Rojo clásico",      color_hex: "#C42030", stock: 6 },
  { name: "Tono 02 — Vino borgoña",       color_hex: "#7A1F2E", stock: 6 },
  { name: "Tono 03 — Marrón rojizo",      color_hex: "#9C4A3A", stock: 6 },
  { name: "Tono 04 — Mauve amaderado",    color_hex: "#A06578", stock: 6 },
  { name: "Tono 05 — Nude beige",         color_hex: "#C99480", stock: 6 },
  { name: "Tono 06 — Caramel dorado",     color_hex: "#B57A55", stock: 6 },
  { name: "Tono 07 — Rosa fucsia",        color_hex: "#C73E80", stock: 6 },
  { name: "Tono 08 — Nude rosado claro",  color_hex: "#D9A293", stock: 6 },
];

const payload = {
  name: "Intense Matte Lipgloss Waterproof 24h — Pink21",
  slug: "pink21-intense-matte-lipgloss-waterproof",
  description:
    "Intense Matte Lipgloss de Pink21 — labial líquido mate intenso, súper pigmentado, waterproof y de larga duración (¡hasta 24 horas!). Para mujeres libres que aman el labial que aguanta el día sin retoques, sin transferirse al café ni a las copas.\n\nCaracterísticas:\n\n- 💋 Fórmula mate intenso — color full pigmento desde la primera pasada\n- ⏱️ Larga duración: hasta 24 horas\n- 💧 Waterproof — resiste agua, sudor y besos\n- 🪞 Acabado mate profesional (no brilloso, no pegajoso al secarse)\n- 🌸 Aplicador doe-foot tipo brocha — preciso y cómodo\n- 💎 Formato dual con tapa rosada y base oscura\n- 🐰 Cruelty Free\n\nDisponible en 8 tonos que van del rojo clásico al nude rosado. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Rojo clásico (rojo intenso atemporal)\n- **Tono 02** — Vino borgoña (rojo oscuro con fondo vino)\n- **Tono 03** — Marrón rojizo (terracota cálido)\n- **Tono 04** — Mauve amaderado (rosa-violeta sofisticado)\n- **Tono 05** — Nude beige (nude rosado neutro)\n- **Tono 06** — Caramel dorado (nude marrón cálido)\n- **Tono 07** — Rosa fucsia (pink intenso)\n- **Tono 08** — Nude rosado claro (rosa pálido tipo daily)\n\nModo de uso: aplicá una capa fina del centro hacia afuera con el aplicador. Dejá secar 30 segundos sin frotar los labios — el color se fija y queda mate. Para un look más intenso, aplicá una segunda capa después de que la primera se seque.\n\nTip: para que dure 24 horas reales, exfoliá los labios antes de aplicar y evitá productos oleosos encima.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2000,
  compare_price: 3000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 15,
  length_cm: 11,
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

  const variantReferenceImage = galleryUrls[0];
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, "  Stock total:", totalStock);

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
