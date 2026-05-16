import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "7098be6a-4dfb-4eae-890b-0cfd82525948.png", nice: "pink21-pinks-charm-cover-premium.png" },
  { local: "CS7070.jpg",                                nice: "pink21-pinks-charm-display.jpg" },
  { local: "CS7070.jpg-.jpg",                           nice: "pink21-pinks-charm-celular-colgante.jpg" },
];

const variantSpecs = [
  { name: "Tono 01 — Rosa pastel",     color_hex: "#F2C2C8", stock: 4 },
  { name: "Tono 02 — Rosa nude",       color_hex: "#D69397", stock: 4 },
  { name: "Tono 03 — Rosa fucsia",     color_hex: "#D85795", stock: 4 },
  { name: "Tono 04 — Cereza",          color_hex: "#C42044", stock: 4 },
  { name: "Tono 05 — Rojo intenso",    color_hex: "#A8132A", stock: 4 },
  { name: "Tono 06 — Berry fucsia",    color_hex: "#852158", stock: 4 },
];

const payload = {
  name: "Pink's Charm Lipgloss con Colgante Corazón — Pink21",
  slug: "pink21-pinks-charm-lipgloss-corazon",
  description:
    "Pink's Charm Lipgloss de Pink21 — \"Brillo, estilo y encanto que te acompañan a todas partes\" ✨. Lipgloss mini con cordón rosa trenzado + dije de corazón holográfico que funciona como **colgante para el celular** 📱💖. Detalles que enamoran.\n\nCaracterísticas:\n\n- ✨ **Brillo gloss** — acabado luminoso y no pegajoso\n- 💖 **Diseño cute** — colgante en forma de corazón holográfico iridiscente\n- 👜 **Ideal para llevar** — compacto, ligero y siempre a mano\n- 📱 **Con colgante para el celular** — se engancha directo a la funda con tu phone strap\n- 💋 Aplicador integrado tipo doe-foot\n- 🐰 Cruelty Free\n\nDisponible en 6 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Rosa pastel (rosa muy suave para uso diario)\n- **Tono 02** — Rosa nude (rosa-marrón natural)\n- **Tono 03** — Rosa fucsia (pink intenso)\n- **Tono 04** — Cereza (rojo cereza vibrante)\n- **Tono 05** — Rojo intenso (rojo clásico atemporal)\n- **Tono 06** — Berry fucsia (berry oscuro elegante)\n\nModo de uso: aplicá una capa fina con el aplicador directo sobre los labios. Combina perfecto encima de un labial mate. El charm de corazón holográfico queda increíble colgado del celular o de la cartera.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 4600,
  compare_price: 5800,
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
