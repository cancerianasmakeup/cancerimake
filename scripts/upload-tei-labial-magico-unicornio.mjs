import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const PARA_NINAS_CATEGORY_ID = "efc8cc64-7c06-4bbd-b002-c8a8e0385714";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_857334-MLA110175761317_042026-F.webp", nice: "tei-labial-magico-unicornio-display-cover.webp" },
  { local: "D_NQ_NP_2X_765659-MLA110176318475_042026-F.webp", nice: "tei-labial-magico-unicornio-3-tonos-luz.webp" },
  { local: "D_NQ_NP_2X_835155-MLA110174923725_042026-F.webp", nice: "tei-labial-magico-unicornio-aplicado.webp" },
];

const variantSpecs = [
  { name: "Transparente",  color_hex: "#F5E8DE", stock: 8 },
  { name: "Rosa",          color_hex: "#F4C2D0", stock: 8 },
  { name: "Lila",          color_hex: "#D1BBE6", stock: 8 },
];

const payload = {
  name: "Labial Mágico Unicornio Color Change — TEI Cosmética (8461)",
  slug: "tei-labial-magico-unicornio-color-change-8461",
  description:
    "Labial Mágico Unicornio de TEI Cosmética 🦄✨ — bálsamo labial color change con cabeza de unicornito alado en la tapa. Súper cute, súper viral. El labial cambia de color al contacto con tus labios (la humedad y el pH activan el rosa). De aplicar transparente/blanco a quedar de tono rosado natural en segundos.\n\n¡Magia real! Ideal para regalar a chicas, ideal para tu colección kawaii.\n\nCaracterísticas:\n\n- 🦄 **Tapa unicornito con alas** moldeada — pieza coleccionable\n- 🌈 **Color Change** — el bálsamo se ve transparente/blanco/lila pero al aplicar en los labios se activa el color\n- 💧 **Lip balm hidratante** — fórmula tipo bálsamo que cuida y suaviza\n- 💋 Acabado natural — rosa propio según el pH de cada persona\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 3 colores de packaging (todos cambian al mismo tono rosado al aplicar):\n\n- **Transparente** — el bálsamo se ve blanco/cristal, cambia a rosa al contacto\n- **Rosa** — bálsamo rosa pastel, intensifica el color al aplicar\n- **Lila** — bálsamo lila lavanda, cambia a rosa-coral al aplicar\n\nModo de uso: aplicá directo sobre los labios secos como si fuera un bálsamo. El color se activa en segundos por la humedad natural. Para más intensidad, segunda pasada.\n\nTip: combiná con tu gloss favorito encima para potenciar el efecto color change + brillo.\n\nÍtem TEI 8461.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2200,
  compare_price: 3000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 12,
  length_cm: 8,
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

  const variantReferenceImage = galleryUrls[1]; // 3 tonos luz
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock total:", totalStock);

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
