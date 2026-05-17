import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "1-823bd87c031945fa8c17561302471557-480-0.webp",     nice: "tei-lip-glaze-cover-display.webp" },
  { local: "2-6ac50cd0fb398965b417561299075045-1024-1024.webp", nice: "tei-lip-glaze-light-watery-texture.webp" },
  { local: "8-0b74add1b7088e147417561299163837-1024-1024.webp", nice: "tei-lip-glaze-4x-moist-ingredients.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Rosa transparente", color_hex: "#E5A89A", stock: 4, file: "3-51ce5a3d03c62fd78317561299455362-480-0.webp", nice: "tei-lip-glaze-tono-01.webp" },
  { name: "Tono 02 — Rosa cereza",       color_hex: "#CC4861", stock: 4, file: "4-ff9d63fdd5cc9024f817561299523172-480-0.webp", nice: "tei-lip-glaze-tono-02.webp" },
  { name: "Tono 03 — Berry mauve",       color_hex: "#A8475A", stock: 4, file: "5-897e830f09e06c991f17561299553423-480-0.webp", nice: "tei-lip-glaze-tono-03.webp" },
  { name: "Tono 04 — Peach nude",        color_hex: "#D88567", stock: 4, file: "6-7d3d5c17272961eb3417561299595947-480-0.webp", nice: "tei-lip-glaze-tono-04.webp" },
  { name: "Tono 05 — Rojo cereza",       color_hex: "#B82A33", stock: 4, file: "7-644aec41b817fe93b017561299636339-480-0.webp", nice: "tei-lip-glaze-tono-05.webp" },
  { name: "Tono 06 — Terracota rojizo",  color_hex: "#A0463A", stock: 4, file: null, nice: null }, // sin foto individual → cover
];

const payload = {
  name: "Lip Glaze Jelly Pudding — TEI Cosmética (8317)",
  slug: "tei-lip-glaze-jelly-pudding-8317",
  description:
    "Lip Glaze Jelly Pudding de TEI Cosmética — brillo labial textura jelly pudding tipo coreano que hidrata y da efecto plump al instante. \"Instantly fuller with a swipe\" — labios voluminosos en una sola pasada, sin necesidad de plumper aparte.\n\nCaracterísticas:\n\n- 💧 **Light watery texture** — fórmula líquida liviana, no pesa en los labios\n- 🌸 **Moisturizing & non-sticky** — hidrata profundo sin sensación pegajosa\n- ✨ **4X moist ingredients** — fórmula con 4 ingredientes hidratantes activos\n- 🫧 **Bubble glowy finish** — acabado tipo burbuja con brillo glaseado\n- 💖 **Light as bubble** — sensación ligera tipo pluma\n- ⏱️ **Long lasting** — duración prolongada con un solo retoque\n- 💎 Frasco transparente facetado tipo cápsula con tapa cristal\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 6 tonos jelly. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Rosa transparente (rosa suave casi translúcido, hidrato natural)\n- **Tono 02** — Rosa cereza (rosa-rojo vibrante con shimmer sutil)\n- **Tono 03** — Berry mauve (berry rosado con fondo amaderado)\n- **Tono 04** — Peach nude (durazno nude cálido)\n- **Tono 05** — Rojo cereza (rojo cherry con brillo)\n- **Tono 06** — Terracota rojizo (terracota rojizo profundo)\n\nModo de uso: aplicá una capa fina del centro hacia afuera con el aplicador. El gel se siente liviano y se absorbe creando efecto plump natural. Para look más intenso, aplicá una segunda capa después de unos segundos. Combina perfecto encima de un labial mate para potenciar brillo + volumen.\n\nÍtem TEI 8317.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2900,
  compare_price: 4200,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 15,
  length_cm: 9,
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

  const variantUrls = [];
  for (const v of variantSpecs) {
    if (!v.file) {
      variantUrls.push(galleryUrls[0]); // cover para tono sin foto individual
      continue;
    }
    const full = path.join(downloadsDir, v.file);
    const url = await uploadToR2(client, full, v.nice);
    console.log(`  R2 ${v.name}:`, url);
    variantUrls.push(url);
  }

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

  const variantRows = variantSpecs.map((v, i) => ({
    product_id: product.id,
    name: v.name,
    attributes: { color_hex: v.color_hex },
    price_diff: 0,
    stock: v.stock,
    image_url: variantUrls[i],
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
