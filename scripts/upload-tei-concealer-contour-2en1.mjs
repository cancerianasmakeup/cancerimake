import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_870690-MLA91050970326_092025-F.webp", nice: "tei-concealer-contour-2en1-display-6-tonos.webp" },
  { local: "D_NQ_NP_2X_927122-MLA91051227012_092025-F.webp", nice: "tei-concealer-contour-2en1-dual-action-precision.webp" },
  { local: "D_NQ_NP_2X_772889-MLA91051040034_092025-F.webp", nice: "tei-concealer-contour-2en1-contour-concealer-info.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Piel muy clara",   color_hex: "#E9C5A0", contour_hex: "#9A6A4A", stock: 4 },
  { name: "Tono 02 — Piel clara",        color_hex: "#E3B58D", contour_hex: "#8C5C3E", stock: 4 },
  { name: "Tono 03 — Piel media",        color_hex: "#D29A75", contour_hex: "#7A4E32", stock: 4 },
  { name: "Tono 04 — Piel media oscura", color_hex: "#BD8762", contour_hex: "#6E4329", stock: 4 },
  { name: "Tono 05 — Piel oscura",       color_hex: "#A37050", contour_hex: "#5C3722", stock: 4 },
  { name: "Tono 06 — Piel muy oscura",   color_hex: "#85593E", contour_hex: "#4A2C1B", stock: 4 },
];

const payload = {
  name: "Corrector + Contour Líquido 2 en 1 Dual — TEI Cosmética (8307)",
  slug: "tei-concealer-contour-dual-2en1-8307",
  description:
    "Dúo 2 en 1 de TEI Cosmética — **Concealer + Contour líquido en un solo envase**. Dual-Action Precision: corrector arriba 🤍 + contour abajo 🤎. Base de maquillaje flawless con un solo producto. Ideal para llevar en la cartera o viajar liviana. ✨\n\nCaracterísticas:\n\n- 🤍 **Lado 1 — Concealer (corrector)** — cubre ojeras, granitos, manchas, rojeces\n- 🤎 **Lado 2 — Contour (contorno)** — define pómulos, mandíbula, nariz, sombras naturales\n- ✨ **Three-dimensional facial features** — crea light & shadow naturales\n- 💧 Fórmula líquida cremosa — fácil de difuminar\n- 🪞 Aplicador doe-foot en cada extremo (uno para cada producto)\n- 🎨 6 tonos coordinados (concealer + contour que matchean tu piel)\n- 🔤 Envase dorado-bronce elegante con relieve **CONCEALER + CONTOUR**\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 6 tonos del más claro al más oscuro. Elegí el tuyo:\n\n- **Tono 01** — Piel muy clara (porcelain / fair)\n- **Tono 02** — Piel clara (light)\n- **Tono 03** — Piel media (medium)\n- **Tono 04** — Piel media oscura (medium tan)\n- **Tono 05** — Piel oscura (tan)\n- **Tono 06** — Piel muy oscura (deep)\n\nModo de uso:\n\n1. Sobre la base / piel limpia, aplicá el lado **concealer** en las zonas que querés iluminar (debajo de ojos, centro frente, mentón, sobre granitos).\n2. Difuminá con esponja o dedo dando golpecitos.\n3. Aplicá el lado **contour** en las zonas que querés sombrear (debajo del pómulo, costados de la nariz, mandíbula, sienes).\n4. Difuminá hacia arriba para efecto lifting.\n5. Fijá con polvo translúcido si necesitás.\n\nTip pro: si elegís un tono que no es exactamente el tuyo, el concealer podés usarlo como iluminador (1 tono más claro que tu piel) y el contour para sombrear.\n\nÍtem TEI 8307.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2700,
  compare_price: 3800,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 30,
  length_cm: 13,
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

  const variantReferenceImage = galleryUrls[0]; // display 6 tonos
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
    attributes: { color_hex: v.color_hex, contour_hex: v.contour_hex },
    price_diff: 0,
    stock: v.stock,
    image_url: variantReferenceImage,
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
