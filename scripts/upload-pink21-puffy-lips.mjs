import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID  = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const PARA_NINAS_CATEGORY_ID  = "efc8cc64-7c06-4bbd-b002-c8a8e0385714";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "CS7071.jpg",                                  nice: "pink21-puffy-lips-display-cover.jpg" },
  { local: "a7b6df37-cbfb-4972-8e32-5da90690d597.png",    nice: "pink21-puffy-lips-infografia.png" },
];

const variantSpecs = [
  { name: "Rosa palo",   color_hex: "#F4C7C9", stock: 8 },
  { name: "Rosa fucsia", color_hex: "#D67BAE", stock: 8 },
  { name: "Cereza",      color_hex: "#C42044", stock: 8 },
];

const payload = {
  name: "Puffy Lips Lipgloss con Pompón — Pink21",
  slug: "pink21-puffy-lips-lipgloss-pompon",
  description:
    "Puffy Lips Lipgloss de Pink21 — brillo labial con efecto labios carnosos y pompón colgante en la tapa. Glossy, girly, irresistible 💗. Para chicas y mujeres libres que aman lo cute y los labios que dejan estela de brillo.\n\nCaracterísticas:\n\n- 💋 High shine gloss finish — brillo intenso tipo cristal\n- 🪶 Fórmula lightweight & non-sticky — no se siente pegajoso\n- 🎀 Adorable pom-pom charm — pompón colgante en la tapa\n- 💖 Efecto labios carnosos (plump natural)\n- 🐰 Cruelty Free\n\nDisponible en 3 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Rosa palo** — rosa baby translúcido para uso diario\n- **Rosa fucsia** — rosa medio vibrante\n- **Cereza** — rojo cereza intenso\n\nIdeal para regalar a chicas — entra perfecto en cualquier neceser o cartera. El pompón funciona también como llavero o adorno para la cartera.\n\nModo de uso: aplicá una capa fina con el aplicador directo en los labios. Para look más jugoso, aplicá una segunda capa. Combina perfecto encima de cualquier labial mate.\n\nMarca Pink21 · Aprobado ANMAT.",
  category_id: MAQUILLAJE_CATEGORY_ID, // legacy field (trigger lo mantiene = primary)
  price: 3600,
  compare_price: 4700,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
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
  console.log("  Product ID:", product.id, "  Stock total:", totalStock);

  // Multi-categoría: Maquillaje (primary) + Para Niñas (secondary).
  await postRest("product_categories", [
    { product_id: product.id, category_id: MAQUILLAJE_CATEGORY_ID, is_primary: true  },
    { product_id: product.id, category_id: PARA_NINAS_CATEGORY_ID, is_primary: false },
  ]);
  console.log("  Categorías: Maquillaje (primary) + Para Niñas (secondary)");

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
