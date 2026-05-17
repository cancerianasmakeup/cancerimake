import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "2cd5fe0a-7102-4397-b406-f1274fed5189-5d0d63d995639b86c717648531250283-1024-1024.webp", nice: "mely-set-belleza-3-versiones-rosa-lila-naranja.webp" },
  { local: "2aba0137-01c8-4f9d-96f5-961240ad01b2-bf264de29d6c4ffd0d17647991002562-1024-1024-b158237152984936db17649432153783-1024-1024.webp", nice: "mely-set-belleza-contenido-broche-esponjas-puff.webp" },
];

const payload = {
  name: "Set de Belleza 4 piezas — 3 Esponjas + Broche Estrella — Mely Beauty (Rosa)",
  slug: "mely-set-belleza-3-esponjas-broche-estrella-rosa",
  description:
    "Set de Belleza Mely Beauty 💗⭐ — kit completo de **4 piezas** para tu base de maquillaje + un broche estrella cute para sumar al pelo. Todo en tonos rosa coordinados. Versión **ROSA / FUCSIA**.\n\nContenido del kit (4 piezas):\n\n- 💧 **1 esponja goteo rosa** — para base líquida, blending y acabado natural\n- 🥒 **1 esponja calabaza fucsia** — para corrector y zonas precisas (cintura del huevo para ojos)\n- 🤍 **1 puff triangular blanco con cinta rosa** — para polvos translúcidos y matificar\n- ⭐ **1 broche estrella rosa** — pinza tipo claw clip para pelo (matchea con todo)\n\nCaracterísticas:\n\n- 🧽 Esponjas en **3 formas distintas** — cada una con un uso específico\n- 💧 **Húmedas duplican tamaño** — sumergilas en agua tibia, estrujá el exceso\n- 🌸 Material microfibra suave que no absorbe demasiado producto\n- 📦 Viene en packaging Mely Beauty con sticker \"Set de belleza\"\n- 🇦🇷 Marca Mely Beauty\n\n⚠ Stock muy limitado: solo 12 sets disponibles.\n\nModo de uso:\n\n**Esponja goteo:**\n- Mojala con agua, estrujá. Aplicá base/BB cream con golpecitos (no arrastres). Usá la parte ancha para mejillas/frente y la punta para nariz.\n\n**Esponja calabaza:**\n- Para corrector en ojeras (parte ancha) y para zonas chicas como costados de la nariz (cintura del huevo).\n\n**Puff triangular:**\n- Para sellar la base con polvo translúcido. Presioná (no arrastres) en zona T.\n\n**Broche estrella:**\n- Claw clip resistente, sirve para todo tipo de pelo. Recogete media coleta o todo el pelo.\n\nLavado: lavá las esponjas con jabón neutro / shampoo cada 2-3 usos. Dejá secar al aire.\n\nÍtem Mely MYB9-0020.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 3700,
  compare_price: 4900,
  stock: 12,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 120,
  length_cm: 18,
  width_cm: 12,
  height_cm: 6,
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

  const [product] = await postRest("products", [{
    ...payload,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock:", product.stock);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: ACCESORIOS_CATEGORY_ID,
    is_primary: true,
  }]);
  console.log("  Categoría primaria: Accesorios");
})().catch((err) => { console.error("Error:", err); process.exit(1); });
