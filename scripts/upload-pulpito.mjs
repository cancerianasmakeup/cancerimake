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

// Foto de portada: la collage grande con la chica usándolo (más vendedora)
// Segunda: los 4 colores juntos (para mostrar la variedad de colores al azar)
const files = [
  { local: "D_NQ_NP_644335-MLA88721899138_072025-O.webp", nice: "pulpito-cleanser-collage.webp" },
  { local: "a10a14_2b525ad3e0d9498da5c98224c6bebd3a~mv2.jpg", nice: "pulpito-cleanser-colores.jpg" },
];

const payload = {
  name: "Pulpito — Esponja Facial de Silicona",
  slug: "pulpito-esponja-facial-silicona",
  description:
    "Pulpito es la esponja facial con forma de pulpo que se volvió cult en las rutinas de skincare. Hecha en silicona suave y resistente, está diseñada para limpiar y exfoliar la piel del rostro sin lastimarla — perfecta para todas las pieles, incluso las más sensibles.\n\nBeneficios:\n\n- Limpieza profunda y delicada: las cerdas suaves de silicona arrastran impurezas, restos de maquillaje y exceso de sebo sin agredir la piel.\n- Doble función: el lado de la cabeza (con micro-cerdas finas) limpia, y los tentáculos (con cerdas más largas) exfolian y masajean.\n- Más higiénica que las esponjas tradicionales: la silicona no absorbe bacterias ni se llena de moho, se lava fácil con agua y jabón.\n- Ideal para usar con tu gel limpiador o jabón habitual: mejora la absorción de los productos que apliques después.\n\nUso recomendado: humedecé el Pulpito, aplicá tu limpiador habitual en la cabeza y masajeá en movimientos circulares sobre la cara. Enjuagá bien y dejá secar al aire.\n\n⚠️ Importante: los colores son al azar — no se puede elegir. Disponibles entre rosa, fucsia, violeta, celeste/turquesa y lila, según stock.",
  category_id: SKINCARE_CATEGORY_ID,
  price: 1800,
  compare_price: 2500,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 50,
  length_cm: 8,
  width_cm: 8,
  height_cm: 8,
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

async function insertProduct(images) {
  const body = [{ ...payload, images }];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Insert failed (${res.status}): ${await res.text()}`);
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
  for (const f of files) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2:", url);
    urls.push(url);
  }
  const inserted = await insertProduct(urls);
  console.log("  ID:", inserted[0].id, "  slug:", inserted[0].slug);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
