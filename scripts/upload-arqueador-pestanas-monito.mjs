import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "ChatGPT Image 17 may 2026, 06_48_25 a.m..png", nice: "arqueador-monito-lila-mango-rosa-glitter.png" },
];

const payload = {
  name: "Arqueador de Pestañas con Moñito 3D Lila — Edición Coquette (BH026)",
  slug: "arqueador-pestanas-monito-3d-lila-coquette",
  description:
    "Arqueador de Pestañas **edición coquette súper limitada** 🎀💜 — con **moñito 3D lila** con lunares mint en el mango. Vibes Y2K princess-core, fairycore aesthetic. Solo 1 unidad disponible — pieza única!\n\nViene en bolsita holográfica iridiscente individual. Estética dreamy total.\n\nCaracterísticas:\n\n- 🎀 **Moñito 3D lila con lunares mint** en el mango — diseño único coquette\n- 🪞 **Acero inoxidable** resistente — funciona como cualquier arqueador pro\n- 🪮 **Banda rosa pastel** de silicona en la base (curva las pestañas sin pellizcar)\n- 🩷 Mango rosa pastel con efecto glitter\n- 📦 Viene en bolsita holográfica iridiscente individual (perfecta para regalar)\n- ✨ Pieza única — solo 1 en stock\n\n⚠ Stock súper limitado: **solo 1 unidad** disponible. Cuando se va, se va.\n\nDiseño:\n\n- **Mango:** rosa pastel glitter con moñito 3D lila + lunares mint\n- **Base metálica:** acero plateado pro\n- **Goma curvadora:** rosa pastel\n\nModo de uso:\n\n1. Abrí el arqueador apretando los costados del mango.\n2. Posicioná las pestañas entre las dos placas, lo más cerca de la raíz que puedas.\n3. **Presioná y mantené 5-10 segundos** suavemente.\n4. Movelo hacia las puntas mientras seguís presionando (efecto C natural).\n5. ¡Listo! Aplicá máscara después.\n\nTip pro: **calentá el arqueador con secador 5 segundos antes de usar** — el calor sella el curl y dura mucho más (como planchita pero para pestañas).\n\nIdeal para:\n\n- 🎀 Coleccionistas de cosas cute\n- 📸 Fotos coquette / Y2K aesthetic\n- 🎁 Regalo único para alguien que ama lo distinto\n- 💜 Tu beauty drawer si te gusta el statement\n\nCuidados:\n\n- Limpiá con alcohol después de cada uso\n- Cambiá la goma curvadora cada 2-3 meses (se compra suelta y se intercambia)\n- Guardalo en la bolsita holográfica para preservar el moñito\n\nÍtem BH026.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 4000,
  compare_price: 6000,
  stock: 1,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 50,
  length_cm: 12,
  width_cm: 7,
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
