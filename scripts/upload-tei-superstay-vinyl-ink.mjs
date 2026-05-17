import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "TEI8026.jpg",                                                                                  nice: "tei-superstay-vinyl-ink-display-tonos.jpg" },
  { local: "fondo-para-fotos-pagina-copia-2026-04-30T172815.429.webp",                                     nice: "tei-superstay-vinyl-ink-tubos-swatches.webp" },
  { local: "D_NQ_NP_2X_824259-MLA104341248686_012026-F.webp",                                              nice: "tei-superstay-vinyl-ink-display-cover.webp" },
  { local: "tei-8026-1032-3496ce3044444dacd317423873474740-1024-1024.webp",                                nice: "tei-superstay-vinyl-ink-anmat-cruelty.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Rojo cereza",     color_hex: "#C42044", stock: 4 },
  { name: "Tono 02 — Vino burgundy",   color_hex: "#6E1F2C", stock: 4 },
  { name: "Tono 03 — Rosa palo",       color_hex: "#C9817D", stock: 4 },
  { name: "Tono 04 — Berry mauve",     color_hex: "#9C5765", stock: 4 },
  { name: "Tono 05 — Rosa fucsia",     color_hex: "#D14C8E", stock: 4 },
  { name: "Tono 06 — Caramel nude",    color_hex: "#C7895C", stock: 4 },
];

const payload = {
  name: "Superstay Vinyl Ink — TEI Cosmética (8026)",
  slug: "tei-superstay-vinyl-ink-8026",
  description:
    "Superstay Vinyl Ink de TEI Cosmética — labial líquido con acabado **vinyl** (efecto vinilo brillante) de larga duración. Color full pigmento + brillo glossy intenso + duración hasta 16 horas. Para mujeres libres que aman labios brillosos tipo \"cristal\" sin tener que retocar todo el día.\n\nCaracterísticas:\n\n- 💋 **Vinyl Finish** — acabado tipo vinilo, ultra brillante y reflectivo\n- ⏱️ **Superstay long lasting** — aguanta el día sin caerse\n- 🎨 **Full pigmento** — color intenso desde la primera pasada\n- 🌸 Fórmula liviana — no pegajosa, no se siente pesada\n- 🪞 Aplicador doe-foot tipo brocha plana\n- 💎 Formato slim con relieve \"VINYL\" en el envase\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 6 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Rojo cereza (rojo clásico vibrante)\n- **Tono 02** — Vino burgundy (vino oscuro elegante)\n- **Tono 03** — Rosa palo (rosa-nude natural)\n- **Tono 04** — Berry mauve (berry rosado con fondo mauve)\n- **Tono 05** — Rosa fucsia (pink intenso)\n- **Tono 06** — Caramel nude (caramelo cálido nude)\n\nModo de uso: aplicá una capa fina del centro hacia afuera. El acabado vinyl es BRILLANTE — no se seca mate, queda con shine permanente. Para color más intenso, segunda capa.\n\nTip: si querés efecto cristal extremo, después del vinyl pasá una capa de gloss transparente encima.\n\nÍtem TEI 8026.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3200,
  compare_price: 4300,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 18,
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

  const variantReferenceImage = galleryUrls[1]; // foto con tubos + swatches
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
