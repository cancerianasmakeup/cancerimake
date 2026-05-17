import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "74-833bc31e88b775438317736987178503-1024-1024.webp", nice: "pink21-hot-black-lipliner-display-tonos-numerados.webp" },
  { local: "73-2e8f49f13632be59cc17736987155160-1024-1024.webp", nice: "pink21-hot-black-lipliner-display-mano.webp" },
  { local: "img_0801-9657cb899fa8e076b517736283125429-1024-1024.webp", nice: "pink21-hot-black-lipliner-swatches-12-tonos.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Nude beige",     color_hex: "#BC8865", stock: 6 },
  { name: "Tono 02 — Coral suave",    color_hex: "#C97A60", stock: 6 },
  { name: "Tono 03 — Terracota",      color_hex: "#A8584A", stock: 6 },
  { name: "Tono 04 — Marrón rojizo",  color_hex: "#8E443A", stock: 6 },
  { name: "Tono 05 — Marrón medio",   color_hex: "#7F4E3A", stock: 6 },
  { name: "Tono 06 — Mocha intenso",  color_hex: "#603424", stock: 6 },
  { name: "Tono 07 — Nude rosado",    color_hex: "#B07567", stock: 6 },
  { name: "Tono 08 — Rosa coral",     color_hex: "#C16876", stock: 6 },
  { name: "Tono 09 — Rosa fucsia",    color_hex: "#C04A6E", stock: 6 },
  { name: "Tono 10 — Cereza",         color_hex: "#A52A48", stock: 6 },
  { name: "Tono 11 — Vino burgundy",  color_hex: "#7A1A35", stock: 6 },
  { name: "Tono 12 — Berry oscuro",   color_hex: "#5A1E33", stock: 6 },
];

const payload = {
  name: "Hot Black Lipliner — Delineador de Labios Pink21 (12 tonos)",
  slug: "pink21-hot-black-lipliner",
  description:
    "Hot Black Lipliner de Pink21 — delineador de labios cremoso de larga duración, fácil de aplicar, con 12 tonos para combinar con cualquier labial. Para mujeres libres que aman labios bien delineados con un contorno definido.\n\nCaracterísticas:\n\n- 💋 **12 tonos** disponibles — del nude al vino, cubrís toda la paleta\n- ✏️ **Punta retráctil** o lápiz tradicional (sacapuntas standard)\n- 🌸 **Fórmula cremosa** — se desliza suave, no tira ni reseca\n- ⏱️ Larga duración — no se borra fácil\n- 💎 Diseño negro elegante con tapa del color del producto\n- 🐰 Cruelty Free · Aprobado ANMAT\n\nDisponible en 12 tonos del catálogo. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Nude beige (perfecto para nudes claros)\n- **Tono 02** — Coral suave (coral cálido fresco)\n- **Tono 03** — Terracota (terracota natural)\n- **Tono 04** — Marrón rojizo (terracota oscuro)\n- **Tono 05** — Marrón medio (nude cálido oscuro)\n- **Tono 06** — Mocha intenso (marrón profundo)\n- **Tono 07** — Nude rosado (rosa-beige neutro)\n- **Tono 08** — Rosa coral (rosa-coral mid)\n- **Tono 09** — Rosa fucsia (pink intenso)\n- **Tono 10** — Cereza (rojo cereza vibrante)\n- **Tono 11** — Vino burgundy (vino oscuro)\n- **Tono 12** — Berry oscuro (berry profundo)\n\nModo de uso:\n\n1. Sacale punta al delineador con sacapuntas standard (necesita estar bien filoso para definir).\n2. Delineá el contorno de los labios siguiendo tu línea natural — empezando por el centro del labio superior y bajando hacia las comisuras.\n3. Rellená levemente hacia el interior para que el labial dure más.\n4. Aplicá tu labial favorito encima.\n\nTip pro: usá un tono 1 sombra más oscuro que tu labial para efecto labios más definidos / efecto plump óptico.\n\nMarca Pink21.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 1800,
  compare_price: 2500,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 8,
  length_cm: 15,
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

  const variantReferenceImage = galleryUrls[2]; // swatches 12 tonos
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
