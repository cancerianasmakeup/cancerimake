import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const SUPABASE_URL = "https://qccfsbjshlomvyfabtra.supabase.co";
const SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjY2ZzYmpzaGxvbXZ5ZmFidHJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg3ODQ1NSwiZXhwIjoyMDkzNDU0NDU1fQ.OV-VJ85BguDDZw9N1_H07D9VwwBEb6B_L0xKh4HIlzE";

const R2 = {
  accountId: "c80fd3d522f165db46f0eef13f65d471",
  accessKeyId: "7d6c0ba81c9ac18637e6bce6d565149c",
  secretAccessKey:
    "eaf21ba907858297f98bc8c94511b2847e30593a1b5998e120dd966432bf1064",
  bucket: "cancerianasmakeup",
  prefix: "CANCERIANAS PRODUCTOS",
  publicBaseUrl: "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev",
};

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "my801062-1-jpg-web-502519a67c1b42ad8417593437609205-1024-1024.webp", nice: "mely-spark-cover-frasco.webp" },
  { local: "22-bc62fc7740311db16a17610682407297-1024-1024.webp",                  nice: "mely-spark-fila-6-tonos.webp" },
  { local: "3a7c43fc3a0192c6bda27e0e98ee7104dab266f8e43919fcb574b9c1641ff9e6364.jpg", nice: "mely-spark-lifestyle-pink.jpg" },
];

const variantSpecs = [
  { name: "Tono 01 — Champagne dorado", color_hex: "#D9B97C", stock: 4, file: "my801062-2-tono-1-jpg-web-b72b75c31042d632fc17593437607978-1024-1024.webp", nice: "mely-spark-tono-01.webp" },
  { name: "Tono 02 — Rosa baby",        color_hex: "#F5C5D1", stock: 4, file: "my801062-4-tono-2-jpg-web-333fddc4339d86d4ab17592652635125-1024-1024.webp", nice: "mely-spark-tono-02.webp" },
  { name: "Tono 03 — Nude shimmer",     color_hex: "#E6BBA8", stock: 4, file: "my801062-5-tono-3-jpg-web-7756e3932757b6e1f417592652632436-1024-1024.webp", nice: "mely-spark-tono-03.webp" },
  { name: "Tono 04 — Rosa fucsia",      color_hex: "#E47AA8", stock: 4, file: "my801062-6-tono-4-jpg-web-5ccf492d771b6579eb17592652638237-1024-1024.webp", nice: "mely-spark-tono-04.webp" },
  { name: "Tono 05 — Frambuesa",        color_hex: "#BC2E5C", stock: 4, file: null,                                                                          nice: null }, // sin foto individual → reusa fila
  { name: "Tono 06 — Rojo cereza",      color_hex: "#C81E2C", stock: 4, file: "my801062-8-tono-6-jpg-web-d6c91e92a075144fdb17592652642429-1024-1024.webp", nice: "mely-spark-tono-06.webp" },
];

const payload = {
  name: "Spark Lip Gloss Shimmer — Mely Beauty (MY801062)",
  slug: "mely-spark-lipgloss-my801062",
  description:
    "Spark Lip Gloss de Mely Beauty — labial gloss con shimmer multicromático en frasco mini super aesthetic con tapa blanca tipo \"cápsula\". Para mujeres libres que aman labios brillosos con destellos que captan la luz desde cualquier ángulo. Pequeño, lindo, rinde un montón y entra en cualquier neceser.\n\nCaracterísticas:\n\n- ✨ Acabado gloss + shimmer multicromático (destellos que cambian con la luz)\n- 💋 Aplicador doe-foot tipo besito — cómodo y preciso\n- 🩷 Fórmula no pegajosa — se siente liviana, no se siente \"pesada\"\n- 🌸 Hidrata y deja los labios con efecto plump natural\n- 🪞 Se puede usar solo o encima de tu labial mate favorito (para potenciar volumen)\n- 💎 Frasco mini blanco-perlado tipo bullet — cute para llevar a todos lados\n- 🐰 Cruelty Free\n\nDisponible en 6 tonos con distinto shimmer dominante. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Champagne dorado (gold shimmer base translúcida — efecto luminoso neutro)\n- **Tono 02** — Rosa baby (rosa muy claro con shimmer iridiscente)\n- **Tono 03** — Nude shimmer (nude rosado con destellos rosa-violeta)\n- **Tono 04** — Rosa fucsia (rosa hot con shimmer rosa-violeta intenso)\n- **Tono 05** — Frambuesa (rojo-rosado vino con shimmer rojizo)\n- **Tono 06** — Rojo cereza (rojo intenso con shimmer rojo-dorado)\n\nModo de uso: aplicá una capa directo sobre los labios. Para look más intenso, aplicalo encima de tu labial mate — el shimmer se ve aún más. Tip: en el centro del labio inferior aplicá un poquito más — efecto labio carnoso instantáneo.\n\nCódigo Mely MY801062.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2700,
  compare_price: 3600,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 12,
  length_cm: 8,
  width_cm: 2,
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
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
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
    if (!v.file) {
      variantUrls.push(galleryUrls[1]); // fila 6 tonos para Tono 05 sin foto individual
      continue;
    }
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
  console.log("  Product ID:", product.id, "  Stock total:", totalStock);

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
