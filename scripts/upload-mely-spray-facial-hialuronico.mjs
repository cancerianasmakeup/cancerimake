import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "1758807617297-my893027-jpgweb1.webp", nice: "mely-spray-facial-hialuronico-hero.webp" },
  { local: "1758807616073-my893027-1-jpgweb.webp", nice: "mely-spray-facial-hialuronico-abierto-cap.webp" },
  { local: "1758807615985-my893027-2-jpgweb.webp", nice: "mely-spray-facial-hialuronico-inclinado.webp" },
];

const payload = {
  name: "Spray Facial con Ácido Hialurónico — Hidratante e Iluminador — Mely Skincare",
  slug: "mely-spray-facial-acido-hialuronico-80ml",
  description:
    "Spray Facial con **Ácido Hialurónico** de Mely Skincare 💧✨ — bruma hidratante facial premium. **Ilumina e hidrata** tu piel al instante. La versión hardcore del spray facial — con ácido hialurónico activo. Apto pre-maquillaje, refrescar durante el día, fijar el maquillaje y como base de hidratación profunda.\n\n**Contenido neto:** 80 ml en frasco con cap y boquilla spray ultra fino. Cruelty Free.\n\nActivo estrella:\n\n- 💧 **Ácido Hialurónico** — molécula que atrapa hasta 1000 veces su peso en agua. Hidratación profunda multi-capa, efecto relleno óptico de líneas finas, piel rebotante\n\nBeneficios:\n\n- 💧 **Hidratación profunda** — el hialurónico penetra a varias capas de la piel\n- ✨ **Efecto iluminador** — piel glow al instante\n- 🌬️ Spray ultra fino — distribución uniforme sin gotitas\n- 🎯 **Pre-maquillaje** — ayuda a difuminar mejor la base\n- 💄 **Fijador de maquillaje** — sella el make con finish dewy/glow\n- ❄️ **Refrescante** durante el día — hidrata sin arruinar el make\n- 🧴 Textura líquida absorción rápida\n- 🩷 Apto piel sensible · Vegan-friendly · Cruelty Free\n- 🇦🇷 Marca Mely Skincare\n\n⚠ Stock muy limitado: solo 3 unidades.\n\nModo de uso (multi-función):\n\n**1) Hidratante facial (después del cleanser):**\n- A 20cm de la cara con ojos cerrados, 2-3 disparos.\n- Palmaditas suaves para distribuir. Esperá 30 seg antes del próximo paso.\n\n**2) Pre-maquillaje (después del hidratante):**\n- 2-3 disparos antes de la base — la piel queda dewy y la base se difumina perfecto.\n\n**3) Fijador de maquillaje (al final del make):**\n- 2-3 disparos para sellar con finish glow. NO se mueve la base.\n\n**4) Refrescante mid-day:**\n- Cuando la piel se siente apagada/seca, un disparo. NO arruina el make.\n\n**5) Booster del sérum:**\n- Aplicá el spray ANTES del sérum — el hialurónico húmedo potencia la absorción del próximo activo.\n\nTip beauty: combinalo con el **Sakura Serum** o **Cherry Serum** de Mely. Aplicalo PRIMERO, sobre la piel húmeda el sérum penetra mejor.\n\nDiferencia con el **Spray Agua de Rosas** (también disponible en la tienda):\n\n- 🌹 **Rosas** → calmar rojeces + tonificar, ideal piel sensible/reactiva\n- 💧 **Hialurónico** → hidratación profunda + iluminación, ideal piel deshidratada/madura\n\nÍtem Mely MY893027.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 5400,
  compare_price: 8000,
  stock: 3,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 110,
  length_cm: 15,
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
