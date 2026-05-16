import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const SAPHIRUS_CATEGORY_ID = "59f56e54-33fd-4ee8-91b0-e2855411c92b";
const downloadsDir = "C:/Users/LIYO/Downloads";

const product = {
  file: "1651233854t94yA7LM.png",
  niceName: "pink-sexy-scandal-sexy-sexy-100ml.png",
  payload: {
    name: "Perfume Pink Sexy Scandal Sexy Sexy 100 ml",
    slug: "perfume-pink-sexy-scandal-sexy-sexy-100ml",
    description:
      "Pink Sexy Scandal Sexy Sexy es una fragancia femenina floral-gourmand pensada para mujeres libres que se animan a brillar de noche. El frasco transparente con tapón plateado escultórico y la caja rosa metalizada le dan un aire chic y muy reconocible — un perfume que entra por los ojos antes que por la nariz.\n\nPirámide olfativa:\n\n- Notas de Salida: Gardenia y flor de azahar\n- Notas de Corazón: Miel\n- Notas de Fondo: Patchouli\n\nUna combinación dulce, floral y un poco golosa que deja una estela cálida y duradera. Ideal para salidas, eventos y noches que se acuerdan.\n\nEau de Parfum 100 ml (3.4 fl.oz) — Spray vaporizador.",
    price: 17000,
    compare_price: 22000,
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
    weight_grams: 350,
    length_cm: 12,
    width_cm: 7,
    height_cm: 7,
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
})().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
