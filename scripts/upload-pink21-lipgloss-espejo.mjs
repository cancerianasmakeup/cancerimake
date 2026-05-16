import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "CS6748.jpg",  nice: "pink21-lipgloss-espejo-tonos-anmat.jpg" },
  { local: "122123.png",  nice: "pink21-lipgloss-espejo-display.png" },
];

const variantSpecs = [
  { name: "Tono 01 — Transparente glow",    color_hex: "#F4E4D8", stock: 4 },
  { name: "Tono 02 — Rosa palo",             color_hex: "#D8919A", stock: 4 },
  { name: "Tono 03 — Rosa coral",            color_hex: "#C97A7E", stock: 4 },
  { name: "Tono 04 — Nude amaderado",        color_hex: "#B47567", stock: 4 },
  { name: "Tono 05 — Marrón rojizo",         color_hex: "#965244", stock: 4 },
  { name: "Tono 06 — Vino borgoña",          color_hex: "#5A2024", stock: 4 },
];

const payload = {
  name: "Lipgloss Brillo Labial con Espejo — Pink21 (CS6748)",
  slug: "pink21-lipgloss-brillo-labial-espejo-cs6748",
  description:
    "Lipgloss con Espejo de Pink21 — brillo labial súper jugoso con frasco transparente tipo cápsula y espejo incorporado en la tapa. Para mujeres libres que aman tener labial brilloso siempre a mano sin sacar el espejo de la cartera.\n\nCaracterísticas:\n\n- 💋 Acabado glossy ultra brilloso — efecto labios jugosos\n- 🪞 Tapa con espejo incorporado — retoque rápido en cualquier lado\n- 🌸 Fórmula no pegajosa — se siente liviana y cómoda\n- 💧 Color buildable — capas suaves para gloss tinted, capas múltiples para color full\n- ✨ Hidrata y deja sensación plump natural en los labios\n- 🐰 Cruelty Free · Aprobado ANMAT\n- 💎 Frasco transparente facetado con tapa tipo cúpula\n\nDisponible en 6 tonos de la línea nude-rosado-vino. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Transparente glow (sin color, solo brillo)\n- **Tono 02** — Rosa palo (rosa muy suave para uso diario)\n- **Tono 03** — Rosa coral (rosa cálido fresco)\n- **Tono 04** — Nude amaderado (nude rosado con fondo marrón)\n- **Tono 05** — Marrón rojizo (terracota cálido)\n- **Tono 06** — Vino borgoña (vino oscuro intenso, vibe noche)\n\nModo de uso: aplicá una capa fina con el aplicador. Para look más intenso, aplicá una segunda capa o usalo encima de tu labial mate favorito — el brillo y el espejo lo hacen el lipgloss más práctico para la cartera.\n\nÍtem Pink21 CS6748.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3600,
  compare_price: 4500,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 18,
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

  const variantReferenceImage = galleryUrls[0];
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, "  Stock total:", totalStock);

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
