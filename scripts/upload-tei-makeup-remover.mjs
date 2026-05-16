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
  { local: "1-3bf895c07c6c54a0c917561294550374-1024-1024.webp", nice: "tei-makeup-remover-pack.webp" },
  { local: "2-88c0b51b95e55e35af17561294584813-1024-1024.webp", nice: "tei-makeup-remover-uso.webp" },
];

const payload = {
  name: "Makeup Remover TEI — Desmaquillante en Gel",
  slug: "tei-makeup-remover-desmaquillante-gel",
  description:
    "Makeup Remover de TEI Cosmética — un desmaquillante en gel pensado para quitar maquillaje, restos de SPF y suciedad del día sin maltratar la piel. Para mujeres libres que valoran un skincare prolijo y minimalista.\n\nQué hace:\n\n- Remueve maquillaje (incluso waterproof) y protector solar de forma suave\n- Limpieza profunda sin sensación grasa: deja el rostro fresco y libre de residuos\n- Apto para todo tipo de piel, incluso las más sensibles\n- Se enjuaga fácil con agua, sin dejar película\n\nFórmula gel cosmética con tensoactivos suaves y carga ligera. Pump anti-derrame que dosifica la cantidad justa en cada aplicación — sin desperdicio.\n\nModo de uso: aplicá 1-2 dosis sobre la palma de la mano y, con un disco de algodón, retirá el maquillaje haciendo movimientos suaves. Después enjuagá con agua tibia. Repetí si hace falta (ojos cargados, base de larga duración) — es bien tolerado y no irrita.\n\nAprobado ANMAT 🐰 Cruelty Free.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 9000,
  compare_price: 13000,
  stock: 3,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 500,
  length_cm: 18,
  width_cm: 8,
  height_cm: 5,
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
