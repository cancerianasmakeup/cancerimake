import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "D_NQ_NP_2X_975783-MLA94286590263_102025-F.webp", nice: "pink21-super-volume-cover.webp" },
  { local: "D_NQ_NP_2X_777724-MLA93946950104_102025-F.webp", nice: "pink21-super-volume-mano.webp" },
  { local: "590771062_18317995525220955_4944175756691213340_n.jpg", nice: "pink21-super-volume-lifestyle.jpg" },
];

const payload = {
  name: "Mascara Super Volume 2in1 Fake Lashes — Pink21",
  slug: "pink21-mascara-super-volume-2in1-fake-lashes",
  description:
    "Mascara Super Volume 2in1 de Pink21 — máscara dual con dos pasos en un solo envase. El truco para tener pestañas tipo postizas (\"fake lashes\") sin pegar nada. Para mujeres libres que aman pestañas con drama: volumen, longitud y separación todo en uno.\n\n**Cómo funciona — el secreto del 2in1:**\n\n- **STEP 1** (lado rosa, primer paso) → base blanca / fibrillas que adhiere fibras a las pestañas naturales, alargándolas al instante. Aplicá una capa generosa y esperá 30 segundos.\n- **STEP 2** (lado amarillo, segundo paso) → sella las fibras con la fórmula negra que da color, volumen, fija y resiste todo el día.\n\nResultado: pestañas tipo postizas — densas, largas y dramáticas — en 2 pasos.\n\nCaracterísticas:\n\n- 👁️ Efecto fake lashes — pestañas tipo postizas reales\n- ⏱️ Larga duración: aguanta el día sin caerse\n- ✨ Color negro intenso\n- 🪶 Cepillo flexible que abraza cada pestaña\n- 💎 Formato dual rosa fucsia con tapas negra (STEP 1) y amarilla (STEP 2)\n- 🐰 Cruelty Free\n\n**Modo de uso:**\n\n1. Mirate al espejo desde abajo levantando el mentón.\n2. **STEP 1:** aplicá una capa generosa del lado rosa (fibrillas blancas) en zig-zag desde la raíz hacia las puntas. Esperá 30 segundos a que las fibras se peguen.\n3. **STEP 2:** sellá con el lado amarillo (mascara negra) cubriendo toda la pestaña con fibras y todo. Esta capa fija y oscurece.\n4. Para máximo drama: repetí los 2 pasos.\n\nTip: no abuses del STEP 1 — si pasás de la cuenta las fibras pueden caer al ojo. Una capa generosa es suficiente. Para sacar al final del día usá desmaquillante bifásico (las fibras necesitan aceite para soltarse).",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3600,
  compare_price: 4700,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 40,
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
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
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
  const urls = [];
  for (const f of files) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2:", url);
    urls.push(url);
  }

  const [product] = await postRest("products", [{ ...payload, images: urls }]);
  console.log("  Product ID:", product.id, " slug:", product.slug);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: MAQUILLAJE_CATEGORY_ID,
    is_primary: true,
  }]);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
