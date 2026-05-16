import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const SUPABASE_URL = "https://qccfsbjshlomvyfabtra.supabase.co";
const SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjY2ZzYmpzaGxvbXZ5ZmFidHJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg3ODQ1NSwiZXhwIjoyMDkzNDU0NDU1fQ.OV-VJ85BguDDZw9N1_H07D9VwwBEb6B_L0xKh4HIlzE";

const R2 = {
  accountId: "c80fd3d522f165db46f0eef13f65d471",
  accessKeyId: "7d6c0ba81c9ac18637e6bce6d565149c",
  secretAccessKey:
    "eaf21ba907858297f98bc8c94511b2847e30593a1b5998e120dd966432bf1064",
  bucket: "cancerianasmakeup",
  prefix: "CANCERIANAS PRODUCTOS",
  publicBaseUrl: "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev",
};

const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

const images = {
  banner:     { local: "e509e993-c459-4823-b6d8-e094d5749f7a.jpg",                  nice: "locion-corporal-swirled-banner.jpg" },
  nutritiva:  { local: "c09cb84a-85ff-48fd-a8fd-77923f994216.png",                  nice: "locion-swirled-nutritiva.png" },
  reafirmante:{ local: "ChatGPT Image 16 may 2026, 03_51_41 a.m..png",              nice: "locion-swirled-reafirmante.png" },
  reparadora: { local: "D_NQ_NP_2X_886835-MLA110124719798_042026-F.webp",            nice: "locion-swirled-reparadora.webp" },
};

const payload = {
  name: "Loción Corporal Swirled — Thelma & Louise 213 g",
  slug: "locion-corporal-swirled-thelma-louise-213g",
  description:
    "Loción Corporal Swirled de Thelma & Louise — 213 g de hidratación con ingredientes activos, en un frasco super lindo con la fórmula trenzada visible. Disponible en 3 versiones, cada una pensada para una necesidad de piel distinta. Para mujeres libres que cuidan el cuerpo con la misma dedicación que la cara.\n\nLas 3 versiones:\n\n- 🩵 Nutritiva — Hidrata, regenera y restaura. Con ceramidas y alantoína. Ideal para piel reseca, descamada o castigada por el invierno.\n- 💗 Reafirmante — Hidrata, tonifica y revitaliza. Con niacinamida y vitamina A. Ideal para piel madura o con falta de firmeza.\n- 💜 Reparadora — Hidrata, alivia y reconforta. Con ácido hialurónico y centella asiática. Ideal para piel sensible, irritada o post-sol.\n\nTextura cremosa de absorción media, sin sensación grasa. Pump higiénico que dosifica la cantidad justa. Contenido neto: 213 g.\n\nElegí tu variante favorita al agregar al carrito. Si querés más de una, agregalas al carrito por separado.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 11000,
  compare_price: 15000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 280,
  length_cm: 20,
  width_cm: 6,
  height_cm: 6,
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
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
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

  const urls = {};
  for (const [key, f] of Object.entries(images)) {
    const full = path.join(downloadsDir, f.local);
    urls[key] = await uploadToR2(client, full, f.nice);
    console.log(`  R2 (${key}):`, urls[key]);
  }

  const variants = [
    { name: "Nutritiva",   color_hex: "#B5D9F0", stock: 2, image_url: urls.nutritiva },
    { name: "Reafirmante", color_hex: "#F4C2C8", stock: 2, image_url: urls.reafirmante },
    { name: "Reparadora",  color_hex: "#C8A2D8", stock: 2, image_url: urls.reparadora },
  ];
  const totalStock = variants.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    // Portada = banner promo, después las 3 individuales
    images: [urls.banner, urls.nutritiva, urls.reafirmante, urls.reparadora],
  }]);
  console.log("  Product ID:", product.id, "  Stock total:", totalStock);

  const variantRows = variants.map((v) => ({
    product_id: product.id,
    name: v.name,
    attributes: { color_hex: v.color_hex },
    price_diff: 0,
    stock: v.stock,
    image_url: v.image_url,
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
