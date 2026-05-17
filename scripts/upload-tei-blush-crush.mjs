import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "3968b90c-8a27-4048-986d-61d4893db1cd.png", nice: "tei-blush-crush-cover-premium-4tonos.png" },
  { local: "TEI8426.jpg",                               nice: "tei-blush-crush-display.jpg" },
];

const variantSpecs = [
  { name: "Tono 01 — Dulce Durazno",  color_hex: "#E89A6B", stock: 6 },
  { name: "Tono 02 — Rosa Tierno",    color_hex: "#E29DA8", stock: 6 },
  { name: "Tono 03 — Coral Soft",     color_hex: "#E76A4F", stock: 6 },
  { name: "Tono 04 — Rosa Intenso",   color_hex: "#C9384E", stock: 6 },
];

const payload = {
  name: "Blush Crush Cloud Edition — TEI Cosmética (TEI8426)",
  slug: "tei-blush-crush-cloud-edition",
  description:
    "Blush Crush de TEI Cosmética — rubor en polvo de la Cloud Edition con formato compacto súper aesthetic en envase translúcido. Para mujeres libres que aman el efecto \"flushed cheeks\" natural sin caer en lo cargado.\n\nCaracterísticas:\n\n- 🌸 **Rubor suave y luminoso** — fórmula tipo \"cloud\" que se difumina como una nube\n- 🪶 **Textura ligera** — no marca, no apelmaza\n- ✨ **Acabado natural** — efecto piel sonrojada propia, sin que se vea \"plasta\"\n- 💞 **Fácil de difuminar** — buildable, capas suaves o intensas según el look\n- 📦 4.5 g · Sweet color · Cloud Edition\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 4 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Dulce Durazno (durazno cálido natural)\n- **Tono 02** — Rosa Tierno (rosa pastel suave)\n- **Tono 03** — Coral Soft (coral fresco para tonos cálidos)\n- **Tono 04** — Rosa Intenso (rosa-rojo vibrante para look definido)\n\nModo de uso:\n\n1. Cargá la brocha de rubor con producto y descargá el exceso.\n2. Aplicá en la zona alta del pómulo (\"manzanitas\") moviendo en círculos suaves hacia afuera.\n3. Difuminá los bordes hacia la sien para que no quede un parche definido.\n4. Para look más intenso, capeá una segunda pasada.\n\nTip: combiná dos tonos para crear tu propio rubor custom — por ejemplo, base de Dulce Durazno + un toque de Rosa Intenso en el centro para efecto sunkissed.\n\nÍtem TEI 8426.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3100,
  compare_price: 4000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 15,
  length_cm: 6,
  width_cm: 6,
  height_cm: 2,
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
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock total:", totalStock);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: MAQUILLAJE_CATEGORY_ID,
    is_primary: true,
  }]);

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
