import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "PZ17508-1.jpg", nice: "citygirl-liploop-porta-gloss-5-colores.jpg" },
];

const variantSpecs = [
  { name: "Rosa",   color_hex: "#F4B6C2", stock: 3 },
  { name: "Coral",  color_hex: "#E76A5C", stock: 1 },
  { name: "Fucsia", color_hex: "#E91E63", stock: 1 },
];

const payload = {
  name: "LipLoop — Porta Gloss para Celular Flat Clip — City Girl",
  slug: "citygirl-liploop-porta-gloss-celular",
  description:
    "LipLoop de City Girl 💄📱 — \"Your gloss goes where you go\". Clip plano de silicona que se pega al dorso de tu celular y sostiene tu lipgloss/labial favorito para llevarlo siempre con vos. Hello Girlie! 💕\n\nLa solución más cute al problema clásico: querer retocar el labial pero el gloss está perdido en el fondo de la cartera. Ahora viaja pegado al cel.\n\nCaracterísticas:\n\n- 💄 **Flat Clip diseñado para labiales mini** — entran lipglosses tipo bullet, lip oil mini, lip balm cilíndrico\n- 📱 **Se pega al celular** con adhesivo reposicionable\n- 🎨 **Diseño cute** con sticker \"Hello Girlie!\"\n- 🧴 Material silicona suave — no raya el celu ni el labial\n- 📦 Viene en blíster individual City Girl\n\n⚠ Stock muy limitado: solo 5 unidades disponibles.\n\nDisponible en 3 colores:\n\n- **Rosa** — rosa pastel suave (3 unidades)\n- **Coral** — rosa-coral cálido (1 unidad)\n- **Fucsia** — pink intenso (1 unidad)\n\nModo de uso:\n\n1. Despegá el film del adhesivo trasero.\n2. Pegá el LipLoop al dorso de tu celular o funda (limpiá la superficie antes).\n3. Presioná suave 10 segundos para que adhiera bien.\n4. Insertá tu labial mini favorito en el loop y listo.\n\nTip: combinalo con el Sweet Charm Lipgloss o el Bunny Lipgloss (también de Pink21) — entra perfecto en el loop.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 3000,
  compare_price: 5000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 30,
  length_cm: 10,
  width_cm: 7,
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
    category_id: ACCESORIOS_CATEGORY_ID,
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
