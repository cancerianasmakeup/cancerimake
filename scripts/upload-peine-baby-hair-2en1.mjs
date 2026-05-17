import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_991052-CBT80686439032_112024-F.webp", nice: "peine-baby-hair-cepillo-detalle-cerdas.webp" },
  { local: "D_NQ_NP_2X_683149-CBT80686439034_112024-F.webp", nice: "peine-baby-hair-dual-edge-brush-comb.webp" },
  { local: "D_NQ_NP_2X_941993-CBT80686439042_112024-F.webp", nice: "peine-baby-hair-medidas-detalle.webp" },
];

const payload = {
  name: "Peine + Cepillo 2 en 1 Control de Bordes Baby Hair — Rosa",
  slug: "peine-control-bordes-baby-hair-2en1-rosa",
  description:
    "Dual Edge Brush & Comb 💗 — accesorio **2 en 1** para domar baby hairs, definir cejas y arreglar pelitos rebeldes (flyaways). Un lado cepillo de cerdas firmes + otro lado peine de dientes finos. Para todo tipo de cabello y textura.\n\nCaracterísticas:\n\n- 💗 **Doble función:** un extremo cepillo de cerdas firmes + extremo peine de dientes finos\n- 🌸 **Sculpt baby hairs & tame flyaways** — armá baby hairs estilo K-Beauty/Latina vibes\n- 👁️ **Define cejas y pestañas** — el peine fino separa pestañas + define cejas\n- 💪 **Cerdas teasing brush** — fuertes y resistentes, dan volumen a la raíz\n- 🦱 **Detangling comb** — desenreda hasta cabello grueso/rulos\n- 📏 Tamaño: 17.6cm largo × 1.3cm ancho cabezal\n- 🎨 Color: Rosa fucsia vibrante\n- ✋ Diseño ergonómico — fácil de agarrar\n\n⚠ Stock muy limitado: solo 12 unidades.\n\nModo de uso:\n\n**Para baby hairs (pelitos del contorno cara):**\n1. Aplicá un toque de edge control / gel / mousse en el contorno del nacimiento del pelo.\n2. Con el lado **cepillo** (cerdas firmes), peinalos en la dirección que querés (estilo C, S o líneas creativas).\n3. Refiná el dibujo con el lado **peine** para separar bien los pelitos.\n\n**Para cejas:**\n1. Pasá el **peine fino** por las cejas para alinear el pelo y separar pelitos pegados.\n2. Usá el **cepillo** para uniformizar después de aplicar gel/jabón de cejas.\n\n**Para pestañas (post máscara):**\n- Pasá el peine fino para separar pestañas pegadas por el rímel.\n\nTip: lavalo cada 1-2 semanas con shampoo o jabón neutro para que las cerdas duren más.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 1900,
  compare_price: 2800,
  stock: 12,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 15,
  length_cm: 18,
  width_cm: 3,
  height_cm: 1,
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

  const galleryUrls = [];
  for (const f of galleryImages) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2 galería:", url);
    galleryUrls.push(url);
  }

  const [product] = await postRest("products", [{
    ...payload,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock:", product.stock);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: ACCESORIOS_CATEGORY_ID,
    is_primary: true,
  }]);
  console.log("  Categoría primaria: Accesorios");
})().catch((err) => { console.error("Error:", err); process.exit(1); });
