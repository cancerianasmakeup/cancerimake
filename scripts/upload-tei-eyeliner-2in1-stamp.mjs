import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "D_NQ_NP_2X_689838-MLA106750499128_022026-F.webp", nice: "tei-eyeliner-2in1-display-cover.webp" },
  { local: "D_NQ_NP_2X_682304-MLA106750409594_022026-F.webp", nice: "tei-eyeliner-2in1-quickshape-infografia.webp" },
  { local: "D_NQ_NP_2X_998506-MLA107419410755_022026-F.webp", nice: "tei-eyeliner-2in1-doble-punta.webp" },
  { local: "D_NQ_NP_2X_825914-MLA107418880603_022026-F.webp", nice: "tei-eyeliner-2in1-display-lateral.webp" },
];

const payload = {
  name: "Eyeliner 2-in-1 Doble Punta con Stamp Wing — TEI Cosmética (8366)",
  slug: "tei-eyeliner-2in1-stamp-wing-8366",
  description:
    "Eyeliner 2-in-1 de TEI Cosmética — delineador líquido **doble punta**: lado fino tipo plumín para delinear con precisión + lado con **sello de winged shape** para hacer el ala perfecta en segundos. La forma más fácil de tener un delineado de gato sin temblar la mano.\n\n#QUICK SHAPE 💕\n\nCaracterísticas:\n\n- ✏️ **Lado Eyeliner**: punta fina tipo brocha precisa — para delinear la línea de pestañas con detalle\n- 💋 **Lado Stamp (wing)**: sello con forma de ala — apoyás, presionás, y queda el winged perfecto en simétrico\n- 🖤 **Cool Black** — negro intenso con luster + buena coloración\n- ⚡ **Quickly Dry** — fórmula que se seca al toque, no se transfiere\n- 💧 **Water Proof** — resiste agua, sudor y lágrimas (long lasting)\n- 🪞 **Smudge-proof** — una vez seco, no se corre\n- 🐰 Cruelty Free · Autorizado ANMAT\n\n**Modo de uso para el ala perfecta:**\n\n1. Decidí el ángulo de tu ala (mirá la línea natural del párpado inferior extendida).\n2. Apoyá el stamp en la esquina externa del ojo con el ángulo deseado.\n3. Presioná suave 1-2 segundos → queda el wing impreso.\n4. Repetí en el otro ojo en posición espejo.\n5. Con el lado eyeliner, uní la línea del wing con la base de tus pestañas.\n6. Dejá secar 10 segundos sin pestañear.\n\nTip: si te tiembla el pulso, apoyá el codo en una superficie firme antes de stampear. Y antes de aplicar, marcá con un puntito de lápiz dónde va a quedar el ala para tener referencia.\n\nFormato slim rosa pastel con marca TEI Cosmética. Ítem TEI 8366.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2000,
  compare_price: 2700,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 18,
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
