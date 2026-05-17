import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "UT536108-430x430.jpg", nice: "modaclub-set-broches-flores-blister.jpg" },
];

const payload = {
  name: "Set de 3 Broches con Flores Tonos Tierra — Moda Club",
  slug: "modaclub-set-3-broches-flores-tonos-tierra",
  description:
    "Set de **3 broches con flores** de Moda Club 🌸🤎 — set de 3 clips chiquitos con motivo de flor 3D translúcida en **tonos tierra coordinados** (negro, caramelo, marrón humo). Vibes elegant minimal Y2K — quedan increíbles juntos para hacer un look hairstyle de varios broches.\n\nCaracterísticas:\n\n- 🌸 **3 broches por blister** — set completo coordinado\n- 🌹 **Flores translúcidas 3D** — material acetato semi-transparente\n- 🎨 **3 tonos tierra:** negro · caramelo ámbar · marrón humo\n- 📏 Tamaño chico — ideales para hacer **claw-clip stack** (varios juntos)\n- 🧷 Plástico firme — buen agarre sin lastimar el pelo\n- 📦 Vienen en blister Moda Club individual\n- ✨ Tendencia: usá 1, 2 o 3 al mismo tiempo en distintas secciones del pelo\n\n⚠ Stock limitado: solo 12 sets disponibles.\n\nLos 3 broches incluidos en cada set:\n\n- **Flor negra** — clip negro mate con flor negra translúcida\n- **Flor caramelo ámbar** — clip caramelo con flor traslúcida\n- **Flor marrón humo** — clip marrón ahumado con flor traslúcida\n\nIdeas para usarlos:\n\n**1) Look minimalista (1 broche):**\n- Recogete el pelo en media coleta con UNO solo (elegí el que matchee tu outfit).\n\n**2) Look mid-hairstyle (2 broches):**\n- Hacé 2 trenzas chiquitas en los costados y cerralas con 1 broche c/u (matchando o contrastantes).\n\n**3) Look full coquette (los 3 broches):**\n- Tomá secciones de pelo del costado y enganchá los 3 broches en cascada (uno arriba del otro). Vibes Pinterest mosaic aesthetic.\n\nIdeal para:\n\n- 🍂 Looks otoño / invierno con tonos tierra\n- 🎀 Looks coquette / Y2K\n- 📸 Fotos aesthetic\n- 🎁 Regalo grupal (set de 3 = 3 amigas pueden usar 1 c/u)\n\nÍtem Moda Club UT536108.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 2000,
  compare_price: 3000,
  stock: 12,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
  length_cm: 15,
  width_cm: 6,
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
    category_id: ACCESORIOS_CATEGORY_ID,
    is_primary: true,
  }]);
  console.log("  Categoría primaria: Accesorios");
})().catch((err) => { console.error("Error:", err); process.exit(1); });
