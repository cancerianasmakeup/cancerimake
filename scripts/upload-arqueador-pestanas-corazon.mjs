import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "AQAD-9984-14-430x430.jpg", nice: "arqueador-pestanas-corazon-3-colores.jpg" },
  { local: "images (2).jpg",            nice: "arqueador-pestanas-corazon-detalle-peine.jpg" },
];

const payload = {
  name: "Arqueador de Pestañas con Peine Integrado — Mango Corazón",
  slug: "arqueador-pestanas-mango-corazon-peine",
  description:
    "Arqueador de Pestañas con **Peine Integrado** y **Mango Corazón** 💖👁️ — herramienta pro de maquillaje que curva y separa las pestañas en un solo paso. Vibes coquette + práctico de verdad.\n\n¡La gran novedad es el **peine plástico rosa integrado** dentro de la base del arqueador! Mientras lo apretás, el peine separa las pestañas para que no se peguen — adiós pestañas \"pegoteadas\" después de arquear.\n\nCaracterísticas:\n\n- 💖 **Mango ergonómico con corazón** — agarre fácil, no resbala\n- 🪮 **Peine plástico rosa integrado** — separa las pestañas mientras arquea (no se pegan entre sí)\n- 🪞 Acero inoxidable resistente\n- 🎯 Curva ajustada al ojo — sirve para todo tipo de pestañas\n- ✋ Mecanismo a presión simple y suave\n- 🩷 Diseño cute pastel con detalle corazón\n- 🐰 Apto piel sensible\n\n⚠ Stock importante: 24 unidades disponibles.\n\nNota sobre colores: **color indistinto al stock** — viene en rosa pastel, blanco con corazón rosa o negro con corazón rosa (según disponibilidad). El producto funciona idéntico, lo que cambia es el color del mango.\n\nModo de uso:\n\n1. Abrí el arqueador apretando suave los costados.\n2. Colocá la pestaña entre las dos placas (la goma negra de adentro abraza la pestaña).\n3. **Presioná y mantené 5-10 segundos** suavemente sobre la raíz de la pestaña.\n4. Movelo levemente hacia las puntas mientras seguís presionando (efecto C natural).\n5. ¡Listo! Las pestañas quedan curvadas y separadas.\n6. Aplicá máscara/rímel después.\n\nTip pro: **calentá levemente el arqueador con un secador antes de usar** — el calor hace que el curl dure más (como una planchita de pelo pero para pestañas).\n\nMantención:\n\n- Cambiá la goma negra del arqueador cada 2-3 meses (se compra suelta y se intercambia).\n- Limpialo con alcohol después de cada uso para que no acumule maquillaje.\n\nIdeal para:\n\n- 👁️ Open eye look — efecto ojos despiertos\n- 📸 Antes de cualquier maquillaje de pestañas\n- 🎀 Skincare junkies que aman vibes coquette\n\nÍtem AQAD-9984.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 3600,
  compare_price: 5600,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 35,
  length_cm: 11,
  width_cm: 6,
  height_cm: 2,
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
