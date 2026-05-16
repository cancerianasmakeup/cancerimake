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

const files = [
  { local: "generated-image-january-26-2026-10_10am-b26c9789d41cecef7617694331571027-1024-1024.webp",
    nice: "mely-cherry-body-lotion-editorial.webp" },
  { local: "my893054-1-alta-6af6e1516de6e5814c17696137650746-480-0.webp",
    nice: "mely-cherry-body-lotion-pack.webp" },
  { local: "tonos-esmalte-5a6b2bcbfed69fea6617696137687162-1024-1024.webp",
    nice: "mely-cherry-body-lotion-pump.webp" },
];

const payload = {
  name: "Cherry Body Lotion Mely Skincare 200 ml",
  slug: "cherry-body-lotion-mely-200ml",
  description:
    "Cherry Body Lotion de Mely Skincare 200 ml — una loción corporal hidratante y nutritiva con extracto de cereza y niacinamida que envuelve la piel en una fragancia frutal vibrante. Textura fluida de rápida absorción que hidrata profundo sin dejar sensación grasa.\n\nIngredientes activos:\n\n- Extracto de cereza: suaviza, perfuma y aporta antioxidantes.\n- Niacinamida: mejora la luminosidad natural de la piel, unifica el tono y refuerza la barrera cutánea.\n\nBeneficios:\n\n- Hidratación duradera durante todo el día\n- Suaviza zonas ásperas (codos, rodillas, talones)\n- Deja la piel aterciopelada, fresca y perfumada por horas\n- Apta para todo tipo de piel\n\nUso: aplicá una porción sobre la piel limpia, masajeá hasta absorber. Ideal usar dos veces al día, especialmente después de la ducha.\n\nFrasco de 200 ml con pump anti-derrame — práctico para usar todos los días sin desperdicio. Aprobado ANMAT y cruelty free.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 6800,
  compare_price: 9000,
  stock: 2,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 240,
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
