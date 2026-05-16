import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "ChatGPT Image 16 may 2026, 05_12_47 p.m..png", nice: "pink21-sweet-charm-cover-premium-6tonos.png" },
  { local: "CS7072.jpg",                                     nice: "pink21-sweet-charm-display.jpg" },
  { local: "CS7072.jpg-.jpg",                                nice: "pink21-sweet-charm-celular-colgante.jpg" },
];

const variantSpecs = [
  { name: "Tono 01 — Rosa palo",      color_hex: "#F0B3BB", stock: 4 },
  { name: "Tono 02 — Rosa medio",     color_hex: "#E48294", stock: 4 },
  { name: "Tono 03 — Rosa fucsia",    color_hex: "#D85975", stock: 4 },
  { name: "Tono 04 — Cereza",         color_hex: "#C42044", stock: 4 },
  { name: "Tono 05 — Rojo carmín",    color_hex: "#9A1C2A", stock: 4 },
  { name: "Tono 06 — Marrón cobre",   color_hex: "#8C3E1F", stock: 4 },
];

const payload = {
  name: "Sweet Charm Lipgloss con Colgante para Celular — Pink21",
  slug: "pink21-sweet-charm-lipgloss-perlas",
  description:
    "Sweet Charm Lipgloss de Pink21 — brillo labial con cadenita de perlitas rosadas + dije de caramelo cristalino que funciona como **colgante para el celular** 📱✨. La onda \"phone charm + lipgloss\" en un solo producto. Para mujeres libres que aman lo aesthetic y tener todo siempre a mano.\n\nCaracterísticas:\n\n- ✨ **Brillo gloss** intenso tipo cristal\n- 💖 **Diseño cute** con cadenita de perlitas rosadas + dije de caramelo iridiscente\n- 📱 **Colgante para el celular** — se engancha directo a la funda con tu phone strap\n- 👜 **Ideal para llevar** — entra en cualquier bolso, siempre listo para retoques\n- 💋 Aplicador doe-foot tipo brocha plana\n- 🐰 Cruelty Free\n\nDisponible en 6 tonos cute. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Rosa palo (rosa muy suave para uso diario)\n- **Tono 02** — Rosa medio (rosa-coral fresco)\n- **Tono 03** — Rosa fucsia (pink intenso)\n- **Tono 04** — Cereza (rojo cereza vibrante)\n- **Tono 05** — Rojo carmín (rojo intenso clásico)\n- **Tono 06** — Marrón cobre (marrón cálido con destellos)\n\nModo de uso: aplicá una capa fina con el aplicador directo sobre los labios. Combina perfecto encima de labial mate. El charm queda increíble colgado del celu o de la cartera.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 4500,
  compare_price: 5700,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
  length_cm: 8,
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
