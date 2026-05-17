import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "MY890007.jpg",  nice: "mely-sakura-serum-caja-frasco-pack.jpg" },
  { local: "MY8900072.png", nice: "mely-sakura-serum-frasco-flores-cerezo.png" },
];

const payload = {
  name: "Sakura Facial Serum — Ácido Hialurónico + Niacinamida — Mely Skincare",
  slug: "mely-sakura-facial-serum-30ml",
  description:
    "Sakura Facial Serum de Mely Skincare 🌸 — sérum facial con extractos de **sakura (flor de cerezo)**, **ácido hialurónico** y **niacinamida**. Hidratación + luminosidad + unificación del tono. Vibes K-Beauty con ese romance de las cherry blossoms.\n\n**Contenido neto:** 30 ml en frasco de vidrio transparente con gotero blanco.\n\nActivos estrella:\n\n- 🌸 **Extractos de Sakura (Cerezo japonés)** — antioxidante, calma rojeces, ilumina el cutis\n- 💧 **Ácido Hialurónico** — hidratación profunda, atrapa humedad en las capas de la piel (relleno óptico de líneas finas)\n- ✨ **Niacinamida (Vitamina B3)** — unifica tono, controla brillo, minimiza poros visibles, fortalece la barrera cutánea\n\nBeneficios:\n\n- 💧 **Hidratación intensa** sin sensación grasa\n- 🌟 **Luminosidad inmediata** — piel glow\n- 🎯 **Unifica el tono** — atenúa manchas, marcas de acné, rojeces\n- 🩷 **Apto piel sensible** — fórmula libre de fragancias agresivas\n- 🌿 **Textura líquida absorción rápida** — no apelmaza el maquillaje\n- 🇦🇷 Marca Mely Skincare\n\n⚠ Stock muy limitado: solo 6 unidades.\n\nModo de uso:\n\n1. Limpiá tu cara con limpiador suave (mañana y noche).\n2. Aplicá 2-3 gotas del sérum en la palma o directo en mejillas / frente / mentón.\n3. Difuminá con palmaditas suaves (no arrastres). Esperá 30 segundos para que se absorba.\n4. Continuá con tu rutina: contorno de ojos → hidratante → protector solar (de día) / aceite-crema (de noche).\n\nFrecuencia: mañana y noche. Si tu piel es muy sensible, empezá 1 vez al día y subí.\n\nRutina perfecta: cleanser → **Sakura serum** → contorno de ojos → hidratante → SPF 50+ ☀️\n\nTip: guardalo en lugar fresco lejos de la luz directa para preservar los activos.\n\nÍtem Mely MY890007.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 7000,
  compare_price: 9000,
  stock: 6,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 110,
  length_cm: 12,
  width_cm: 4,
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
