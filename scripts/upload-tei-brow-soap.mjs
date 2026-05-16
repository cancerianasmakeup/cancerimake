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
  { local: "jabon-para-cejas-fijador-brow-tei-tei8016.webp", nice: "tei-brow-soap-cover.webp" },
  { local: "D_Q_NP_797729-MLA109686202425_032026-F.webp",   nice: "tei-brow-soap-hero.webp" },
  { local: "D_Q_NP_622302-MLA109687603107_032026-F.webp",   nice: "tei-brow-soap-aplicacion.webp" },
  { local: "D_Q_NP_902344-MLA109689354927_032026-F.webp",   nice: "tei-brow-soap-detalle.webp" },
];

const payload = {
  name: "Jabón / Cera para Cejas Brow Soap — TEI Cosmética (8016)",
  slug: "tei-brow-soap-jabon-cejas-8016",
  description:
    "Brow Soap de TEI Cosmética — jabón / cera fijadora para cejas con efecto laminado. La técnica que se hizo viral para fijar y peinar cada pelito hacia arriba con un look prolijo, denso y natural sin tener que ir al salón. Para mujeres libres que aman cejas pobladas tipo \"editorial\" con un look pulido todo el día.\n\nIncluye cepillo aplicador.\n\nBeneficios:\n\n- 🪞 Efecto cejas laminadas (brow lamination en casa)\n- 💎 Sin color — solo fija, ideal sobre tu producto de ceja favorito (sombra / pomada / lápiz)\n- ⏱️ Larga duración: aguanta el día sin caerse\n- 🪶 Cepillo aplicador incluido\n- 🌸 Fórmula tipo gel-cera — más fijación que un gel tradicional\n- ✨ Engrosa visualmente la ceja (los pelitos se ven más densos)\n- 🐰 Cruelty Free · Aprobado ANMAT\n\nModo de uso:\n\n1. Humedecé ligeramente el cepillo (puede ser con un toque de agua o setting spray).\n2. Pasalo sobre la barra de jabón / cera hasta cargar producto.\n3. Peiná las cejas hacia arriba y hacia afuera siguiendo la forma natural.\n4. Si querés un look más definido, aplicalo sobre tu producto de ceja para sellar el color.\n5. Dejá secar — el jabón fija los pelitos en su lugar durante todo el día.\n\nTip: para máximo efecto laminado, primero peiná las cejas con un cepillo seco, después aplicá el brow soap con el cepillo húmedo en movimientos hacia arriba.\n\nÍtem TEI 8016.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2200,
  compare_price: 3000,
  stock: 16,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 30,
  length_cm: 7,
  width_cm: 4,
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
