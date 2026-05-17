import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "tmp_b64_305aafc2-667d-45bf-8648-038d92a67418_3241961_3367588-662ebcb53e36466a3217626929658087-640-0.webp", nice: "mely-spray-facial-vitamina-c-hero.webp" },
  { local: "tmp_b64_40b205fb-a869-4015-a3cb-0e238edbc6b4_3241961_3367588-bbd5970bc694f880da17626929743814-640-0.webp", nice: "mely-spray-facial-vitamina-c-detalle.webp" },
];

const payload = {
  name: "Spray Facial con Vitamina C — Iluminador e Hidratante — Mely Skincare",
  slug: "mely-spray-facial-vitamina-c-80ml",
  description:
    "Spray Facial con **Vitamina C** de Mely Skincare 🍊✨ — bruma facial con activo antioxidante por excelencia. **Ilumina e hidrata** la piel. Combate manchas, opacidad y daño solar. Vibes pastel lila aesthetic con un toque cítrico naranja.\n\n**Contenido neto:** 80 ml en frasco lila/violeta con cap rosa pastel y spray ultra fino.\n\nActivo estrella:\n\n- 🍊 **Vitamina C (Ácido Ascórbico)** — antioxidante #1 del skincare. Ilumina, atenúa manchas, neutraliza radicales libres (causa principal de envejecimiento), estimula colágeno natural\n\nBeneficios:\n\n- 🌟 **Glow iluminador inmediato** — efecto piel jugosa cítrica\n- 🎯 **Unifica el tono** — atenúa manchas y marcas\n- 🛡️ **Antioxidante** — protege contra daño ambiental (UV, contaminación)\n- 💧 Hidrata sin sensación grasa\n- 🌬️ Spray ultra fino — distribución uniforme\n- 💄 Apto pre-makeup y como fijador con finish dewy\n- 🩷 Apto piel sensible (fórmula suave, no irritante)\n- 🇦🇷 Marca Mely Skincare\n\n⚠ Stock muy limitado: solo 2 unidades.\n\nModo de uso (multi-función):\n\n**1) Tónico facial mañana (después del cleanser):**\n- A 20cm de la cara con ojos cerrados, 2-3 disparos.\n- Palmaditas suaves. Esperá 30 seg antes del siguiente paso.\n\n**2) Antes del sérum/hidratante:**\n- Aplicá el spray sobre la piel húmeda — potencia la absorción de los activos siguientes.\n\n**3) Pre-maquillaje:**\n- 2-3 disparos después del hidratante — la base se difumina mejor y la piel queda glow.\n\n**4) Fijador de make:**\n- Al final, 2-3 disparos — finish dewy luminoso.\n\n**5) Refrescante mid-day:**\n- Un disparo cuando la piel está apagada — no arruina el maquillaje.\n\nSinergia perfecta:\n\n- ☀️ **Vitamina C de día** + **SPF 50+** = combo antiaging máximo (la Vit C potencia la protección solar)\n- 🌙 **Vitamina C noche** + retinol (de tu rutina) = atenúa manchas y previene marcas\n\nTip: guardalo en lugar oscuro y fresco — la Vitamina C se oxida con la luz. Si el líquido se pone naranja oscuro o marrón, oxidación = perdió eficacia.\n\nDiferencia entre los **3 sprays Mely** disponibles en la tienda:\n\n- 🌹 **Agua de Rosas** → calmar + tonificar (piel sensible/reactiva)\n- 💧 **Hialurónico** → hidratación profunda (piel deshidratada/madura)\n- 🍊 **Vitamina C** → iluminar + antimanchas (piel apagada / con manchas / antiaging)\n\nÍtem Mely MY893028.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 5200,
  compare_price: 8000,
  stock: 2,
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
