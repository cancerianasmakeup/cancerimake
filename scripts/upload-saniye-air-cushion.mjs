import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const SUPABASE_URL = "https://qccfsbjshlomvyfabtra.supabase.co";
const SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjY2ZzYmpzaGxvbXZ5ZmFidHJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg3ODQ1NSwiZXhwIjoyMDkzNDU0NDU1fQ.OV-VJ85BguDDZw9N1_H07D9VwwBEb6B_L0xKh4HIlzE";

const R2 = {
  accountId: "c80fd3d522f165db46f0eef13f65d471",
  accessKeyId: "7d6c0ba81c9ac18637e6bce6d565149c",
  secretAccessKey:
    "eaf21ba907858297f98bc8c94511b2847e30593a1b5998e120dd966432bf1064",
  bucket: "cancerianasmakeup",
  prefix: "CANCERIANAS PRODUCTOS",
  publicBaseUrl: "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev",
};

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

// Imágenes del producto (galería general)
const productImages = [
  { local: "unnamed-b742e075c22d8d028e17728097578412-1024-1024.webp",      nice: "saniye-cushion-mujer-uso.webp" },
  { local: "2df165_2d40caae442d4189bb431c349285eeb3_mv2.jpg",              nice: "saniye-cushion-abierto-editorial.jpg" },
  { local: "2df165_49d623fe1f2c4ee7af980931da182bf7_mv2.jpg",              nice: "saniye-cushion-puff-panda.jpg" },
  { local: "2df165_78ab10e5bebd46388affadb3d61dceb7_mv2.jpg",              nice: "saniye-cushion-wrist-swatches.jpg" },
  { local: "unnamed-e63e492a622ed041ed17728097642004-1024-1024.webp",      nice: "saniye-cushion-box-beneficios.webp" },
  { local: "a60e2d0e-599c-4451-8a68-0b78aa7be8e4-a6623b915c4b15309617728097452455-1024-1024.webp",
                                                                            nice: "saniye-cushion-box.webp" },
];

// Variantes con su foto individual
const variantSpecs = [
  { name: "Tono 01 — Light",       color_hex: "#F4D5BB", stock: 3, file: "2df165_cba20793af964347986fa69aaddd85f5_mv2.jpg", nice: "saniye-cushion-tono-01.jpg" },
  { name: "Tono 02 — Natural",     color_hex: "#E6C6A2", stock: 3, file: "2df165_d287bf8b52554d4d8d0852ba6639a929_mv2.jpg", nice: "saniye-cushion-tono-02.jpg" },
  { name: "Tono 03 — Beige medio", color_hex: "#DCB58D", stock: 3, file: "2df165_f9daa3c7159244ed9a9ea6d5bb0f695f_mv2.jpg", nice: "saniye-cushion-tono-03.jpg" },
  { name: "Tono 04 — Honey",       color_hex: "#CFA277", stock: 3, file: "2df165_00687204767e42dd93f6479c440f8037_mv2.jpg", nice: "saniye-cushion-tono-04.jpg" },
];

const payload = {
  name: "Air Cushion OMG! — Saniye (Cushion R6042)",
  slug: "air-cushion-omg-saniye-r6042",
  description:
    "Air Cushion OMG! de Saniye — el cushion compact con diseño tipo gatita (¡y puff panda incluido!) que se volvió un must para mujeres libres que aman un make-up rápido y prolijo. Cobertura ligera tipo segunda piel, acabado luminoso natural y FPS 30 PA++ para uso diario.\n\nBeneficios:\n\n- ☀️ Protección solar SPF 30 PA++\n- 💧 Fórmula hidratante (no reseca como las bases tradicionales)\n- ✨ Cobertura natural — luce piel, no maquillaje\n- 🌸 Formato cushion: aplicás con el puff incluido en segundos, sin retoques\n- 🐼 Puff con diseño de pandita súper kawaii\n\nIdeal para retoques durante el día — entra en la cartera y no se derrama. También funciona como base completa si la difuminás con varios golpecitos del puff.\n\nDisponible en 4 tonos para que encuentres tu match. Elegí el tuyo al agregar al carrito:\n\n- #01 — Light (piel muy clara)\n- #02 — Natural (piel clara neutra)\n- #03 — Beige medio (medio cálido)\n- #04 — Honey (medio oscuro)\n\nTip: si dudás entre dos tonos, elegí el más claro — la fórmula se adapta al tono natural de la piel con el calor corporal.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 6200,
  compare_price: 8500,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 80,
  length_cm: 9,
  width_cm: 9,
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
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
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
  for (const f of productImages) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2 galería:", url);
    galleryUrls.push(url);
  }

  const variantUrls = [];
  for (const v of variantSpecs) {
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
  console.log("  Product ID:", product.id, "  Stock total:", totalStock);

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
