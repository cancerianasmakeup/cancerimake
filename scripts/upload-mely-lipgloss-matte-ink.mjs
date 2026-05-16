import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";
const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_844126-MLA93411362697_092025-F.webp", nice: "mely-lipgloss-matte-fila-6-tubos.webp" },
  { local: "D_Q_NP_893123-MLA93411214081_092025-F.webp",     nice: "mely-lipgloss-matte-display-lifestyle.webp" },
  { local: "D_Q_NP_997283-MLA92996701728_092025-F.webp",     nice: "mely-lipgloss-matte-display-cerrado.webp" },
  { local: "1744749198569-my805002-photoroom-photoroom-430x430.webp", nice: "mely-lipgloss-matte-photoroom.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Nude peach",       color_hex: "#C28A78", stock: 4 },
  { name: "Tono 02 — Berry mauve",      color_hex: "#9C5F61", stock: 4 },
  { name: "Tono 03 — Berry oscuro",     color_hex: "#7C3E4F", stock: 4 },
  { name: "Tono 04 — Vino burgundy",    color_hex: "#5E1F2B", stock: 4 },
  { name: "Tono 05 — Marrón rojizo",    color_hex: "#8A3A28", stock: 4 },
  { name: "Tono 06 — Rojo clásico",     color_hex: "#B81C20", stock: 4 },
];

const payload = {
  name: "Lip Gloss Matte Ink Music Collection — Mely Beauty",
  slug: "mely-beauty-lipgloss-matte-ink-music",
  description:
    "Lip Gloss Matte Ink de Mely Beauty — colección Music con packaging musical súper aesthetic. Labial líquido mate intenso, full pigmento, larga duración y formato slim/elegante. Dupe accesible del Super Stay Matte Ink — para mujeres libres que aman labial mate que aguanta el día sin retoques.\n\nCaracterísticas:\n\n- 💋 Fórmula mate intenso — color full pigmento desde la primera pasada\n- ⏱️ Larga duración: aguanta horas sin transferirse\n- 🎵 Packaging Music Collection con notas musicales — colección de edición\n- 🪞 Acabado mate (no brilloso al secarse)\n- 🌸 Aplicador doe-foot tipo brocha plana — preciso y fácil de aplicar\n- 💎 Formato slim cuadrado con tapa blanca\n- 🐰 Cruelty Free\n\nDisponible en 6 tonos que recorren del nude peach al rojo clásico — todos pensados para uso diario y looks de noche. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Nude peach (nude rosado-durazno suave para uso diario)\n- **Tono 02** — Berry mauve (mauve rosado con fondo marrón)\n- **Tono 03** — Berry oscuro (berry profundo con fondo vino)\n- **Tono 04** — Vino burgundy (vino oscuro intenso, ideal noche)\n- **Tono 05** — Marrón rojizo (terracota cálido, vibe otoñal)\n- **Tono 06** — Rojo clásico (rojo intenso atemporal)\n\nModo de uso: aplicá una capa fina del centro hacia afuera con el aplicador. Dejá secar 30 segundos sin frotar los labios — el color se fija y queda mate. Para máximo color, aplicá una segunda capa después de que la primera se seque.\n\nTip: exfoliá los labios antes de aplicar para que el mate no marque pliegues. Si querés un look gradiente, aplicá solo en el centro y difuminá con el dedo hacia afuera.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2700,
  compare_price: 3700,
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

  const variantReferenceImage = galleryUrls[0];
  const totalStock = variantSpecs.reduce((s, v) => s + v.stock, 0);

  const [product] = await postRest("products", [{
    ...payload,
    stock: totalStock,
    images: galleryUrls,
  }]);
  console.log("  Product ID:", product.id, "  Stock total:", totalStock);

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
