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

const SKINCARE_CATEGORY_ID = "9cc9b6e4-18d7-4fc4-ae37-8a61f404b2a3";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "img_9843-4ee331e64e2a19abb217607296966814-480-0.webp", nice: "tei-face-scrub-banner-display.webp" },
  { local: "ChatGPT Image 16 may 2026, 04_32_21 a.m..png",          nice: "tei-face-scrub-duo.png" },
];

const variantSpecs = [
  { name: "Peach",     color_hex: "#F5B5B5", stock: 6, file: "2-dbdfeb14d851c55d9e17605437467427-1024-1024.webp", nice: "tei-face-scrub-peach.webp" },
  { name: "Vitamin C", color_hex: "#F4A14C", stock: 6, file: "3-1f55066592ce52398917605440034457-1024-1024.webp", nice: "tei-face-scrub-vitamin-c.webp" },
];

const payload = {
  name: "Face Scrub TEI Cosmética — Exfoliante Facial (TEI8328)",
  slug: "tei-face-scrub-exfoliante-tei8328",
  description:
    "Face Scrub de TEI Cosmética — exfoliante facial con micropartículas suaves que elimina células muertas, destapa poros y deja la piel fresca, luminosa y lista para absorber el resto de tu rutina. Para mujeres libres que cuidan su piel con rituales prolijos.\n\nBeneficios:\n\n- 🌟 Exfoliación efectiva — renueva la piel sin agredirla\n- 💧 Mejora la textura y prepara la piel para absorber mejor las cremas\n- ✨ Apto para rostro y cuerpo\n- 🧖 Safe for all skin types — incluso pieles sensibles\n- Limpia poros, suaviza zonas ásperas y aporta luminosidad natural\n\nElegí tu favorito al agregar al carrito:\n\n- 🍑 **Peach** — perfil dulce y delicado, ideal para piel sensible o seca. Aroma a durazno cremoso.\n- 🍊 **Vitamin C** — infusionado con vitamina C, ideal para piel apagada o con manchas. Aroma cítrico fresco.\n\nModo de uso: humedecé el rostro, aplicá una porción del scrub y masajeá en movimientos circulares suaves durante 30-60 segundos. Enjuagá con agua tibia. Usar 1-2 veces por semana (más frecuente puede irritar).\n\nAprobado ANMAT 🐰 Cruelty Free.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 4000,
  compare_price: 5200,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 110,
  length_cm: 16,
  width_cm: 5,
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
    console.log("  R2 galería:", url);
    galleryUrls.push(url);
  }

  // Subimos también las fotos de variantes — y las agregamos a la galería para que se vean en el detalle.
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
