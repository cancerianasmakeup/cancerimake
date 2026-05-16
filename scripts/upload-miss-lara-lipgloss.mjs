// Sube las 4 fotos del Lip Gloss High-Glitter Miss Lara a R2,
// crea el producto en Supabase y devuelve el ID/slug.
//
// Variables tomadas del .env.local (web).

import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const downloadsDir = "C:/Users/LIYO/Downloads";
const files = [
  "WhatsApp-Image-2026-02-17-at-15.42.40.jpeg",        // display completo
  "672173157_1566522632141363_7740730046168400768_n.jpg", // 5 tonos close-up
  "672687306_1566522638808029_8584117880933934525_n.jpg", // 3 tonos (rosa/dorado/rosa)
  "672688156_1566522628808030_3286890398279424193_n.jpg", // 3 tonos (lila/magenta/cobre)
];

function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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

async function uploadToR2(client, filepath) {
  const original = path.basename(filepath);
  const sanitized =
    sanitizeFileName(`miss-lara-lipgloss-high-glitter-${original}`) || "image";
  const key = `${R2.prefix}/${Date.now()}-${sanitized}`;
  const body = await fs.readFile(filepath);
  await client.send(
    new PutObjectCommand({
      Bucket: R2.bucket,
      Key: key,
      Body: body,
      ContentType: contentTypeFor(original),
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return buildPublicUrl(R2.publicBaseUrl, key);
}

async function insertProduct(images) {
  const body = [
    {
      name: "Lip Gloss High-Glitter — Miss Lara",
      slug: "lip-gloss-high-glitter-miss-lara",
      description:
        "El brillo labial Lip Gloss High-Glitter de Miss Lara es un must para mujeres libres que aman el shine sin compromiso. Fórmula hidratante con micro-glitter multidimensional que refleja la luz desde cualquier ángulo y deja los labios con efecto vidrio. Aplicador doe-foot suave que distribuye el producto parejo y se siente cómodo durante horas. Disponible en una paleta versátil que va del rosa nude al fucsia vibrante, pasando por dorados cálidos y lilas frescos: ideal para sumar a un look natural o cerrar un make full glam. All you need is love, Miss Lara.",
      category_id: "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf", // Maquillaje
      price: 3600,
      compare_price: 4600,
      stock: 24,
      status: "active",
      is_featured: false,
      cost: 0,
      weight_grams: 35,
      length_cm: 8,
      width_cm: 3,
      height_cm: 3,
      images,
    },
  ];

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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert failed (${res.status}): ${text}`);
  }
  return res.json();
}

(async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2.accessKeyId,
      secretAccessKey: R2.secretAccessKey,
    },
  });

  console.log("Subiendo fotos a R2…");
  const urls = [];
  for (const f of files) {
    const full = path.join(downloadsDir, f);
    const url = await uploadToR2(client, full);
    console.log("  •", url);
    urls.push(url);
  }

  console.log("\nInsertando producto…");
  const product = await insertProduct(urls);
  console.log("Producto creado:", JSON.stringify(product, null, 2));
})().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
