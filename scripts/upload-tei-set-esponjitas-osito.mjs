import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "D_NQ_NP_2X_932116-MLA94564676704_102025-F.webp", nice: "tei-set-esponjitas-osito-cover.webp" },
];

const payload = {
  name: "Set Esponjitas x6 en Cajita Osito — TEI Cosmética",
  slug: "tei-set-6-esponjitas-cajita-osito",
  description:
    "Set de 6 Esponjitas Multi-formato de TEI Cosmética 🐻 — kit completo de esponjas para maquillaje en una cajita súper cute con forma de carita de osito. La solución todo-en-uno para cubrir, difuminar y sellar la base como una pro.\n\n**Incluye 6 esponjitas de distintas formas:**\n\n- 🔺 **Forma triángulo / gota** (rosa) — para zonas precisas como ojeras, alas de la nariz, pliegue del párpado\n- ⭕ **Forma redonda Air Cushion** (lila) — para aplicación de polvo / cushion / base con golpecitos\n- 💗 **Forma corazón rosa fucsia** — para detalles cute, llegar a esquinas, baking debajo del ojo\n- ❤️ **Forma corazón rojo/blanco** (bicolor) — para difuminar y golpecitos finos\n- 🌸 **Forma corazón rosa-celeste pastel** — efecto blush en crema\n- 🩷 **Forma gota rosa fucsia** — uso versátil\n\nCaracterísticas:\n\n- 💧 **Para uso seco y húmedo** — humedecé la esponja antes para acabado natural / glowy\n- ✨ Material látex-free súper suave\n- 📦 Cajita coleccionable con forma de osito kawaii\n- 🐰 Cruelty Free\n- 🎁 Ideal para regalo o para tu collection — el set completo a precio de set\n\n**Modo de uso:**\n\n1. Para base / corrector líquido: humedecé la esponja, exprimí el exceso de agua, aplicá con golpecitos suaves.\n2. Para polvo translúcido / cushion: usá seca con golpecitos.\n3. Para baking: pasá generoso polvo debajo del ojo, esperá 5-10 min, sacudí con la esponja.\n4. Para contour cream / blush stick: usá la forma de gota o triángulo difuminando en círculos.\n\n⚠ Stock limitado: 10 sets disponibles. Color del set (rosa pastel o multicolor) viene aleatorio según disponibilidad.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2100,
  compare_price: 3200,
  stock: 10,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 60,
  length_cm: 12,
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

  await postRest("product_categories", [
    { product_id: product.id, category_id: MAQUILLAJE_CATEGORY_ID, is_primary: true  },
    { product_id: product.id, category_id: ACCESORIOS_CATEGORY_ID, is_primary: false },
  ]);
  console.log("  Categorías: Maquillaje (primary) + Accesorios");
})().catch((err) => { console.error("Error:", err); process.exit(1); });
