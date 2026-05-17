import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_924806-MLA87243182500_072025-F.webp",                                              nice: "tei-lifter-gloss-display-tonos.webp" },
  { local: "123-6b4a393a9ad664918f17649672268323-1024-1024.webp",                                         nice: "tei-lifter-gloss-tubos-detalle.webp" },
  { local: "D_NQ_NP_2X_880745-MLA104029137609_012026-F.webp",                                             nice: "tei-lifter-gloss-display-cover.webp" },
  { local: "img_1181-1c191cc23591b1ed3017450961203982-1024-1024-033cd53b8ec36b77b317465455439883-640-0.webp", nice: "tei-lifter-gloss-swatches.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Nude rosado",       color_hex: "#C99B8C", stock: 4 },
  { name: "Tono 02 — Rosa palo",         color_hex: "#CD8F8B", stock: 4 },
  { name: "Tono 03 — Berry mauve",       color_hex: "#9C5765", stock: 4 },
  { name: "Tono 04 — Mocha caramel",     color_hex: "#8E5A45", stock: 4 },
  { name: "Tono 05 — Rojo cereza",       color_hex: "#B83447", stock: 4 },
  { name: "Tono 06 — Vino burgundy",     color_hex: "#6E1F2C", stock: 4 },
];

const payload = {
  name: "Lifter Gloss — Brillo Labial Hidratante Efecto Volumen — TEI Cosmética",
  slug: "tei-lifter-gloss-teib1s2",
  description:
    "Lifter Gloss de TEI Cosmética — brillo labial **hidratante con efecto volumen óptico**. Filler Lifted Look: labios más llenos visualmente, no sticky, fórmula hidratante. Para mujeres libres que quieren glow + volumen sin pinchazos ni tratamientos. 💋✨\n\nCaracterísticas:\n\n- 💋 **Filler Lifted Look** — efecto labios más llenos al instante\n- 🌸 **Fórmula hidratante** — no reseca, deja los labios suaves\n- ✨ **No sticky feeling** — brillo intenso sin sensación pegajosa\n- 💎 Acabado glossy húmedo tipo cristal\n- 🎨 Aplicador doe-foot tipo brocha plana\n- 🔤 Envase color nude elegante con relieve **LIFTER**\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 6 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Nude rosado (rosa-beige natural)\n- **Tono 02** — Rosa palo (rosa suave)\n- **Tono 03** — Berry mauve (berry rosado mid)\n- **Tono 04** — Mocha caramel (caramelo cálido)\n- **Tono 05** — Rojo cereza (rojo vibrante)\n- **Tono 06** — Vino burgundy (vino oscuro elegante)\n\nModo de uso: aplicá una capa del centro hacia afuera. Para más volumen óptico, retocá en el centro del labio inferior (truco efecto plump). Para color más intenso, segunda capa.\n\nTip: usalo encima de un labial mate para combinar pigmento + glow + efecto volumen.\n\nÍtem TEI TEIB1S2.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3200,
  compare_price: 4000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 20,
  length_cm: 11,
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

  const variantReferenceImage = galleryUrls[3]; // swatches
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
