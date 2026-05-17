import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "393-d18b88b81a6d2fbc2c17496606862579-480-0.webp", nice: "mely-agua-micelar-3-versiones-rose-vitc-hialuronico.webp" },
  { local: "glorificaciones-skincare-5982b855150e6b4c6917496608007237-1024-1024.webp", nice: "mely-agua-micelar-3-frascos-bano-marmol.webp" },
  { local: "D_NQ_NP_2X_914923-MLA108299702209_032026-F.webp", nice: "mely-agua-micelar-hialuronico-cruelty-free.webp" },
  { local: "D_NQ_NP_2X_772282-MLA107570354274_032026-F.webp", nice: "mely-agua-micelar-vitamina-c-cruelty-free.webp" },
];

const variantSpecs = [
  { name: "Rose Water — Agua de Rosas",     color_hex: "#F4B6C2", stock: 1 },
  { name: "Vitamin C — Vitamina C",         color_hex: "#F5E146", stock: 1 },
  { name: "Hyaluronic Acid — Hialurónico",  color_hex: "#7AB6E8", stock: 1 },
];

const payload = {
  name: "Agua Micelar Natural 200ml — Limpiadora Multi-Activo — Mely Skincare",
  slug: "mely-agua-micelar-natural-200ml",
  description:
    "Agua Micelar Mely Skincare 🧴💧 — limpiador facial **3-en-1**: limpia, hidrata y prepara la piel para el resto de tu rutina. **Sin enjuague**. Apto todo tipo de piel. Disponible en **3 activos** distintos. Cruelty Free 🐰.\n\n**Contenido neto:** 200 ml por frasco.\n\nFunciones:\n\n- 🧼 **Limpia maquillaje** (incluso resistente al agua) sin frotar\n- 💧 **Hidrata** la piel mientras limpia\n- ✨ **Brightening** — ilumina y unifica el cutis\n- 🌿 Glicerina + aceite vegetal natural = barrera cutánea reforzada\n- 🩷 Apto piel sensible\n- 🐰 **Cruelty Free**\n- 🇦🇷 Marca Mely Skincare\n\n⚠ Stock muy limitado: 1 unidad de cada activo (3 totales).\n\nDisponible en 3 variantes. Elegí la tuya según necesidad:\n\n**🌹 Rose Water — Agua de Rosas**\n- Para piel sensible/reactiva. Calma rojeces, tonifica el cutis. Aroma sutil de rosas.\n\n**🍊 Vitamin C — Vitamina C**\n- Para piel apagada, con manchas o antiaging. Antioxidante natural, ilumina y unifica el tono.\n\n**💧 Hyaluronic Acid — Ácido Hialurónico**\n- Para piel deshidratada. Hidratación profunda multi-capa, efecto piel rebotante.\n\nModo de uso (mañana y noche):\n\n1. Empapá un disco de algodón con el agua micelar.\n2. Pasalo suavemente por toda la cara, ojos y cuello — el algodón \"limpia\" sin necesidad de frotar.\n3. Repetí con otro disco si tenés mucho maquillaje (especialmente waterproof).\n4. NO necesita enjuague. Continuá con tu rutina: sérum → hidratante → SPF.\n\nTip K-Beauty (**doble cleansing**):\n\n1. Primera limpieza: aceite limpiador / agua micelar (saca maquillaje y SPF).\n2. Segunda limpieza: cleanser en gel/espuma (limpia la piel en profundidad).\n3. Resultado: piel limpia sin residuo, lista para los activos.\n\nIdeal para:\n\n- 🌙 **Antes de dormir** — limpieza rápida de make + impurezas del día\n- 🏃 **Post-entrenamiento** — limpieza express sin shower\n- ✈️ **Viajar** — no requiere enjuague (perfecto para avión)\n- 💄 **Pre-makeup** — base limpia para que la base agarre mejor\n\nVer también disponible en la tienda: **3 Sprays Faciales Mely** (Rosas / Hialurónico / Vitamina C) — combo perfecto: limpiar con micelar → tonificar con spray.\n\nÍtem Mely.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 5200,
  compare_price: 9000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 230,
  length_cm: 17,
  width_cm: 6,
  height_cm: 4,
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

  const variantReferenceImage = galleryUrls[0]; // 3 frascos rose+vitc+hialuronico
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock total:", totalStock);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: SKINCARE_CATEGORY_ID,
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
