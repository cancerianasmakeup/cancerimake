import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "ChatGPT Image 16 may 2026, 04_59_07 p.m..png", nice: "pink21-chocolate-lipgloss-cover-premium.png" },
  { local: "IMG_2360.jpeg",                                  nice: "pink21-chocolate-lipgloss-display.jpeg" },
  { local: "CS6758-.jpg",                                    nice: "pink21-chocolate-lipgloss-cs6758-anmat.jpg" },
];

const payload = {
  name: "Chocolate Lipgloss con Llavero — Pink21 (CS6758)",
  slug: "pink21-chocolate-lipgloss-cs6758",
  description:
    "Chocolate Lipgloss de Pink21 — brillo labial con shimmer tono chocolate y llavero/charm de chocolate colgante en la tapa. Sweet. Shiny. Irresistible. 🍫 Para mujeres libres que aman lo aesthetic y el aroma a chocolate.\n\nCaracterísticas:\n\n- ✨ **Glossy finish** — brillo intenso tipo cristal\n- 🍫 **Sweet chocolate-inspired charm** — colgante en forma de chocolate mordido con cadenita\n- 🎁 **Cute & collectible design** — coleccionable, ideal para regalar\n- 🤎 Tono marrón chocolate con shimmer dorado-cobrizo (efecto labios glaseados)\n- 💋 Fórmula gloss no pegajosa\n- 🐰 Cruelty Free · Aprobado ANMAT\n\nDisponible en 1 tono — el marrón chocolate icónico de la colección. Aplicador doe-foot tipo brocha para una aplicación precisa y pareja.\n\nModo de uso: aplicá una capa fina con el aplicador directo sobre los labios. Para un look más jugoso, aplicá una segunda capa. Combina perfecto encima de un labial mate nude o marrón para potenciar el brillo.\n\nÍtem Pink21 CS6758.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2500,
  compare_price: 3500,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 18,
  length_cm: 10,
  width_cm: 3,
  height_cm: 3,
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
  const urls = [];
  for (const f of files) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2:", url);
    urls.push(url);
  }

  const [product] = await postRest("products", [{ ...payload, images: urls }]);
  console.log("  Product ID:", product.id, " slug:", product.slug);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: MAQUILLAJE_CATEGORY_ID,
    is_primary: true,
  }]);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
