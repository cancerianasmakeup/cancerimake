import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_902544-MLA89011683167_072025-F.webp", nice: "mely-liquid-blusher-display-mejilla.webp" },
  { local: "D_NQ_NP_2X_970403-MLA88907606453_072025-F.webp", nice: "mely-liquid-blusher-single-frasco.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Rojo coral",       color_hex: "#B7372A", stock: 4, file: "my818005-tono-1-bfc33d2358e91d9f4d17448309212767-1024-1024.webp", nice: "mely-blusher-tono-01.webp" },
  { name: "Tono 02 — Coral cálido",      color_hex: "#D14E2F", stock: 4, file: "my818005-tono-2-1effd7c46c9842e49017448309208917-1024-1024.webp", nice: "mely-blusher-tono-02.webp" },
  { name: "Tono 03 — Terracota",         color_hex: "#A85436", stock: 4, file: "my818005-tono-3-82fef8dbce32ee01a617448309208433-1024-1024.webp", nice: "mely-blusher-tono-03.webp" },
  { name: "Tono 04 — Rosa durazno",      color_hex: "#E0A39A", stock: 4, file: "my818005-tono-4-63e1fbf5389f34f48d17448309210015-1024-1024.webp", nice: "mely-blusher-tono-04.webp" },
  { name: "Tono 05 — Durazno cálido",    color_hex: "#E08D5E", stock: 4, file: "my818005-tono-5-087b2d987bba9b250a17448309209051-1024-1024.webp", nice: "mely-blusher-tono-05.webp" },
  { name: "Tono 06 — Naranja terracota", color_hex: "#C26538", stock: 4, file: "my818005-tono-6-3aee2b2df0848b937c17448309205563-1024-1024.webp", nice: "mely-blusher-tono-06.webp" },
];

const payload = {
  name: "Liquid Blusher Cute Girl — Mely Beauty (MY818005)",
  slug: "mely-liquid-blusher-cute-girl",
  description:
    "Liquid Blusher Cute Girl de Mely Beauty — rubor líquido con esponjita aplicador integrada en la tapa. La carita más cute del make: girás el envase, sale producto a la esponjita, y stampás directo en la mejilla. Acabado natural tipo \"piel sonrojada\" — el favorito de las mujeres libres que aman el look fresh & dewy.\n\nCaracterísticas:\n\n- 🍑 **Fórmula líquida** — buildable y fácil de difuminar\n- 🪶 **Esponjita aplicador** integrada en la tapa (no necesitás brocha)\n- ✨ Acabado natural luminoso — efecto cheek glow\n- 💧 Larga duración: aguanta el día sin caerse\n- 💖 Funciona también como tinta labial — multifunción\n- 📦 Frasco mate translúcido rosa, formato compacto\n- 🐰 Cruelty Free\n\nDisponible en 6 tonos cute. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Rojo coral (cherry rojo cálido)\n- **Tono 02** — Coral cálido (naranja-rojo vibrante)\n- **Tono 03** — Terracota (marrón rojizo cálido)\n- **Tono 04** — Rosa durazno (rosa suave natural)\n- **Tono 05** — Durazno cálido (peach-orange luminoso)\n- **Tono 06** — Naranja terracota (terracota naranja, sunkissed)\n\nModo de uso:\n\n1. Girá la base del envase 2-3 vueltas para que la esponjita se cargue de producto.\n2. Stampá la esponjita directo en la parte alta del pómulo (\"manzanitas\").\n3. Difuminá con el dedo o esponja húmeda haciendo movimientos circulares hacia la sien.\n4. Sellá con un toque de polvo translúcido si querés mayor duración.\n\nTip multifunción: aplicalo también en los labios como tinta, en el puente de la nariz para efecto sunkissed, o en los párpados como sombra crema.\n\nCódigo Mely MY818005.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3600,
  compare_price: 4800,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
  length_cm: 10,
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

  const variantUrls = [];
  for (const v of variantSpecs) {
    const full = path.join(downloadsDir, v.file);
    const url = await uploadToR2(client, full, v.nice);
    console.log(`  R2 ${v.name}:`, url);
    variantUrls.push(url);
  }

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

  const variantRows = variantSpecs.map((v, i) => ({
    product_id: product.id,
    name: v.name,
    attributes: { color_hex: v.color_hex },
    price_diff: 0,
    stock: v.stock,
    image_url: variantUrls[i],
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
