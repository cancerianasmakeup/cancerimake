import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

// Solo imágenes con branding TEI (la "2-..." es Maybelline → la saltamos)
const files = [
  { local: "WhatsApp-Image-2026-03-12-at-13.16.19-800x800.jpeg", nice: "tei-grippy-serum-display.jpeg" },
  { local: "4-ec2db70ecf5675c62617605402317285-1024-1024.webp",  nice: "tei-grippy-serum-collagen.webp" },
  { local: "3-d9e1c103b84701ced017605402383951-1024-1024.webp",  nice: "tei-grippy-serum-niacinamide-panthenol.webp" },
];

const payload = {
  name: "Grippy Serum — TEI Cosmética (24h Long-Lasting)",
  slug: "tei-grippy-serum-niacinamida-pantenol",
  description:
    "Grippy Serum de TEI Cosmética — un serum facial hidratante con niacinamida y pantenol que se posicionó como uno de los más buscados del último año. Pensado para mujeres libres que arman su rutina skincare con activos que cumplen, no humo.\n\nActivos clave:\n\n- ✨ Niacinamida — ilumina, unifica el tono y le da a la piel un aspecto saludable y radiante\n- 💧 Pantenol — hidrata profundo y retiene la humedad por hasta 24 horas\n\nQué hace:\n\n- Hidrata profundamente la piel\n- Mejora la luminosidad y el tono\n- Suaviza, nutre y deja la piel con aspecto fresco durante todo el día\n- Bonus: se usa también como base de make-up — ayuda a que la base \"agarre\" mejor (de ahí el nombre Grippy)\n\nModo de uso: aplicá 3-4 gotas sobre la piel limpia (mañana y/o noche). Masajeá hasta absorber y seguí con tu hidratante o base de maquillaje. Apto para todo tipo de piel.\n\nFrasco con gotero de vidrio rosa transparente, súper lindo para el tocador. Aprobado ANMAT 🐰 Cruelty Free.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 5400,
  compare_price: 7000,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 80,
  length_cm: 10,
  width_cm: 4,
  height_cm: 4,
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

(async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  });
  console.log(`Procesando: ${payload.name}`);
  const urls = [];
  for (const f of files) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2:", url);
    urls.push(url);
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ ...payload, images: urls }]),
  });
  if (!res.ok) throw new Error(`Insert failed (${res.status}): ${await res.text()}`);
  const inserted = await res.json();
  console.log("  ID:", inserted[0].id, "  slug:", inserted[0].slug);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
