import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "1744144973738-my805010-caja--768x768.webp", nice: "mely-matte-lipstick-liquid-display-cover.webp" },
  { local: "1764340250561-my805010-3.webp",             nice: "mely-matte-lipstick-liquid-tubos-glass.webp" },
  { local: "1745243833794-my805010-todos.webp",         nice: "mely-matte-lipstick-liquid-6-tonos.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Coral suave",      color_hex: "#E89A7C", stock: 4 },
  { name: "Tono 02 — Rosa palo",        color_hex: "#D89898", stock: 4 },
  { name: "Tono 03 — Terracota",        color_hex: "#B05A3A", stock: 4 },
  { name: "Tono 04 — Cereza",           color_hex: "#C42044", stock: 4 },
  { name: "Tono 05 — Vino burgundy",    color_hex: "#6E1F2C", stock: 4 },
  { name: "Tono 06 — Marrón rojizo",    color_hex: "#8A3A28", stock: 4 },
];

const payload = {
  name: "Matte Lipstick Liquid — Mely Beauty (MY805010)",
  slug: "mely-matte-lipstick-liquid-my805010",
  description:
    "Matte Lipstick Liquid de Mely Beauty — labial líquido mate de larga duración en frasco squared frosted con tapa metalizada plateada. Color full pigmento, acabado mate intenso, sin transferencia. Para mujeres libres que quieren un labial que aguante el día sin retoques.\n\nCaracterísticas:\n\n- 💋 **Acabado matte intenso** — color full desde la primera pasada\n- ⏱️ Larga duración — aguanta el día sin caerse\n- 🚫 No se transfiere a la copa, café o pareja\n- 🪞 Aplicador doe-foot tipo brocha plana — preciso y cómodo\n- 💎 Frasco frosted cuadrado con tapa metálica — pieza linda para el tocador\n- 🌸 Fórmula liviana — no reseca, no se cuartea\n- 🐰 Cruelty Free\n\nDisponible en 6 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Coral suave (peach-coral fresco)\n- **Tono 02** — Rosa palo (rosa neutro para uso diario)\n- **Tono 03** — Terracota (terracota cálido sunkissed)\n- **Tono 04** — Cereza (rojo cereza vibrante)\n- **Tono 05** — Vino burgundy (vino oscuro elegante, ideal noche)\n- **Tono 06** — Marrón rojizo (terracota oscuro tipo otoñal)\n\nModo de uso: aplicá una capa fina del centro hacia afuera con el aplicador. Dejá secar 30 segundos sin frotar los labios — el color se fija mate. Para máximo color, segunda capa después de que la primera se asiente.\n\nTip: exfoliá los labios antes de aplicar para que el mate no marque pliegues. Una vez seco podés comer y tomar tranquila.\n\nCódigo Mely MY805010.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3100,
  compare_price: 4200,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 18,
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

  const variantReferenceImage = galleryUrls[2]; // foto con los 6 tonos
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
