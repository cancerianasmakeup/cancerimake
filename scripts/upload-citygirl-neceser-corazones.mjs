import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_845018-CBT88089064983_072025-F.webp", nice: "citygirl-neceser-corazones-3-colores.webp" },
  { local: "D_NQ_NP_2X_990810-CBT92202149879_092025-F.webp", nice: "citygirl-neceser-corazones-negro-detalle.webp" },
];

const variantSpecs = [
  { name: "Negro",   color_hex: "#1A1A1A", stock: 1 },
  { name: "Blanco",  color_hex: "#FAFAFA", stock: 1 },
  { name: "Rosa",    color_hex: "#F4B6C2", stock: 1 },
];

const payload = {
  name: "Neceser Portacosméticos Corazones — City Girl",
  slug: "citygirl-neceser-portacosmeticos-corazones",
  description:
    "Neceser Portacosméticos Corazones de City Girl — \"Fashion on Your Terms\" 💕. Cosmetiquero clásico con estampa de corazones en relieve, cierre lateral y formato rectangular para que todo entre. Para mujeres libres que aman lo cute con un toque retro.\n\nCaracterísticas:\n\n- 💞 **Estampa de corazones** en relieve, súper aesthetic\n- 🎀 Cierre lateral con tirador metálico\n- 📦 Formato rectangular — ideal para guardar labiales, máscaras, brochas pequeñas, parlantes BT, lo que necesites\n- 🏷️ Etiqueta colgante \"City Girl\" con tagline\n- ✨ Material tipo malla con bordados\n\nDisponible en 3 colores. Elegí el tuyo al agregar al carrito:\n\n- **Negro** — clásico con corazones tono sobre tono\n- **Blanco** — limpio y minimal\n- **Rosa** — pastel romántico\n\nIdeal para regalar 🎁 — incluye etiqueta colgante hermosa. Combina con cualquier estilo.\n\n⚠ Stock muy limitado: 1 unidad por color.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 7000,
  compare_price: 10000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 100,
  length_cm: 20,
  width_cm: 10,
  height_cm: 10,
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

  const variantReferenceImage = galleryUrls[0];
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock total:", totalStock);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: ACCESORIOS_CATEGORY_ID,
    is_primary: true,
  }]);

  const variantRows = variantSpecs.map((v) => ({
    product_id: product.id,
    name: v.name,
    attributes: { color_hex: v.color_hex },
    price_diff: 0,
    stock: v.stock,
    image_url: variantReferenceImage,
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
