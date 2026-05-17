import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_949191-MLA104276946043_012026-F.webp", nice: "tei-crystal-glaze-display-3-tonos.webp" },
  { local: "D_NQ_NP_2X_721966-MLA104275098881_012026-F.webp", nice: "tei-crystal-glaze-3-tubos-aroma-frutal.webp" },
  { local: "D_NQ_NP_2X_704014-MLA104276885877_012026-F.webp", nice: "tei-crystal-glaze-aplicador-detalle.webp" },
  { local: "D_NQ_NP_2X_820185-MLA104275367147_012026-F.webp", nice: "tei-crystal-glaze-before-after.webp" },
  { local: "109-0a4bc99c9240055e3b17607192667202-1024-1024.webp", nice: "tei-crystal-glaze-3-colores-trio.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Durazno nude",      color_hex: "#F4C7A0", stock: 8 },
  { name: "Tono 02 — Rosa coral",         color_hex: "#F08B96", stock: 8 },
  { name: "Tono 03 — Rosa mauve lila",    color_hex: "#C9A8C6", stock: 8 },
];

const payload = {
  name: "Crystal Lip Glaze — Labial Líquido Acabado Cristal — TEI Cosmética (8282)",
  slug: "tei-crystal-lip-glaze-8282",
  description:
    "Crystal Glaze de TEI Cosmética 💎🍒 — labial líquido con **acabado cristal**, hidratante y aroma frutal. Fórmula enriquecida que deja los labios suaves con brillo natural y saludable. Tubo squeeze tipo crema con aplicador de bolita transparente — efecto labios húmedos tipo K-Beauty. ✨\n\n**Antes vs Después:** labios deshidratados con líneas → labios glossy hidratados con efecto cristal. Hot pick TEI.\n\nCaracterísticas:\n\n- 💎 **Acabado cristal (crystal finish)** — brillo glossy húmedo intenso\n- 💧 **Hidratante** — calma y nutre labios secos y agrietados\n- 🌸 **Fórmula enriquecida** — hidratación duradera\n- 🍒 **Aroma frutal** — fragancia dulce suave\n- 🪞 **Aplicador bolita** transparente tipo K-Beauty (efecto gel/jelly)\n- 📦 Tubo squeeze tipo crema con tapa color del producto\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 3 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Durazno nude (peachy nude cálido)\n- **Tono 02** — Rosa coral (rosa-coral fresco)\n- **Tono 03** — Rosa mauve lila (mauve frío rosado)\n\nModo de uso:\n\n1. Apretá suave el tubo para que salga producto en la bolita aplicadora.\n2. Pasá la bolita por los labios — el producto se siente fresquito.\n3. Para efecto cristal extremo, segunda capa después de 10 segundos.\n\nTip K-Beauty: combinalo encima de un labial mate del mismo tono — efecto labios jugosos sin perder pigmento.\n\nÍtem TEI 8282.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3200,
  compare_price: 4200,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
  length_cm: 12,
  width_cm: 4,
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

  const variantReferenceImage = galleryUrls[4]; // 3 colores trío
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
