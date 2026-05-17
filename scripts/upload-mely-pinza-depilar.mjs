import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "1753987597913-lh9-297k-general-jpgweb3.webp", nice: "mely-pinza-depilar-4-colores-display.webp" },
  { local: "1776885316886-lh9-297k.webp",                 nice: "mely-pinza-depilar-negro-glitter.webp" },
  { local: "1753987597703-lh-64157b-rosa-jpgweb.webp",    nice: "mely-pinza-depilar-rosa-confetti.webp" },
  { local: "1753987597918-lh-64157b-violeta-jpgweb.webp", nice: "mely-pinza-depilar-beige-confetti.webp" },
];

const variantSpecs = [
  { name: "Negro glitter",       color_hex: "#1A1A1A", stock: 8 },
  { name: "Rosa confetti",       color_hex: "#E91E63", stock: 8 },
  { name: "Beige confetti",      color_hex: "#E8C9A0", stock: 8 },
];

const payload = {
  name: "Pinza de Depilar Decorada para Pestañas y Cejas — Mely Beauty Pro Tools",
  slug: "mely-pinza-depilar-decorada-pestanas-cejas",
  description:
    "Pinza de depilar **Pro Tools** de Mely Beauty 💅✨ — pinza profesional con diseño decorado glitter/confetti. Ideal para cejas, pelitos sueltos y para aplicar pestañas postizas. Punta filosa precisa que agarra hasta el pelo más fino. Stock muy limitado!\n\nCaracterísticas:\n\n- ✂️ **Punta inclinada filosa (slant tip)** — pinza profesional pro tool\n- 👁️ **Multi-uso** — depilación de cejas + aplicar pestañas postizas (recomendado en el packaging Mely)\n- 💎 **Diseño decorado** — terminación glitter / confetti / brillitos\n- 🛡️ Acero inoxidable resistente\n- 📦 Viene en blíster individual Mely Beauty\n- 🇦🇷 Marca Mely Beauty (industria argentina)\n\nDisponible en 3 colores. Elegí el tuyo al agregar al carrito:\n\n- **Negro glitter** — pinza negra con brillitos multicolor\n- **Rosa confetti** — pinza rosa pastel con puntos dorados\n- **Beige confetti** — beige cremoso con confetti multicolor\n\nModo de uso:\n\n- Para cejas: agarrá el pelito desde la raíz y tirá en dirección al crecimiento. Después del baño/ducha es más fácil porque el poro está abierto.\n- Para pestañas postizas: agarrá la pestaña del borde y guiala al ras de tu línea natural.\n- Limpiá la pinza con alcohol después de cada uso para mantener filo y evitar bacterias.\n\nTip: la punta inclinada (slant tip) es la mejor para ceja porque podés agarrar tanto desde el ángulo plano como desde el ángulo punta.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 1800,
  compare_price: 2500,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 30,
  length_cm: 16,
  width_cm: 8,
  height_cm: 1,
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

  const variantReferenceImage = galleryUrls[0]; // display 4 colores
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock total:", totalStock);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: ACCESORIOS_CATEGORY_ID,
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
