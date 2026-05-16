import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const SAPHIRUS_CATEGORY_ID = "59f56e54-33fd-4ee8-91b0-e2855411c92b";
const downloadsDir = "C:/Users/LIYO/Downloads";

const product = {
  file: "Gemini_Generated_Image_9q72zw9q72zw9q72-510x483.png",
  niceName: "body-splash-berry-top-deco-250ml.png",
  payload: {
    name: "Body Splash Berry Top Deco 250 ml",
    slug: "body-splash-berry-top-deco-250ml",
    description:
      "Body Splash Berry Top Deco 250 ml — una fragancia corporal gourmand pensada para mujeres libres que aman los aromas dulces y juguetones. Pertenece a la colección Give Me Gourmand: un perfil olfativo cremoso, afrutado y muy parecido a un postre de fresa.\n\nPirámide olfativa:\n\n- Notas de Salida: Fresa y crema chantilly\n- Notas de Corazón: Mermelada de fresa, azúcar y flores blancas\n- Notas de Fondo: Vainilla y almizcle\n\nEl resultado es una estela dulce, cremosa y golosa que rinde un montón, ideal para usar durante el día o como toque final antes de salir. Spray vaporizador de 250 ml — práctico para tirar a la cartera y refrescar el aroma cuando quieras.\n\nPresentación premium con caja decorada en tonos rosados y rojos, perfecta para regalar.",
    price: 11700,
    compare_price: 23000,
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
    Bucket: R2.bucket,
    Key: key,
    Body: body,
    ContentType: contentTypeFor(filepath),
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return buildPublicUrl(R2.publicBaseUrl, key);
}

async function insertProduct(p, imageUrl) {
  const body = [{
    ...p.payload,
    category_id: SAPHIRUS_CATEGORY_ID,
    stock: 24,
    status: "active",
    is_featured: false,
    cost: 0,
    weight_grams: 320,
    length_cm: 18,
    width_cm: 6,
    height_cm: 6,
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
