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

const files = [
  { local: "2df165_80b5d573a8104c87b083d12d146cee86~mv2.jpg",                                            nice: "saniye-gel-cejas-flatlay-editorial.jpg" },
  { local: "2df165_932b98bdd35943de9ed070d63c68c63f~mv2.jpg",                                            nice: "saniye-gel-cejas-hero-demo.jpg" },
  { local: "gel-para-cejas-saniye-m365-1250-b647c8cfec48fcdeb217568230403190-1024-1024.webp",            nice: "saniye-gel-cejas-display-m365.webp" },
  { local: "D_NQ_NP_2X_799560-MLA91645153604_092025-F.webp",                                             nice: "saniye-gel-cejas-cejas-laminadas.webp" },
  { local: "img_2588505552764202968-2261041cda6ac2622c17746212353208-1024-1024.webp",                    nice: "saniye-gel-cejas-display-frontal.webp" },
];

const payload = {
  name: "Gel para Cejas Transparente — Saniye (M365)",
  slug: "saniye-gel-cejas-transparente-m365",
  description:
    "Gel para Cejas Transparente de Saniye — el aliado que mejor entendió a las cejas rebeldes. Pomada en gel con efecto laminado para fijar, peinar y dar forma a la ceja con un acabado natural, sin grumos y sin residuos. Para mujeres libres que quieren cejas prolijas todo el día sin tener que retocar.\n\nBeneficios:\n\n- 🪞 Efecto cejas laminadas (look pulido tipo salón en casa)\n- 💎 Fórmula transparente — no agrega color, solo fija\n- ⏱️ Larga duración: aguanta el día sin caerse\n- 🧴 Textura gel ligera, no pesa ni se siente pegajosa\n- ✨ Sin grumos ni copos blancos\n- 🪶 Cepillo tipo mascara que peina cada pelito al detalle\n- 🐰 Cruelty Free · Aprobado ANMAT\n\nModo de uso:\n\n1. Peiná las cejas hacia arriba con el cepillo seco para ubicar los pelitos.\n2. Aplicá una capa fina del gel siguiendo la dirección natural de la ceja.\n3. Dejá secar unos segundos y ajustá la forma con el cepillo si querés un look más pulido.\n\nTip: aplicalo también sobre tu producto de ceja favorito (sombra, lápiz, pomada) para sellar el color y que no se mueva.\n\nFormato tubo tipo squeeze rosa con cepillo aplicador. Ideal para llevar en la cartera — el formato compacto entra en cualquier neceser.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2500,
  compare_price: 3500,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
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
