import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const PARA_NINAS_CATEGORY_ID = "efc8cc64-7c06-4bbd-b002-c8a8e0385714";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "1761761121446-diseosinttulo-2025-10-29t150509.390.webp", nice: "mely-rainbow-candy-lifestyle-cover.webp" },
  { local: "1744144472987-a7c02385-photoroom-768x768.webp",          nice: "mely-rainbow-candy-display-caja.webp" },
  { local: "1745088293924-my8010301-photoroom.webp",                  nice: "mely-rainbow-candy-6-tonos-fila.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Lila lollipop",   color_hex: "#C8A2D8", stock: 4 },
  { name: "Tono 02 — Rosa fucsia",     color_hex: "#C72E80", stock: 4 },
  { name: "Tono 03 — Rosa coral",      color_hex: "#E97765", stock: 4 },
  { name: "Tono 04 — Cereza",          color_hex: "#C42044", stock: 4 },
  { name: "Tono 05 — Durazno",         color_hex: "#F2A972", stock: 4 },
  { name: "Tono 06 — Naranja cítrico", color_hex: "#F2B847", stock: 4 },
];

const payload = {
  name: "Lip Gloss Rainbow Candy — Mely Beauty",
  slug: "mely-lipgloss-rainbow-candy",
  description:
    "Lip Gloss Rainbow Candy de Mely Beauty 🍭 — colección dulce con 6 tonos pastel rainbow, packaging súper cute con tapas color pastel + dibujos de candies. Brillo labial liviano, no pegajoso, con base translúcida que deja los labios con un tono suave y brillito de caramelo.\n\nCaracterísticas:\n\n- 🍭 **Look candy / dulce** — tonos pastel rainbow tipo arcoíris de chuches\n- ✨ **Brillo gloss** — acabado glassy no pegajoso\n- 💗 **Tapas color pastel** — cada tono con su tapita distinta para identificar rápido\n- 🌸 Fórmula ligera — se siente como bálsamo, hidrata\n- 💋 Aplicador integrado tipo doe-foot\n- 🐰 Cruelty Free\n\nDisponible en 6 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Lila lollipop (lila pastel translúcido)\n- **Tono 02** — Rosa fucsia (pink intenso vibrante)\n- **Tono 03** — Rosa coral (coral peachy suave)\n- **Tono 04** — Cereza (rojo cereza vibrante)\n- **Tono 05** — Durazno (peach cálido)\n- **Tono 06** — Naranja cítrico (orange jugoso)\n\nIdeal para regalar a chicas o para tu propia colección 🎀. Combiná tonos para tu look del día.\n\nModo de uso: aplicá una capa fina con el aplicador directo sobre los labios. Para más intensidad, segunda capa. Funciona increíble encima de tu labial mate favorito para sumar brillo.\n\nCódigo Mely.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 1800,
  compare_price: 3000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 15,
  length_cm: 9,
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

  const variantReferenceImage = galleryUrls[2]; // foto con los 6 tonos
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock total:", totalStock);

  // Multi-categoría: Maquillaje (primary) + Para Niñas (estética candy/cute)
  await postRest("product_categories", [
    { product_id: product.id, category_id: MAQUILLAJE_CATEGORY_ID, is_primary: true  },
    { product_id: product.id, category_id: PARA_NINAS_CATEGORY_ID, is_primary: false },
  ]);
  console.log("  Categorías: Maquillaje (primary) + Para Niñas");

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
