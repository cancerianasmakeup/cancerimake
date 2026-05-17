import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_793672-MLA91443555433_092025-F.webp", nice: "tei-lifter-shiny-display-tonos.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Glitter rosa",       color_hex: "#D88FA0", stock: 4 },
  { name: "Tono 02 — Glitter cereza",     color_hex: "#B83447", stock: 4 },
  { name: "Tono 03 — Glitter nude",       color_hex: "#D2A78A", stock: 4 },
  { name: "Tono 04 — Glitter caramelo",   color_hex: "#9C5C3E", stock: 4 },
  { name: "Tono 05 — Glitter coral",      color_hex: "#CD6F5E", stock: 4 },
  { name: "Tono 06 — Glitter vino",       color_hex: "#6E1F2C", stock: 4 },
];

const payload = {
  name: "Lifter Shiny — Lip Gloss Brillo con Glitter — TEI Cosmética (8154)",
  slug: "tei-lifter-shiny-lip-gloss-8154",
  description:
    "Lifter Shiny de TEI Cosmética — **lip gloss SUPER SHINY** con micro glitter y fórmula hidratante. Super Shiny pero NO se siente pegajoso (no sticky feel), light touch, fórmula que hidrata + da efecto visual de volumen. Para mujeres libres que aman labios con brillo cristal + chispitas. ✨💋\n\nCaracterísticas:\n\n- ✨ **Super Shiny, no sticky** — brillo extremo sin sensación pegajosa\n- 💧 **Hydrating formulation** — hidrata los labios mientras los hace brillar\n- 🌸 **Light touch** — sensación liviana, casi imperceptible\n- 💎 **Micro glitter incorporado** — efecto cristal con chispitas\n- 🍒 **Con aroma** — fragancia frutal suave\n- 🎨 Aplicador doe-foot tipo brocha\n- 🪞 Envase transparente con tapa rosa nude + relieve **LIFTER**\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 6 tonos con glitter. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Glitter rosa (rosa con chispas)\n- **Tono 02** — Glitter cereza (rojo cereza con chispas)\n- **Tono 03** — Glitter nude (nude con chispas dorado-rosa)\n- **Tono 04** — Glitter caramelo (caramelo cálido con chispas)\n- **Tono 05** — Glitter coral (coral con chispas)\n- **Tono 06** — Glitter vino (vino oscuro con chispas)\n\nModo de uso: aplicá una capa del centro hacia afuera. Para efecto cristal-volumen, retocá en el centro del labio inferior. Podés usarlo solo o sobre un labial mate para combinar pigmento + glitter shine.\n\nTip: ideal para fotos / noche / eventos — el glitter reacciona con la luz y da efecto labios jugosos.\n\nÍtem TEI 8154.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3200,
  compare_price: 4000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 20,
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

  const variantReferenceImage = galleryUrls[0];
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
