import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "my890012-6-954930b708e4d355be17770461734893-1024-1024.webp", nice: "mely-cherry-roll-on-eye-serum-hero-cerezas.webp" },
  { local: "my890012-1-alta-1d64688e3363dccb9317770461787032-480-0.webp", nice: "mely-cherry-roll-on-eye-serum-caja-tubo.webp" },
  { local: "my890012-3-alta-7404655d32eb6299c217770461785829-480-0.webp", nice: "mely-cherry-roll-on-eye-serum-aplicador-bolitas.webp" },
  { local: "my890012-4-alta-d50a942f79a2cfdb0317770461785790-480-0.webp", nice: "mely-cherry-roll-on-eye-serum-tubo-detalle.webp" },
];

const payload = {
  name: "Cherry Roll-On Eye Serum — Contorno de Ojos — Mely Skincare",
  slug: "mely-cherry-roll-on-eye-serum-15ml",
  description:
    "Cherry Roll-On Eye Serum 🍒👁️ de Mely Skincare — sérum **contorno de ojos** con aplicador **roll-on de bolitas metálicas frías**. Hidratación + nutrición + cuidado antiarrugas con cereza. Vibes pop coquette. Las bolitas metálicas de masaje deshinchan ojeras y bolsas matinales — efecto instantáneo. ✨\n\n**Contenido neto:** 15 ml en tubo rosa con punta roll-on triple metálica.\n\nActivos estrella:\n\n- 🍒 **Extractos de Cereza** — antioxidante alto en vitamina C, ilumina ojeras pigmentadas y combate radicales libres\n- 💧 **Ácido Hialurónico** — hidratación profunda del contorno (zona más fina del rostro)\n- 🧴 **Ceramidas** — restauran y refuerzan la barrera cutánea, calman irritación\n\nBeneficios:\n\n- ❄️ **Bolitas metálicas frías** — masaje linfático, deshincha bolsas en segundos\n- 💧 **Hidratación profunda** del contorno de ojos\n- 🌟 **Atenúa ojeras** y líneas finas\n- 🩷 Calma rojeces y sensibilidad de la zona\n- 🎯 **Aplicación higiénica** sin contacto con el dedo (no contamina el producto)\n- 🇦🇷 Marca Mely Skincare\n\n⚠ Stock muy limitado: solo 3 unidades.\n\nModo de uso:\n\n1. Con la cara limpia, sacá la tapa del tubo y agitá suavemente.\n2. **Tip frío:** guardá el tubo en la heladera — el frío potencia el efecto deshinchante.\n3. Pasá las bolitas metálicas en círculos suaves desde el lagrimal hacia la sien (ojeras y bolsas).\n4. Repetí en el surco arriba del ojo (línea bajo ceja) para hidratar.\n5. Esperá 1 min y seguí con tu rutina (hidratante + SPF).\n\nFrecuencia: mañana y noche, antes de la crema hidratante.\n\nMomentos ideales:\n\n- 🌅 **Mañana:** para desinflamar bolsas matinales y despertar la mirada.\n- 🌙 **Noche:** para regenerar el contorno mientras dormís.\n- ✈️ **Antes de un evento:** efecto deshinchante express.\n\nTip K-Beauty: aplicá un toque encima del hueso de la mejilla (ojeras profundas) y dejá actuar 2 minutos antes del corrector — fija mejor.\n\nÍtem Mely MY890012.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 5400,
  compare_price: 8000,
  stock: 3,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 50,
  length_cm: 13,
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
