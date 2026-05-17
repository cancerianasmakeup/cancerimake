import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "173d4331-be0f-4508-b877-42302f13e09e-4a6017e18041fdbc9917781651780353-1024-1024.webp", nice: "citygirl-bubble-grip-blister-cover.webp" },
  { local: "7bb97ad5-b73b-4373-825c-7d3a912e6d23-030e6f3d8832ae298017765359276330-1024-1024.webp", nice: "citygirl-bubble-grip-2-colores.webp" },
  { local: "WhatsApp-Image-2025-12-04-at-3.59.22-PM-1.webp",                                         nice: "citygirl-bubble-grip-4-colores-codigo.webp" },
  { local: "D_NQ_NP_2X_871899-MLA103750867473_012026-F.webp",                                       nice: "citygirl-bubble-grip-fucsia-hero.webp" },
];

const variantSpecs = [
  { name: "Rosa fucsia", color_hex: "#E91E63", stock: 4 },
  { name: "Lila",        color_hex: "#C8A2D8", stock: 4 },
];

const payload = {
  name: "Bubble Grip — Soporte para Celular con Ventosas — City Girl",
  slug: "citygirl-bubble-grip-soporte-celular",
  description:
    "Bubble Grip de City Girl 📱✨ — soporte para celular con tecnología de **ventosas (bubble grip)** que se pega al dorso del celular o a cualquier superficie lisa. Funciona como stand para apoyar el cel, agarre estable para fotos/videos y pop holder cute. \"Hello Girlie!\" 💕\n\nCaracterísticas:\n\n- 🫧 **Ventosas tipo bubble grip** — se pega y despega sin pegamento, sin marcas\n- 🦾 **Reutilizable** — se lava con agua y vuelve a pegarse perfecto (no pierde adherencia)\n- 📱 **Stand para celular** — apoyalo en cualquier mesa para ver videos/llamadas\n- 🤳 **Grip para fotos/videos** — agarre extra estable, evita que se caiga\n- 🎨 **Diseño cute** \"Stick. Stand. Style.\" — Hello Girlie!\n- 📦 Viene en blíster individual City Girl\n\nDisponible en 2 colores. Elegí el tuyo al agregar al carrito:\n\n- **Rosa fucsia** — pink vibrante\n- **Lila** — pastel lavanda dreamy\n\nModo de uso:\n\n1. Sacá del blíster. Remové el film protector de las ventosas (si lo tiene).\n2. Apoyá las ventosas en la parte trasera del celular (limpia y sin polvo).\n3. Presioná suave 5 segundos para que las ventosas hagan vacío.\n4. Listo — el soporte queda fijo y podés desplegar la base para usar de stand.\n\nLavado: si las ventosas pierden adherencia, lavalas con agua tibia y jabón suave, dejá secar al aire, y vuelven a pegar como nuevas.\n\nÍtem City Girl PZ17508-3 · CG-ACC-305040.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 3000,
  compare_price: 5000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 40,
  length_cm: 10,
  width_cm: 10,
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

  const variantReferenceImage = galleryUrls[1]; // los 2 colores juntos
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
