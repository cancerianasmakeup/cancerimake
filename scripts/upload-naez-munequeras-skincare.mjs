import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const PARA_NINAS_CATEGORY_ID = "efc8cc64-7c06-4bbd-b002-c8a8e0385714";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "397-81ce6485f85b929fb617496627953920-1024-1024.webp", nice: "naez-munequeras-skincare-display-6-colores.webp" },
  { local: "398-f7155719f29067afef17496627953406-480-0.webp",      nice: "naez-munequeras-skincare-frutilla-detalle.webp" },
];

const variantSpecs = [
  { name: "Rosa pastel", color_hex: "#F4C5D2", stock: 5 },
  { name: "Fucsia",      color_hex: "#E91E63", stock: 5 },
];

const payload = {
  name: "Muñequeras de Peluche para Skincare con Frutillas — Naez (par)",
  slug: "naez-munequeras-peluche-skincare-frutillas",
  description:
    "Muñequeras de **peluche** Naez 🍓💗 para skincare — **par de muñequeras** que evitan que se te chorree el agua por los brazos cuando te lavás la cara o aplicás skincare. Bordadas con frutillitas cute. Vibes Y2K-coquette skincare ritual. ¡Hello Girlie!\n\n¿Te pasa que cuando te lavás la cara o aplicás tónicos/sprays se te chorrean las gotas por los antebrazos? Las muñequeras absorbentes lo solucionan en segundos. Tendencia K-Beauty.\n\nCaracterísticas:\n\n- 🍓 **Bordado frutilla** roja con hojita verde en relieve\n- 🧸 **Peluche súper suave** — material microfibra absorbente\n- 💧 **Absorben el agua** mientras te lavás la cara / aplicás skincare\n- 🌸 **Par de muñequeras** (vienen 2 unidades por blister Naez)\n- 🎀 Elásticas ajustables — sirven a cualquier muñeca\n- 📦 Vienen en blister rosa/lila individual marca Naez\n- ✨ Look cute para tus rutinas de skincare (perfectas para fotos/videos)\n\n⚠ Stock limitado: solo 10 pares en total (5 por color).\n\nDisponible en 2 colores. Elegí el tuyo al agregar al carrito:\n\n- **Rosa pastel** — peluche rosa suave con frutillas\n- **Fucsia** — peluche fucsia vibrante con frutillas\n\nModo de uso:\n\n1. Ponete una muñequera en cada antebrazo, justo por encima de la muñeca.\n2. Lavate la cara / aplicá tónico / aplicá serum como siempre.\n3. Las muñequeras absorben las gotitas que se chorrean — chau brazos mojados.\n4. Sacalas, escurrilas y dejalas secar al aire.\n\nLavado: a mano con agua tibia y jabón neutro. Dejá secar al aire.\n\nTip: úsalas también para:\n\n- 💄 Maquillarse (evita marcas de base en la ropa)\n- 🧖 Limpieza facial profunda (no se te van gotas a la manga)\n- 🦷 Lavarse los dientes (las hijas de la casa lo agradecen)\n\nIdeal regalo coquette para una amiga skincare-lover.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 2500,
  compare_price: 4000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 40,
  length_cm: 15,
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

  const variantReferenceImage = galleryUrls[0];
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock total:", totalStock);

  await postRest("product_categories", [
    { product_id: product.id, category_id: ACCESORIOS_CATEGORY_ID, is_primary: true },
    { product_id: product.id, category_id: PARA_NINAS_CATEGORY_ID, is_primary: false },
  ]);
  console.log("  Categorías: Accesorios (primaria) + Para Niñas");

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
