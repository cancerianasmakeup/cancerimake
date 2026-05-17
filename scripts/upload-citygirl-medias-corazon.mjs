import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "SM-31552-2.png", nice: "citygirl-medias-corazon-6-colores-display.png" },
];

const variantSpecs = [
  { name: "Negro",           color_hex: "#1A1A1A", stock: 2 },
  { name: "Gris oscuro",     color_hex: "#5C5C5C", stock: 2 },
  { name: "Gris claro",      color_hex: "#B8B8B8", stock: 2 },
  { name: "Crema vainilla",  color_hex: "#F5EFD0", stock: 2 },
  { name: "Marrón vino",     color_hex: "#4A2222", stock: 2 },
  { name: "Blanco",          color_hex: "#FAFAFA", stock: 2 },
];

const payload = {
  name: "Medias Largas con Corazón Bordado — Algodón — City Girl (par)",
  slug: "citygirl-medias-largas-corazon-bordado",
  description:
    "Medias largas City Girl con **corazón bordado** 💗🧦 — **\"Soft · Cozy · You\"**. Algodón suave, caña media-alta, con un corazón chiquito tejido al frente del tobillo. Vibes coquette + minimalist. Quedan increíbles con zapatillas, mocasines o borcegos.\n\nCaracterísticas:\n\n- 💗 **Corazón tejido al frente del tobillo** — detalle cute discreto\n- 🧶 **Algodón suave** — \"soft · cozy\"\n- 📏 **Caña media-alta** (rib knit) — se ven al ras o pueden ir hasta el bajo del pantalón\n- 🦶 Talle único — sirven a pie 35-40\n- 📦 Venta por **par** (1 par por compra)\n- 🇦🇷 Marca City Girl\n\n⚠ Stock limitado: 12 pares en total (2 por color). Cuando se va un color, se va.\n\nDisponible en 6 colores. Elegí el tuyo al agregar al carrito:\n\n- **Negro** — clásico con corazón blanco · matchea con todo\n- **Gris oscuro** — corazón negro · neutro modernos\n- **Gris claro** — corazón negro · suave casual\n- **Crema vainilla** — corazón rosa · soft coquette\n- **Marrón vino** — corazón rosa · otoño vibes\n- **Blanco** — minimal clean\n\nIdeal para:\n\n- 👟 Zapatillas (Adidas Samba, Nike, Converse) — se ven asomando arriba\n- 🥾 Borcegos con falda — corazón a la vista\n- 🪞 Looks coquette / pinterest girl aesthetic\n- 🏠 Andar por casa cozy\n- 🎁 Regalo cute para amiga\n\nTip styling: usalas con **medias de distinto color** en cada pie (\"mismatch socks\") para ese vibe Y2K/Gorpcore que arrasa en TikTok.\n\nCuidado:\n\n- Lavá en frío (max 30°C) — preferiblemente a mano\n- NO usar lavandina (el corazón puede perder color)\n- Secar al aire (no centrifugado)\n\nÍtem City Girl SM-31552.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 3000,
  compare_price: 4200,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 50,
  length_cm: 25,
  width_cm: 10,
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
    category_id: ACCESORIOS_CATEGORY_ID,
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
