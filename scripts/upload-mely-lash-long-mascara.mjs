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
  { local: "my812023-7-alta-ada3baaf9f2638d29c17736944504341-1024-1024-d26819ac6d6d1fa92917745577886679-1024-1024.webp", nice: "mely-lash-long-lifestyle-pink.webp" },
  { local: "my812023-6-alta-d79b18118c1029f33717734084712584-1024-1024-78fe3c23422c2b7d2517745577884121-1024-1024.webp", nice: "mely-lash-long-cepillos.webp" },
];

const variantSpecs = [
  { name: "Edición Rosa",  color_hex: "#F4B6C2", stock: 12, file: "my812023-4-cepillo-1-alta-7e13c0895c6628b68f17734084709863-1024-1024-edcd57d7547dd3aa7d17745577883799-1024-1024.webp", nice: "mely-lash-long-rosa.webp" },
  { name: "Edición Blanca", color_hex: "#FFFFFF", stock: 12, file: "my812023-5-cepillo-2-alta-e24ba575687fb48eb017734084710392-1024-1024-53c97573f6e12b4a4817745577884029-1024-1024.webp", nice: "mely-lash-long-blanca.webp" },
];

const payload = {
  name: "Lash Long Mascara Waterproof — Mely Beauty (MY812023)",
  slug: "mely-lash-long-mascara-waterproof",
  description:
    "Lash Long Mascara Waterproof de Mely Beauty — máscara de pestañas alargadora con fórmula resistente al agua y al sudor. Cepillo grande tipo abrazo que separa, define y alarga cada pestaña sin grumos. Para mujeres libres que aman pestañas largas, naturales y prolijas — efecto pestañas postizas pero sin postizas.\n\nCaracterísticas:\n\n- 👁️ Acabado largo + separado — efecto pestañas tipo \"abanico\"\n- ⏱️ Larga duración: aguanta el día sin caerse\n- 💧 Waterproof — resiste agua, sudor y lágrimas\n- 🌸 Cepillo grande de cerdas tupidas — peina y carga producto en una sola pasada\n- ✨ Color negro intenso\n- 🩷 Packaging Mely Beauty con ilustraciones de besos y ojitos — súper cute\n- 📦 10 ml de producto\n- 🐰 Cruelty Free\n\nDisponible en 2 ediciones de packaging (misma fórmula y fórmula por dentro):\n\n- **Edición Rosa** — tubo rosa pastel con ilustraciones rosa más oscuro\n- **Edición Blanca** — tubo blanco con ilustraciones rosa pastel\n\n**Modo de uso:**\n\n1. Mirá hacia abajo levemente para tener acceso completo a las pestañas.\n2. Apoyá el cepillo en la raíz de las pestañas y movelo en zig-zag hacia las puntas.\n3. Aplicá una segunda capa antes de que se seque para máximo volumen.\n4. Para sacar al final del día usá desmaquillante bifásico (es waterproof).\n\nTip: rizá las pestañas con un eyelash curler antes de aplicar — la fórmula respeta el curl todo el día.\n\nCódigo Mely MY812023.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3200,
  compare_price: 4500,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
  length_cm: 14,
  width_cm: 2,
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
    images: [...galleryUrls, ...variantUrls],
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
