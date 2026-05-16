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

const products = [
  {
    file: "2i2 vip men  (1).png",
    niceName: "2i2-vip-men-are-you-on-the-list-nyc-100ml.png",
    payload: {
      name: "Perfume 2i2 VIP Men — Are You On The List? NYC 100 ml",
      slug: "perfume-2i2-vip-men-are-you-on-the-list-nyc-100ml",
      description:
        "2i2 VIP Men — Are You On The List? NYC es una fragancia masculina oriental amaderada inspirada en la noche neoyorquina. Captura la energía vibrante y sofisticada de la élite metropolitana: intensa, magnética y con mucha presencia. Caja plateada con tipografía en negro, diseño limpio y muy reconocible.\n\nPirámide olfativa:\n\n- Notas de Salida: Pimienta negra, jengibre, caviar de limón y maracuyá\n- Notas de Corazón: Ginebra, menta, vodka y especias\n- Notas de Fondo: Maderas nobles, cuero, ámbar y haba tonka\n\nEau de Parfum 100 ml (3.4 fl.oz) — Vaporisateur Natural Spray. Ideal para hombres que se mueven con seguridad y dejan estela.",
      price: 18000,
      compare_price: 24000,
    },
  },
  {
    file: "2i2 vip men  (2).png",
    niceName: "2i2-vip-men-club-edition-100ml.png",
    payload: {
      name: "Perfume 2i2 VIP Men Club Edition 100 ml",
      slug: "perfume-2i2-vip-men-club-edition-100ml",
      description:
        "2i2 VIP Men Club Edition es la versión nocturna y más oscura de la línea VIP Men: una fragancia amaderada-especiada pensada para after-hours y eventos de noche. Más intensa que la versión NYC, con un fondo achocolatado que sorprende y queda en la memoria. Caja negra mate con relieves plateados — packaging premium y muy elegante.\n\nPirámide olfativa:\n\n- Notas de Salida: Lima, notas acuosas y caviar\n- Notas de Corazón: Nuez moscada, maderas y pimienta\n- Notas de Fondo: Chocolate y notas amaderadas\n\nEau de Parfum 100 ml (3.4 fl.oz) — Vaporisateur Natural Spray. Para los que arrancan tarde y vuelven al alba.",
      price: 18000,
      compare_price: 24000,
    },
  },
];

function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
  await client.send(
    new PutObjectCommand({
      Bucket: R2.bucket,
      Key: key,
      Body: body,
      ContentType: contentTypeFor(filepath),
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return buildPublicUrl(R2.publicBaseUrl, key);
}

async function insertProduct(p, imageUrl) {
  const body = [
    {
      ...p.payload,
      category_id: SAPHIRUS_CATEGORY_ID,
      stock: 24,
      status: "active",
      is_featured: false,
      cost: 0,
      weight_grams: 350,
      length_cm: 12,
      width_cm: 6,
      height_cm: 6,
      images: [imageUrl],
    },
  ];
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert failed (${res.status}): ${text}`);
  }
  return res.json();
}

(async () => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  });

  for (const p of products) {
    console.log(`\nProcesando: ${p.payload.name}`);
    const full = path.join(downloadsDir, p.file);
    const url = await uploadToR2(client, full, p.niceName);
    console.log("  R2:", url);
    const inserted = await insertProduct(p, url);
    console.log("  ID:", inserted[0].id, "  slug:", inserted[0].slug);
  }
})().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
