import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_705403-MLA110441829933_042026-F.webp", nice: "tei-super-stay-matte-ink-encuentra-tono-ideal.webp" },
  { local: "D_NQ_NP_2X_805008-MLA110441979507_042026-F.webp", nice: "tei-super-stay-matte-ink-swatches-mano.webp" },
  { local: "D_NQ_NP_2X_813336-MLA110440913371_042026-F.webp", nice: "tei-super-stay-matte-ink-6-tubos.webp" },
  { local: "rn-image_picker_lib_temp_a1c5a21e-46b0-4d9d-8a0f-e2dcf1832947.webp", nice: "tei-super-stay-matte-ink-display-anmat.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Mauve Nude",        color_hex: "#A6726E", stock: 4 },
  { name: "Tono 02 — Rosa Empolvado",    color_hex: "#BD7C70", stock: 4 },
  { name: "Tono 03 — Terracota Cálido",  color_hex: "#A0563E", stock: 4 },
  { name: "Tono 04 — Rojó Intenso",      color_hex: "#C7401E", stock: 4 },
  { name: "Tono 05 — Deep Brick",        color_hex: "#9A1F1F", stock: 4 },
  { name: "Tono 06 — Borgoña Burgundy",  color_hex: "#5C1F2C", stock: 4 },
];

const payload = {
  name: "Super Stay Matte Lipgloss 16h — TEI Cosmética (8281)",
  slug: "tei-super-stay-matte-lipgloss-8281",
  description:
    "Super Stay Matte Lipgloss de TEI Cosmética — labial líquido mate de **larga duración 16 horas**, fórmula full pigmento que tapa los labios con color uniforme y dura todo el día sin retoques. Formato cápsula slim con tapa blanca + cuerpo color, súper estético.\n\nCaracterísticas:\n\n- 💋 **Acabado mate intenso** — color full pigmento desde la primera pasada\n- ⏱️ **16 horas de larga duración** — aguanta café, comidas y besos\n- 🌸 Fórmula liviana — no reseca, no se cuartea\n- 🪞 Aplicador doe-foot tipo brocha plana — preciso y cómodo\n- 💎 Formato slim con cuerpo gradient color + tapa blanca\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 6 tonos pensados para diferentes momentos del día. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Mauve Nude (rosa amaderado neutral, ideal para uso diario)\n- **Tono 02** — Rosa Empolvado (rosa-marrón pastel suave)\n- **Tono 03** — Terracota Cálido (terracota cálido tipo otoñal)\n- **Tono 04** — Rojó Intenso (rojo cálido vibrante)\n- **Tono 05** — Deep Brick (rojo profundo tipo ladrillo)\n- **Tono 06** — Borgoña Burgundy (vino borgoña elegante, perfecto para noche)\n\nModo de uso:\n\n1. Aplicá una capa fina del centro hacia afuera con el aplicador.\n2. Dejá secar 30 segundos sin frotar los labios — el color se fija y queda mate.\n3. Para máxima intensidad, aplicá una segunda capa después de que la primera se seque.\n\nTip: exfoliá los labios antes de aplicar para que el mate no marque pliegues. Una vez seco podés comer y tomar tranquilo, no se va.\n\nÍtem TEI 8281.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3400,
  compare_price: 4500,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 15,
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

  const variantReferenceImage = galleryUrls[0]; // "Encuentra tu tono ideal" → muestra todos los tonos en labios
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, " slug:", product.slug, " stock total:", totalStock);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: MAQUILLAJE_CATEGORY_ID,
    is_primary: true,
  }]);

  const variantRows = variantSpecs.map((v) => ({
    product_id: product.id,
    name: v.name,
    attributes: { color_hex: v.color_hex },
    price_diff: 0,
    stock: v.stock,
    image_url: variantReferenceImage,
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
