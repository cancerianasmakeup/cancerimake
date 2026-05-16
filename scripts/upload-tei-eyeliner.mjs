import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "a71f3588-5276-4aca-8bf2-278a989cac52-c48609d4dd0851ff1a17601103577794-1024-1024.webp",
    nice: "tei-eyeliner-tei8065-features.webp" },
  { local: "delineador-liquido-smudge-proof-tei8065.webp",
    nice: "tei-eyeliner-tei8065-display.webp" },
];

const payload = {
  name: "Delineador Líquido Eyeliner — TEI Cosmética (TEI8065)",
  slug: "tei-eyeliner-liquido-smudge-proof-tei8065",
  description:
    "Delineador líquido Eyeliner de TEI Cosmética — el lápiz que necesitás para un cat-eye prolijo que dura todo el día sin retoques. Para mujeres libres que arman su look make-up rápido y no quieren preocuparse de que se les corra.\n\nCaracterísticas:\n\n- ✅ Smudge-proof — no se corre ni se difumina\n- ✅ Waterproof — resiste agua, lágrimas y sudor\n- ✅ 24hs long wear — aguanta el día y la noche\n- 🖤 Color negro intenso y mate\n- 🖌️ Pincel fino flexible que permite trazos finos (línea natural) o gruesos (cat-eye dramático)\n\nFórmula de secado rápido que se fija en segundos sin manchar el párpado. Ideal para alinear, hacer línea gráfica o un cat-eye con cola. Una sola pasada es suficiente para un trazo bien pigmentado.\n\nModo de uso: agitá el delineador antes de usar, escurrí el exceso en el borde del frasco, y aplicá apoyando el pincel sobre la línea de pestañas. Para un cat-eye más definido, dejá un punto en el extremo y conectalo con un movimiento ascendente.\n\nContenido: 5 g · Aprobado ANMAT 🐰 Cruelty Free.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2200,
  compare_price: 3000,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
  length_cm: 14,
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
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ ...payload, images: urls }]),
  });
  if (!res.ok) throw new Error(`Insert failed (${res.status}): ${await res.text()}`);
  const inserted = await res.json();
  console.log("  ID:", inserted[0].id, "  slug:", inserted[0].slug);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
