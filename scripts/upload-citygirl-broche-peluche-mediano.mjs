import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "ChatGPT Image 17 may 2026, 06_00_29 a.m..png", nice: "citygirl-broche-peluche-mediano-display-4-colores.png" },
];

const variantSpecs = [
  { name: "Beige cálido",  color_hex: "#E7C9A2", stock: 3 },
  { name: "Gris pardo",    color_hex: "#8E827B", stock: 3 },
  { name: "Blanco crema",  color_hex: "#F2EAD9", stock: 3 },
  { name: "Rosa palo",     color_hex: "#D9A8AB", stock: 3 },
];

const payload = {
  name: "Broche de Peluche Mediano Ondulado — City Girl Hair Accessories",
  slug: "citygirl-broche-peluche-mediano-ondulado-4-colores",
  description:
    "Broches de Peluche **mediano ondulado** de City Girl 💗🐰 — versión con cuerpo más rizado y ondulado tipo \"pochoclo\" 🍿. Peluche denso súper fluffy con base curva ondulada (no recta). Vibes cottagecore, coquette teddy.\n\nLa diferencia con el broche peluche clásico es que este tiene **3 ondulaciones** en la mandíbula, dando un look más texturizado y blandito tipo pochoclo. Más volumen visual = más cute.\n\nCaracterísticas:\n\n- 🐰 **Peluche denso fluffy** — extra suave\n- 🍿 **Diseño ondulado pochoclo** — 3 ondulaciones en la base\n- 🧷 **Plástico firme interior** — agarre estable\n- 📏 Tamaño mediano — agarra hasta pelo medio-grueso\n- 🎀 Diseño cute con orejita arriba\n- 📦 Vienen en blister individual City Girl \"Hair Accessories\"\n- ✨ Look invierno coquette\n\n⚠ Stock limitado: solo 12 unidades en total (3 por color).\n\nDisponible en 4 colores. Elegí el tuyo al agregar al carrito:\n\n- **Beige cálido** — beige durazno-curry\n- **Gris pardo** — gris ratón cottagecore\n- **Blanco crema** — off-white minimal\n- **Rosa palo** — rosa pastel dreamy\n\nModo de uso:\n\n1. Junta el pelo en media coleta, moño descuidado o coleta floja.\n2. Apretá los costados del broche para abrirlo.\n3. Pasalo por el pelo y soltá — agarra firme sin tirar.\n\nDiferencia con el otro broche peluche disponible en la tienda:\n\n- 🧸 **Broche peluche clásico** → base recta + mostaza/marrón disponibles\n- 🍿 **Este (mediano ondulado)** → base ondulada + gris/rosa palo disponibles\n\nIdeal para:\n\n- 🧥 Looks invierno con suéter de cashmere\n- ☕ Recoger pelo para skincare / dormir\n- 📸 Fotos coquette aesthetic\n- 🎁 Regalo cute para amiga / mamá / hermana\n\nÍtem City Girl.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 2000,
  compare_price: 3000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 35,
  length_cm: 11,
  width_cm: 8,
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
