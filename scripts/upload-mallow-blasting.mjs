import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const SAPHIRUS_CATEGORY_ID = "59f56e54-33fd-4ee8-91b0-e2855411c92b";
const downloadsDir = "C:/Users/LIYO/Downloads";

const product = {
  file: "ChatGPT Image 16 may 2026, 03_26_03 a.m..png",
  niceName: "body-splash-mallow-blasting-110ml.png",
  payload: {
    name: "Body Splash Mallow Blasting 110 ml",
    slug: "body-splash-mallow-blasting-110ml",
    description:
      "Body Splash Mallow Blasting 110 ml — una fragancia corporal gourmand y dulce de la colección Sweet Gourmand, pensada para mujeres libres que aman los aromas reposteros con un toque de frutos rojos. Una mezcla cremosa, juguetona y muy adictiva, como un bombón de malvavisco con frutos rojos puesto en la piel.\n\nPirámide olfativa:\n\n- Notas de Salida: Fresa y frambuesa\n- Notas de Corazón: Fresia y malvavisco\n- Notas de Fondo: Vainilla, almizcle y crema batida\n\nLa estela es media, cálida y duradera. Ideal para uso diario, planes con amigas o cualquier momento donde quieras que la pregunten qué te pusiste.\n\nSpray vaporizador de 110 ml — formato ideal para llevar en la cartera y refrescar el aroma durante el día. Frasco transparente con tapón rosa metalizado y diseño en tonos pastel — una pieza que también queda lindo en el tocador.",
    price: 6000,
    compare_price: 9000,
  },
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

async function insertProduct(p, imageUrl) {
  const body = [{
    ...p.payload,
    category_id: SAPHIRUS_CATEGORY_ID,
    stock: 24, status: "active", is_featured: false, cost: 0,
    weight_grams: 200, length_cm: 15, width_cm: 5, height_cm: 5,
    images: [imageUrl],
  }];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Insert failed (${res.status}): ${await res.text()}`);
  return res.json();
}

(async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  });
  console.log(`Procesando: ${product.payload.name}`);
  const full = path.join(downloadsDir, product.file);
  const url = await uploadToR2(client, full, product.niceName);
  console.log("  R2:", url);
  const inserted = await insertProduct(product, url);
  console.log("  ID:", inserted[0].id, "  slug:", inserted[0].slug);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
