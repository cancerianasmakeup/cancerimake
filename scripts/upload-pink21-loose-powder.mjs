import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "whatsapp-image-2024-11-11-at-6-24-28-pm-7838b2f9ca6f1b39f517313603079591-1024-1024.webp", nice: "pink21-loose-powder-display-cover.webp" },
  { local: "D_NQ_NP_2X_823616-MLA78670433215_082024-F.webp", nice: "pink21-loose-powder-display-lateral.webp" },
  { local: "D_NQ_NP_2X_897134-MLA78670527789_082024-F.webp", nice: "pink21-loose-powder-puff-tamiz.webp" },
];

const payload = {
  name: "Loose Powder Matte Finish — Pink21 (Polvo Translúcido)",
  slug: "pink21-loose-powder-matte-finish-translucido",
  description:
    "Loose Powder Matte Finish de Pink21 — polvo translúcido suelto que sella la base y elimina el brillo de la piel sin agregar color. Acabado mate natural y duradero. Para mujeres libres que aman la piel matificada pero sin perder luminosidad propia.\n\nCaracterísticas:\n\n- ✨ **Polvo translúcido** — sin color, se adapta a cualquier tono de piel\n- 🪞 **Acabado matte finish** — controla el brillo de zona T (frente, nariz, mentón)\n- 🌸 Fórmula liviana — no apelmaza, no marca líneas de expresión\n- 🎀 Frasco rosa pastel con tamiz interno (evita derrames) + puff aplicador incluido\n- 💎 Sella la base + concealer para que duren todo el día\n- 🐰 Cruelty Free\n\nModo de uso:\n\n1. Después de aplicar tu base y corrector, esperá unos segundos a que se asienten.\n2. Cargá el puff incluido con polvo (tocá en el tamiz interno, sin presionar).\n3. Aplicá con golpecitos (no frotando) sobre toda la cara o solo zona T.\n4. Sacudí el exceso con una brocha grande.\n\nTip: usalo también para baking — aplicá una capa generosa debajo de los ojos sobre el corrector, esperá 5-10 min y barré el exceso. Efecto piel impecable, base full duración.\n\nMarca Pink21 · Aprobado ANMAT.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3900,
  compare_price: 5200,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 50,
  length_cm: 6,
  width_cm: 6,
  height_cm: 4,
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
