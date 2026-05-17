import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "1758807493634-my893025-1-jpgweb.webp", nice: "mely-sunscreen-stick-display-12-rosas.webp" },
  { local: "1758807493867-my893025-2-jpgweb.webp", nice: "mely-sunscreen-stick-abierto-detalle.webp" },
];

const payload = {
  name: "Sunscreen Stick — Protector Solar en Barra — Mely Skincare",
  slug: "mely-sunscreen-stick-protector-solar-barra",
  description:
    "Sunscreen Stick de Mely Skincare 🌞💗 — **protector solar facial en barra**, formato práctico para llevar todo el día. Aplicación rápida sin manos sucias, ideal para **retocar el SPF encima del maquillaje**. Apto todo tipo de piel. Vibes K-Beauty ese-stick-de-spf-en-la-cartera-aesthetic.\n\nCaracterísticas:\n\n- ☀️ **Formato stick (barra)** — aplicación directa, sin grasa en las manos\n- 🌸 **Para retocar SPF encima del maquillaje** — no arruina la base, no deja grumos\n- 💧 **Apto todo tipo de piel** (mixta, seca, grasa, sensible)\n- 🩷 **Tubo rosa cute** con barra blanca\n- 🌬️ Textura ligera transparente — no deja efecto blanqueador (white cast)\n- ✋ **Mecanismo de giro** — sube el producto a medida que se gasta\n- 📦 Formato compacto — entra en cualquier cartera\n- 🇦🇷 Marca Mely Skincare\n\n⚠ Stock muy limitado: solo 8 unidades.\n\nModo de uso:\n\n**Aplicación base (de la rutina mañana):**\n1. Después de tu sérum + hidratante, girá la base del stick para que asome producto.\n2. Pasalo directamente por la cara (frente, mejillas, mentón, nariz, cuello).\n3. Difuminá con los dedos o esponja húmeda para uniformar.\n\n**Retoque encima del maquillaje (durante el día):**\n1. Pasalo suavemente sobre las zonas más expuestas (frente, mejillas, nariz).\n2. NO difumines — dejá que se absorba solo para no arruinar la base.\n3. Reaplicá cada 2 horas si estás al sol directo.\n\nIdeal para:\n\n- 🏖️ Playa / pileta / outdoor (reaplicar cada 2hs)\n- 🚗 Llevarlo en la cartera o auto\n- 💄 Retocar SPF encima de la base de maquillaje\n- 👶 Aplicar a chicos sin pelearse con la crema\n\n⚠ Importante: el SPF es el mejor antiaging del mundo. Usá protector solar TODOS los días, incluso si está nublado. Tu skin futura te lo va a agradecer.\n\nÍtem Mely MY893025.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 5200,
  compare_price: 8000,
  stock: 8,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 30,
  length_cm: 8,
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

  const [product] = await postRest("products", [{
    ...payload,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock:", product.stock);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: SKINCARE_CATEGORY_ID,
    is_primary: true,
  }]);
  console.log("  Categoría primaria: Skincare");
})().catch((err) => { console.error("Error:", err); process.exit(1); });
