import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "POCPT14054.jpg", nice: "pratys-portacosmeticos-peluche-7-colores.jpg" },
];

const variantSpecs = [
  { name: "Rosa pastel",  color_hex: "#F4B6C2", stock: 2 },
  { name: "Gris",          color_hex: "#A8A8A8", stock: 2 },
  { name: "Lila",          color_hex: "#C8A2D8", stock: 2 },
  { name: "Fucsia",        color_hex: "#E91E63", stock: 2 },
  { name: "Negro",         color_hex: "#1A1A1A", stock: 2 },
];

const payload = {
  name: "Portacosméticos Peluchito — Pratys Beauty (BW-24026)",
  slug: "pratys-portacosmeticos-peluchito-bw24026",
  description:
    "Portacosméticos Peluchito de Pratys Beauty — neceser tipo cosmetiquero con peluche extra suave y cierre con tirador holográfico. Para mujeres libres que aman lo cute y necesitan un lugar lindo para guardar todo el make.\n\nCaracterísticas:\n\n- 🐰 **Peluche suave** tipo \"pompom\" en relieve — textura mullida y abrazable\n- 🎀 Cierre holográfico iridiscente que combina con cualquier estética\n- 🏷️ Etiqueta colgante \"PRATYS\" con cordón decorativo\n- 🎒 Tamaño ideal para cartera/mochila — entran labiales, máscaras, bases, brochas chicas\n- ✨ Diseño en relieve con texturas que se sienten al tocarlo\n\nDisponible en 5 colores. Elegí el tuyo al agregar al carrito:\n\n- **Rosa pastel** — suave y femenino\n- **Gris** — neutro y elegante\n- **Lila** — pastel lavanda dreamy\n- **Fucsia** — pink intenso vibrante\n- **Negro** — clásico y minimal\n\nIdeal para regalar 🎁. Combina con cualquier estilo y se ve increíble en cualquier rincón del tocador.\n\nÍtem Pratys BW-24026 / POCPT14054.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 5400,
  compare_price: 8000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 80,
  length_cm: 22,
  width_cm: 12,
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
