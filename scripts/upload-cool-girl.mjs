import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const downloadsDir = "C:/Users/LIYO/Downloads";
const files = [
  // primero la edición rosa (más vendible / cover)
  "ChatGPT Image 16 may 2026, 02_40_19 a.m..png",
  // luego la edición dorada
  "ChatGPT Image 16 may 2026, 02_40_26 a.m..png",
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

async function uploadToR2(client, filepath, niceName) {
  const sanitized = sanitizeFileName(niceName) || "image";
  const key = `${R2.prefix}/${Date.now()}-${sanitized}`;
  const body = await fs.readFile(filepath);
  await client.send(
    new PutObjectCommand({
      Bucket: R2.bucket,
      Key: key,
      Body: body,
      ContentType: contentTypeFor(filepath),
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return buildPublicUrl(R2.publicBaseUrl, key);
}

async function insertProduct(images) {
  const body = [
    {
      name: "Perfume Cool Girl Eau de Parfum 90 ml",
      slug: "perfume-cool-girl-90ml",
      description:
        "Cool Girl 90 ml Eau de Parfum Natural Spray — una fragancia femenina pensada para mujeres libres que se animan a romper las reglas. Su packaging chic combina líneas limpias con detalles dorados y un tagline que lo dice todo: \"It's so good to be bad\".\n\nFamilia olfativa floral-frutal moderna, ideal para uso diario y para acompañar looks de noche. Spray vaporizador de 90 ml (2.8 fl.oz) que rinde un montón y deja una estela suave y duradera.\n\nDisponible en dos ediciones de caja a elección del local: rosa con bordes negros o blanca con bordes dorados — misma fragancia y mismo precio.",
      category_id: "59f56e54-33fd-4ee8-91b0-e2855411c92b", // Saphirus (perfumes)
      price: 21000,
      compare_price: 27000,
      stock: 24,
      status: "active",
      is_featured: false,
      cost: 0,
      weight_grams: 320,
      length_cm: 12,
      width_cm: 6,
      height_cm: 6,
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
  for (let i = 0; i < files.length; i++) {
    const full = path.join(downloadsDir, files[i]);
    const url = await uploadToR2(
      client,
      full,
      `cool-girl-90ml-edicion-${i === 0 ? "rosa" : "dorada"}.png`
    );
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
