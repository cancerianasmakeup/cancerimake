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

const SAPHIRUS_CATEGORY_ID = "59f56e54-33fd-4ee8-91b0-e2855411c92b";
const downloadsDir = "C:/Users/LIYO/Downloads";

const product = {
  file: "Gemini_Generated_Image_9kwh49kwh49kwh49.png",
  niceName: "body-splash-vanilla-zealot-250ml.png",
  payload: {
    name: "Body Splash Vanilla Zealot 250 ml",
    slug: "body-splash-vanilla-zealot-250ml",
    description:
      "Body Splash Vanilla Zealot 250 ml — una fragancia corporal gourmand intensamente dulce y cremosa, parte de la colección Give Me Gourmand. Pensada para mujeres libres que aman los aromas reposteros y quieren llevar un postre puesto durante todo el día.\n\nPirámide olfativa:\n\n- Notas de Salida: Azúcar de vainilla y crema de mantequilla\n- Notas de Corazón: Malvavisco derretido y pastel caliente\n- Notas de Fondo: Vainilla de Madagascar\n\nUna composición golosa con predominancia de vainilla y elementos reposteros: cálida, envolvente y muy adictiva. La estela se queda en la ropa y el ambiente — ideal para quienes quieren que las pregunten qué se pusieron.\n\nSpray vaporizador de 250 ml — práctico para llevar y refrescar el aroma durante el día. Diseño en tonos pastel con detalles dorados, perfecto para regalar.",
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
    weight_grams: 320, length_cm: 18, width_cm: 6, height_cm: 6,
    images: [imageUrl],
  }];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
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
