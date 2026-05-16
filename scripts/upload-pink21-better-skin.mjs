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

const productImages = [
  // Cover: la caja + 6 tonos numerados con swatches (más informativa)
  { local: "D_Q_NP_960194-MLA69220170494_052023-F.webp", nice: "pink21-better-skin-caja-6tonos.webp" },
  // 6 tubos con swatches grandes
  { local: "D_Q_NP_703286-MLA83454092764_042025-F.webp", nice: "pink21-better-skin-6tonos-swatches.webp" },
  // 6 tubos alineados
  { local: "BASE-PINK-.jpg",                              nice: "pink21-better-skin-6tubos.jpg" },
  // 2 tubos pack shot
  { local: "D_Q_NP_859659-MLA83454141274_042025-F.webp", nice: "pink21-better-skin-pack.webp" },
  // Close-up de textura
  { local: "D_Q_NP_886521-MLA83454092766_042025-F.webp", nice: "pink21-better-skin-textura.webp" },
];

const payload = {
  name: "Base Líquida Better Skin — Pink 21 (30 ml)",
  slug: "base-liquida-better-skin-pink-21-30ml",
  description:
    "Base Líquida \"Your Better Skin Look\" de Pink 21 — la base que está rompiendo en TikTok. Cobertura ultra profesional, acabado natural a satinado, fórmula ligera que se desliza fácil y dura puesta varias horas. Para mujeres libres que quieren un look make-up impecable sin gastar una fortuna.\n\nCaracterísticas:\n\n- Cobertura: media a alta, buildable\n- Acabado: satinado natural — no se ve cartón\n- Textura: fluida, fácil de difuminar con esponja, brocha o dedos\n- Resistente: no se baja en el día a día\n- Contenido: 30 ml por tubo\n\nDisponible en 6 tonos para que encuentres tu match. Elegí el tuyo al agregar al carrito:\n\n- Tono 01 — Light beige (piel muy clara)\n- Tono 02 — Beige medio\n- Tono 03 — Honey (tono medio cálido)\n- Tono 04 — Marfil / Light (piel clara neutra)\n- Tono 05 — Caramelo (medio oscuro)\n- Tono 06 — Canela (oscuro cálido)\n\nTip: si no estás segura del tono, elegí el más cercano y mezclalo con un poco de crema hidratante para suavizar la cobertura, o combiná dos tonos para customizar.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3600,
  compare_price: 5000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 50,
  length_cm: 12,
  width_cm: 4,
  height_cm: 3,
};

const variants = [
  { name: "Tono 01 — Light beige",      color_hex: "#E6C9A2", stock: 4 },
  { name: "Tono 02 — Beige medio",      color_hex: "#D4A877", stock: 4 },
  { name: "Tono 03 — Honey",            color_hex: "#C99668", stock: 4 },
  { name: "Tono 04 — Marfil",           color_hex: "#EBD4B0", stock: 4 },
  { name: "Tono 05 — Caramelo",         color_hex: "#A87858", stock: 4 },
  { name: "Tono 06 — Canela",           color_hex: "#8E5E3A", stock: 4 },
];

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

  const urls = [];
  for (const f of productImages) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2:", url);
    urls.push(url);
  }

  // Usamos la 2da imagen (los 6 tonos con swatches) como imagen por variante,
  // así al elegir un tono el cliente ve la referencia de colores hasta que carguemos
  // fotos individuales de cada tono.
  const variantReferenceImage = urls[1];

  const totalStock = variants.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: urls,
  }]);
  console.log("  Product ID:", product.id, "  Stock total:", totalStock);

  const variantRows = variants.map((v) => ({
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
