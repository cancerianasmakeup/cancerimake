import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "YT3606-23.png",                          nice: "citygirl-broche-peluche-display-4-colores.png" },
  { local: "e4331a33-258b-48fb-b1bf-7fecbbaa6007.png", nice: "citygirl-broche-peluche-detalle.png" },
];

const variantSpecs = [
  { name: "Mostaza dorado", color_hex: "#D4A86A", stock: 3 },
  { name: "Rosa pastel",    color_hex: "#E4ACAB", stock: 3 },
  { name: "Blanco crema",   color_hex: "#F2EAD9", stock: 3 },
  { name: "Marrón cocoa",   color_hex: "#7E5B45", stock: 3 },
];

const payload = {
  name: "Broche de Peluche Claw Clip — City Girl Hair Accessories",
  slug: "citygirl-broche-peluche-claw-clip-4-colores",
  description:
    "Broches de Peluche **Claw Clip** de City Girl 💗🐻 — la versión otoño-invierno suave y cute del clip clásico. Material peluche con interior plástico firme — agarra el pelo sin tirar. Vibes coquette teddy + cottagecore.\n\nPerfecto para pelo grueso, fino, ondulado o liso — el peluche evita marcas y el plástico interior asegura un agarre firme. Tendencia K-Beauty/Pinterest aesthetic.\n\nCaracterísticas:\n\n- 🐻 **Peluche súper suave** — no marca el pelo, no tira\n- 🧷 **Plástico firme interior** — agarre estable\n- 📏 Tamaño mid grande — agarra desde media coleta hasta todo el pelo\n- 🎀 Diseño cute con \"orejitas\" arriba del clip\n- 📦 Vienen en blister individual City Girl \"Hair Accessories\"\n- ✨ Look minimal coquette\n\n⚠ Stock limitado: solo 12 unidades en total (3 por color).\n\nDisponible en 4 colores. Elegí el tuyo al agregar al carrito:\n\n- **Mostaza dorado** — beige cálido / curry-honey\n- **Rosa pastel** — rosa palo dreamy\n- **Blanco crema** — off-white cottagecore\n- **Marrón cocoa** — marrón chocolate teddy bear\n\nModo de uso:\n\n1. Junta el pelo en una coleta floja, media coleta o moño descuidado.\n2. Abrí el broche apretando los costados.\n3. Cerralo agarrando el pelo. ¡Listo!\n\nIdeal para:\n\n- ☕ Skincare routine (pelo lejos de la cara)\n- 🛌 Dormir con pelo recogido sin marcarlo\n- 🧥 Looks de invierno con suéter (matchea con tonos cálidos)\n- 📸 Fotos coquette / dump aesthetic\n\nTip: combinalo con el suéter del mismo color para un look monocromático cute, o con un suéter contrastante para que sea el statement piece del outfit.\n\nÍtem City Girl YT3606.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 2000,
  compare_price: 3000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 40,
  length_cm: 12,
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

  const variantReferenceImage = galleryUrls[0]; // display 4 colores
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
