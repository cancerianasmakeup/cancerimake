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

const galleryImages = [
  { local: "623379564_1310855147742303_5402985699984577533_n.jpg", nice: "saniye-shine-on-lip-oil-3frascos-heart.jpg" },
  { local: "623105778_1310855087742309_4120277657518896910_n.jpg", nice: "saniye-shine-on-lip-oil-bouquet-tulipanes.jpg" },
  { local: "623397211_1310855097742308_3135175929848915856_n.jpg", nice: "saniye-shine-on-lip-oil-labios-6tonos.jpg" },
  { local: "623357421_1310855094408975_7077953605795875012_n.jpg", nice: "saniye-shine-on-lip-oil-swatches-6tonos.jpg" },
];

const variantSpecs = [
  { name: "Tono 01 — Cristal",      color_hex: "#F5F5DC", stock: 4 },
  { name: "Tono 02 — Fucsia",       color_hex: "#D03A6E", stock: 4 },
  { name: "Tono 03 — Rosa",         color_hex: "#E78BA8", stock: 4 },
  { name: "Tono 04 — Magenta",      color_hex: "#E5378C", stock: 4 },
  { name: "Tono 05 — Cobre",        color_hex: "#A87858", stock: 4 },
  { name: "Tono 06 — Rosa pastel",  color_hex: "#FAD3E0", stock: 4 },
];

const payload = {
  name: "Shine On Lip Oil — Saniye (Tapón Corazón)",
  slug: "saniye-shine-on-lip-oil",
  description:
    "Shine On Lip Oil de Saniye — el lip oil con tapón con forma de corazón que se hizo viral en TikTok. Aceite labial con efecto vidrio, hidratante y con un toque de glitter sutil, para mujeres libres que quieren un make natural con labios jugosos.\n\nCaracterísticas:\n\n- 💋 Acabado efecto vidrio: brillo intenso, no pegajoso\n- 💧 Fórmula hidratante con aceites que cuidan los labios\n- ✨ Micro-glitter sutil que refleja la luz\n- 🎀 Diseño con tapón corazón transparente — súper estético\n- 💅 Aplicador doe-foot suave que distribuye parejo\n\nDisponible en 6 tonos para que combines con tu look del día. Elegí el tuyo al agregar al carrito:\n\n- Tono 01 — Cristal (transparente con shimmer, para look natural o sobre otro labial)\n- Tono 02 — Fucsia (rosa intenso vibrante)\n- Tono 03 — Rosa (rosa medio, muy versátil para uso diario)\n- Tono 04 — Magenta (rosa fuerte con efecto wet)\n- Tono 05 — Cobre (rosa amaderado / baya, ideal para otoño-invierno)\n- Tono 06 — Rosa pastel (rosa palo super suave)\n\nTip: el #01 funciona como topper sobre cualquier labial mate para sumar brillo. Los más pigmentados (02-05) se pueden usar solos o difuminar con el dedo para un efecto blurred.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2500,
  compare_price: 3600,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 30,
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
  for (const f of galleryImages) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2:", url);
    galleryUrls.push(url);
  }

  // Foto de variante = collage de 6 labios (referencia visual de tonos)
  const variantReferenceImage = galleryUrls[2];

  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, "  Stock total:", totalStock);

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
