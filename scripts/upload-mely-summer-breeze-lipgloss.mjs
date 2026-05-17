import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "MY801067.jpg",   nice: "mely-summer-breeze-display-cover.jpg" },
  { local: "my8010671.webp", nice: "mely-summer-breeze-tubos-swatches.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Berry vino",     color_hex: "#7C2840", stock: 4 },
  { name: "Tono 02 — Nude rosado",    color_hex: "#D4A09A", stock: 4 },
  { name: "Tono 03 — Coral suave",    color_hex: "#E68A7E", stock: 4 },
  { name: "Tono 04 — Rosa medio",     color_hex: "#E26A8A", stock: 4 },
  { name: "Tono 05 — Fucsia vibrante", color_hex: "#D4376B", stock: 4 },
  { name: "Tono 06 — Cereza intenso",  color_hex: "#C42044", stock: 4 },
];

const payload = {
  name: "Lip Gloss Summer Breeze — Mely Beauty (MY801067)",
  slug: "mely-summer-breeze-lipgloss",
  description:
    "Lip Gloss Summer Breeze de Mely Beauty — brillo labial brillante + hidratante con formato squeeze tube rosa pastel súper cute. Para mujeres libres que aman labios jugosos con vibra fresh-summer. Brilla, hidrata y dura — el trío perfecto.\n\nCaracterísticas:\n\n- ✨ **Brillo intenso** — efecto labios cristal\n- 💧 **Hidratante** — fórmula que cuida, no reseca\n- 💋 Aplicador integrado tipo cánula con punta blanda — preciso y cómodo\n- 🌸 Tubo squeeze rosa pastel, fácil de dosificar (apretás y sale)\n- 🍑 Colección Summer Breeze — tonos pensados para los meses cálidos\n- 🐰 Cruelty Free\n\nDisponible en 6 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Berry vino (vino oscuro elegante)\n- **Tono 02** — Nude rosado (nude natural para uso diario)\n- **Tono 03** — Coral suave (coral pastel fresco)\n- **Tono 04** — Rosa medio (rosa-coral vibrante)\n- **Tono 05** — Fucsia vibrante (rosa-rojo intenso)\n- **Tono 06** — Cereza intenso (rojo cereza clásico)\n\nModo de uso: apretá ligeramente el tubo y aplicá una capa fina con el aplicador directo sobre los labios. Para look más jugoso, una segunda capa. Combina perfecto encima de tu labial mate favorito.\n\nCódigo Mely MY801067.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3100,
  compare_price: 3900,
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

  const galleryUrls = [];
  for (const f of galleryImages) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2 galería:", url);
    galleryUrls.push(url);
  }

  const variantReferenceImage = galleryUrls[1]; // swatches → mejor para variantes
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
