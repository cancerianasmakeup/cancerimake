import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_869596-MLA103233660490_012026-F.webp", nice: "citygirl-liploop-corazon-blister-fucsia.webp" },
];

const variantSpecs = [
  { name: "Rosa",   color_hex: "#F4B6C2", stock: 2 },
  { name: "Fucsia", color_hex: "#E91E63", stock: 2 },
];

const payload = {
  name: "LipLoop Corazón — Porta Gloss para Celular Silicona — City Girl",
  slug: "citygirl-liploop-corazon-porta-gloss",
  description:
    "LipLoop Corazón de City Girl 💕📱 — \"Your gloss goes where you go\". Versión **CORAZÓN** del porta-gloss adhesivo de City Girl. Soporte de silicona con forma de corazón que se pega al dorso del celular y sostiene tu lipgloss/labial favorito. Hello Girlie!\n\n¿Tu mochila/cartera siempre se traga el labial? Acá lo tenés con vos en todo momento, pegado al celu.\n\nCaracterísticas:\n\n- 💗 **Forma de corazón** súper cute con logo City Girl en relieve\n- 🧴 **Material silicona suave** — no raya el celu ni el labial\n- 📱 **Adhesivo trasero reposicionable** — pegás al cel o a la funda\n- 💄 Loop diseñado para labiales mini (bullet, lip oil, lip balm cilíndrico)\n- 📦 Viene en blíster individual City Girl con sticker \"Hello Girlie!\"\n\n⚠ Stock muy limitado: solo 4 unidades disponibles.\n\nDisponible en 2 colores:\n\n- **Rosa** (2 unidades) — rosa pastel suave\n- **Fucsia** (2 unidades) — pink intenso vibrante\n\nModo de uso:\n\n1. Despegá el film del adhesivo trasero.\n2. Pegá el corazón al dorso de tu celular (superficie limpia).\n3. Presioná 10 segundos para adhesión total.\n4. Insertá tu labial mini en el loop central y listo.\n\nTip: combinalo con el Sweet Charm o el Bunny Lipgloss de Pink21 (también disponibles en la tienda) — encajan perfecto en el loop.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 3000,
  compare_price: 5000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 30,
  length_cm: 10,
  width_cm: 8,
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
