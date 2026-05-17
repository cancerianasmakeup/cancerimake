import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_852757-MLA96968320132_112025-F.webp", nice: "pink21-contour-cream-display-cover.webp" },
  { local: "SaveClip.App_657245453_18084880424203362_4207574525705984385_n.jpg", nice: "pink21-contour-cream-display-mano.jpg" },
  { local: "50fdfb_f2becf2ba9674b5c833362236fd455a0_mv2.jpg", nice: "pink21-contour-cream-swatches-6-tonos.jpg" },
];

const variantSpecs = [
  { name: "Tono 01 — Caramelo claro",     color_hex: "#C7935F", stock: 4 },
  { name: "Tono 02 — Marrón medio",        color_hex: "#A06A42", stock: 4 },
  { name: "Tono 03 — Marrón cálido",       color_hex: "#8B5938", stock: 4 },
  { name: "Tono 04 — Marrón intenso",      color_hex: "#74462D", stock: 4 },
  { name: "Tono 05 — Marrón oscuro",       color_hex: "#604030", stock: 4 },
  { name: "Tono 06 — Cocoa profundo",      color_hex: "#503625", stock: 4 },
];

const payload = {
  name: "Contour Cream Stick — Pink21",
  slug: "pink21-contour-cream-stick",
  description:
    "Contour Cream Stick de Pink21 — barra de contorno en crema para esculpir el rostro con un acabado natural blendeable. Para mujeres libres que aman make-up con dimensión: pómulos altos, mandíbula definida, nariz sutilmente afinada.\n\nCaracterísticas:\n\n- 🤎 **Fórmula cremosa** — fácil de difuminar, no se cuartea\n- 🪄 **Stick para aplicar directo** — dibujás líneas en la piel y difuminás con esponja o brocha\n- 🎯 **Aplicación precisa** — la forma del stick permite trazo definido y control\n- ✨ Acabado satinado natural — no efecto polvo\n- 💎 Frasco rosa nude pastel — pieza linda para el tocador\n- 🐰 Cruelty Free · Aprobado ANMAT\n\nDisponible en 6 tonos del claro al oscuro. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Caramelo claro (para pieles muy claras)\n- **Tono 02** — Marrón medio (para pieles claras)\n- **Tono 03** — Marrón cálido (para pieles medias)\n- **Tono 04** — Marrón intenso (para pieles medias-oscuras)\n- **Tono 05** — Marrón oscuro (para pieles oscuras)\n- **Tono 06** — Cocoa profundo (para pieles muy oscuras)\n\nModo de uso (contour clásico):\n\n1. **Pómulos**: dibujá una línea bajo el hueso del pómulo, desde el oído hacia la boca (sin llegar). Difuminá hacia arriba con esponja húmeda.\n2. **Mandíbula**: trazá una línea debajo de la mandíbula desde la oreja hasta la barbilla. Difuminá hacia abajo (cuello).\n3. **Nariz**: dos líneas finas a los lados del puente nasal. Difuminá hacia adentro con dedo o brocha pequeña.\n4. **Frente**: línea en el nacimiento del pelo. Difuminá hacia arriba.\n\nTip pro: elegí un tono 1-2 sombras más oscuro que tu piel para un contour natural. Si querés efecto más drama, 3-4 tonos.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3800,
  compare_price: 5000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
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

  const variantReferenceImage = galleryUrls[2]; // swatches mano para identificar tonos
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
