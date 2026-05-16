import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "img_2293-835417a3a6faef59b217781757854399-1024-1024.webp", nice: "pink21-concealer-display-cover.webp" },
  { local: "50fdfb_15153e84bb2b48e6bc9ea5be75fdb6af~mv2.jpg",           nice: "pink21-concealer-swatches-tonos.jpg" },
];

const variantSpecs = [
  { name: "Tono 01 — Porcelain (claro frío)", color_hex: "#F2D5BD", stock: 4 },
  { name: "Tono 02 — Light beige",            color_hex: "#E8C39E", stock: 4 },
  { name: "Tono 03 — Beige medio",            color_hex: "#D9A982", stock: 4 },
  { name: "Tono 04 — Honey",                  color_hex: "#C99770", stock: 4 },
  { name: "Tono 05 — Caramel",                color_hex: "#B27C55", stock: 4 },
  { name: "Tono 06 — Cocoa",                  color_hex: "#8E5A3A", stock: 4 },
];

const payload = {
  name: "Concealer Corrector de Ojeras — Pink21",
  slug: "pink21-concealer-corrector-ojeras",
  description:
    "Concealer Corrector de Ojeras de Pink21 — corrector líquido full pigmento que tapa ojeras, manchitas y rojeces en una sola pasada. Acabado natural sin caer en máscara — la piel se sigue viendo. Para mujeres libres que quieren cubrir lo justo sin que se note que tienen \"algo\" puesto.\n\nCaracterísticas:\n\n- 💎 Cobertura media-alta buildable (podés ir capeando hasta donde necesites)\n- ✨ Acabado natural luminoso — no efecto polvo, no efecto máscara\n- 🌸 Fórmula ligera — no se cuartea, no marca líneas de expresión\n- 🪞 Aplicador doe-foot cómodo para zona del ojo\n- 💧 Larga duración: aguanta el día sin caerse\n- 🩷 Frasco iridiscente con dibujo de \"P\" — packaging cute\n- 🐰 Cruelty Free\n\nDisponible en 6 tonos de claro a oscuro. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Porcelain (piel muy clara con subtono frío)\n- **Tono 02** — Light beige (piel clara neutra)\n- **Tono 03** — Beige medio (piel media cálida)\n- **Tono 04** — Honey (piel media-oscura cálida)\n- **Tono 05** — Caramel (piel oscura cálida)\n- **Tono 06** — Cocoa (piel oscura profunda)\n\nModo de uso:\n\n1. Aplicá pequeños puntos del producto en la zona a corregir (debajo del ojo, alrededor de la nariz, en granitos).\n2. Difuminá con esponja húmeda o tu dedo anular con golpecitos (no frotando).\n3. Sellá con un toque de polvo translúcido si querés acabado más mate / mayor duración.\n\nTip: si dudás entre dos tonos para tapar ojeras → elegí el más claro. Para uso \"contour\" debajo del ojo elegí el más oscuro de los dos.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2800,
  compare_price: 3900,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 15,
  length_cm: 10,
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

  const variantReferenceImage = galleryUrls[1]; // swatch chart → mejor para identificar variantes
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, "  Stock total:", totalStock);

  // Vincular categoría en product_categories (nueva tabla multi-cat).
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
