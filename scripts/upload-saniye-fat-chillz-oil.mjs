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
  { local: "D_NQ_NP_2X_772935-MLA100168040278_122025-F.webp",  nice: "saniye-fat-chillz-oil-master-display.webp" },
  { local: "D_NQ_NP_2X_941348-MLA106821062525_022026-F.webp",  nice: "saniye-fat-chillz-oil-modelo-uso.webp" },
  { local: "D_NQ_NP_2X_659124-MLA106820735943_022026-F.webp",  nice: "saniye-fat-chillz-oil-display-frasco.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Cristal",   color_hex: "#F5F5F0", stock: 4 },
  { name: "Tono 02 — Rosa claro",color_hex: "#F4B6C6", stock: 4 },
  { name: "Tono 03 — Cereza",    color_hex: "#C8253E", stock: 4 },
  { name: "Tono 04 — Rosa",      color_hex: "#E78BA8", stock: 4 },
  { name: "Tono 05 — Lila",      color_hex: "#A584B8", stock: 4 },
  { name: "Tono 06 — Vino",      color_hex: "#6E2D3E", stock: 4 },
];

const payload = {
  name: "Brillo Labial Fat Chillz Oil — Saniye (L1441)",
  slug: "saniye-fat-chillz-oil-brillo-labial",
  description:
    "Fat Chillz Oil de Saniye — un brillo labial tipo lip oil con fórmula \"fat\" más densa que rellena los labios visualmente y deja un acabado super glossy y jugoso. Para mujeres libres que quieren labios pulposos sin ir al fillers.\n\nCaracterísticas:\n\n- 💋 Acabado glossy intenso — efecto labios mojados\n- 💧 Fórmula hidratante con aceites, no reseca\n- 🍑 Sin sensación pegajosa — cómodo de usar todo el día\n- ✨ Aplicador doe-foot grande que distribuye parejo\n- 🎀 Diseño en frasco rosa con tapón cilíndrico — entra fácil en la cartera\n\nDisponible en 6 tonos. Elegí el tuyo al agregar al carrito:\n\n- Tono 01 — Cristal (transparente, ideal como topper o look natural)\n- Tono 02 — Rosa claro (rosa nude para uso diario)\n- Tono 03 — Cereza (rojo intenso clásico)\n- Tono 04 — Rosa (rosa medio versátil)\n- Tono 05 — Lila (violeta-rosa para look diferente)\n- Tono 06 — Vino (granate profundo para look intenso)\n\nUsalo solo o sobre tu labial favorito para sumar volumen y brillo. También se puede aplicar varias veces al día — no se acumula raro.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2200,
  compare_price: 3000,
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

  // Master display (los 6 tonos visibles) como referencia para variantes
  const variantReferenceImage = galleryUrls[0];

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
