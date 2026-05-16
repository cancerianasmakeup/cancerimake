import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "SaveClip.App_649661438_18072354404561983_941757372923313640_n.jpg",  nice: "tei-mascara-sky-high-cover-ojo.jpg" },
  { local: "SaveClip.App_652771782_18072354413561983_8144079471113317238_n.jpg", nice: "tei-mascara-sky-high-display.jpg" },
];

const payload = {
  name: "Mascara Sky High Lash Sensational — TEI Cosmética (8329)",
  slug: "tei-mascara-sky-high-8329",
  description:
    "✨ Mascara Sky High de TEI Cosmética — la máscara que eleva tus pestañas al máximo. Para mujeres libres que aman mirada potente con efecto pestañas larguísimas, tipo \"sky high\" (literal, llegan al cielo). Su fórmula está diseñada para dar volumen, longitud y definición en cada pasada — sin grumos, sin que se caigan los pelitos.\n\n🌟 **Beneficios:**\n\n- ✔️ Extensión y volumen al máximo\n- ✔️ Pestañas más largas y definidas en cada pasada\n- ✔️ Color negro intenso\n- ✔️ Cepillo flexible Lash Sensational — abraza cada pestaña\n- ✔️ Ideal para look diario o de noche\n- ✔️ Sin grumos ni costras\n- 🐰 Cruelty Free · Autorizado ANMAT\n\n**Modo de uso:**\n\n1. Mirate al espejo desde abajo levantando el mentón.\n2. Apoyá el cepillo en la raíz de las pestañas y movelo en zig-zag hacia las puntas.\n3. Para máximo efecto, aplicá una segunda capa antes de que la primera se seque — así se fusiona y queda parejo.\n4. Bonus: pasá el cepillo también por debajo de las pestañas para abrir aún más la mirada.\n\nTip: rizá las pestañas con eyelash curler antes de aplicar — la fórmula respeta el curl durante todo el día.\n\nFormato slim plateado con detalles rosa pastel. Ideal para llevar en la cartera.\n\nÍtem TEI 8329.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3000,
  compare_price: 4500,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 30,
  length_cm: 14,
  width_cm: 2,
  height_cm: 2,
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
