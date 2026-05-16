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

const SAPHIRUS_CATEGORY_ID = "59f56e54-33fd-4ee8-91b0-e2855411c92b";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "Screenshot_20250729_202150_Chrome_b6c80c56-457b-4a26-8d11-6a47f2ea911b.webp", nice: "vvlove-charming-vanilla-frasco.webp" },
  { local: "Screenshot_20250729_202248_Chrome.webp",                                      nice: "vvlove-charming-vanilla-lifestyle-playa.webp" },
];

const payload = {
  name: "Charming Vanilla — Body Mist V.V.LOVE (250 ml)",
  slug: "vvlove-charming-vanilla-body-mist-250ml",
  description:
    "Charming Vanilla de V.V.LOVE — un body mist cálido y envolvente con vainilla como protagonista, pensado para mujeres libres que aman dejar estela dulce sin que pese. Brume parfumée premium en frasco translucido con detalle de estrellitas y partículas doradas: lindo de tener en el tocador y aún más lindo de usar.\n\nFamilia olfativa: gourmand dulce — vainilla cálida y envolvente. La nota dominante de vainilla crea una sensación reconfortante, ideal tanto para uso diario como para acompañar looks de noche.\n\nCaracterísticas:\n\n- 🌟 Fórmula body mist (brume parfumée) — ligera, no pegajosa\n- 🍦 Aroma vainilla gourmand cálido y dulce\n- 💎 Frasco premium con estrellas doradas y partículas brillantes\n- 🌸 250 ml / 8.4 fl.oz — rendidor para uso diario\n- ✨ Versátil: se puede rociar en piel, ropa o cabello\n- 💫 Estela suave y duradera\n\nModo de uso: rociá a 15-20 cm de la piel sobre puntos de pulso (cuello, muñecas, escote). También se puede aplicar sobre el cabello para fijar el aroma a lo largo del día. Combinalo con tu hidratante de vainilla favorita para potenciar la duración.\n\nFormato 250 ml con vaporizador. Pieza de colección — ya casi no se consigue.",
  category_id: SAPHIRUS_CATEGORY_ID,
  price: 10000,
  compare_price: 14000,
  stock: 2,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 320,
  length_cm: 18,
  width_cm: 6,
  height_cm: 6,
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

(async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  });
  console.log(`Procesando: ${payload.name}`);
  const urls = [];
  for (const f of files) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2:", url);
    urls.push(url);
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ ...payload, images: urls }]),
  });
  if (!res.ok) throw new Error(`Insert failed (${res.status}): ${await res.text()}`);
  const inserted = await res.json();
  console.log("  ID:", inserted[0].id, "  slug:", inserted[0].slug);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
