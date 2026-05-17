import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "1758807748217-my893026-1-jpgweb.webp", nice: "mely-spray-facial-agua-rosas-hero.webp" },
  { local: "1758807748933-my893026-2-jpgweb.webp", nice: "mely-spray-facial-agua-rosas-abierto-cap.webp" },
];

const payload = {
  name: "Spray Facial con Agua de Rosas — Hidratante — Mely Skincare",
  slug: "mely-spray-facial-agua-de-rosas",
  description:
    "Spray Facial con **Agua de Rosas** de Mely Skincare 🌹💗 — bruma hidratante facial multi-uso. Hidrata, humecta y refresca tu piel al instante. Apto pre-maquillaje, refrescar durante el día, fijar el maquillaje y calmar la piel post-sol. Vibes K-Beauty floral aesthetic.\n\nActivo estrella:\n\n- 🌹 **Agua de Rosas** — hidratante natural, calma rojeces, tonifica el cutis, propiedades antiinflamatorias suaves\n\nBeneficios:\n\n- 💧 **Hidrata y humecta** la piel al instante\n- ❄️ **Refresca y revitaliza** — sensación cool inmediata\n- 🌸 **Tonifica el cutis** — equilibra el pH después del cleanser\n- 🎨 **Fija el maquillaje** — última capa después de la base/polvos\n- ☀️ **Calma post-sol** — la rosa baja el calor superficial\n- 🌬️ Spray ultra fino — distribución uniforme sin gotitas\n- 🩷 Apto piel sensible — fórmula suave\n- 🇦🇷 Marca Mely Skincare\n\n⚠ Stock muy limitado: solo 2 unidades.\n\nModo de uso (multi-función):\n\n**1) Tónico facial (después del cleanser):**\n- Sostené el frasco a 20cm de la cara con ojos cerrados, hacé 2-3 disparos.\n- No te seques con toalla — palmaditas suaves o dejá secar al aire.\n\n**2) Pre-maquillaje (después del hidratante):**\n- Aplicá 2-3 disparos sobre la cara antes de la base — ayuda a que se difumine mejor.\n\n**3) Fijador de maquillaje (al final de la rutina makeup):**\n- 2-3 disparos para sellar el maquillaje y darle finish glow natural.\n\n**4) Refrescante durante el día:**\n- Cuando sentís la piel apagada/seca, hacé un disparo. NO arruina el maquillaje.\n\n**5) Calmar post-sol:**\n- Aplicá generosamente sobre la piel rojiza/caliente después de la playa.\n\nTip beauty: guardalo en la heladera — el efecto frío refresca mucho más, ideal para verano y para deshinchar la cara matinal.\n\nÍtem Mely MY893026.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 5200,
  compare_price: 8000,
  stock: 2,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 90,
  length_cm: 14,
  width_cm: 5,
  height_cm: 5,
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
