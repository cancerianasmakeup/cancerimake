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
  { local: "D_NQ_NP_2X_686936-MLA104894136493_012026-F.webp", nice: "tei-sky-high-original-collage.webp" },
  { local: "D_NQ_NP_2X_808193-MLA98533877820_112025-F.webp",  nice: "tei-sky-high-original-display.webp" },
  { local: "D_Q_NP_953424-MLA99010149399_112025-F.webp",      nice: "tei-sky-high-original-rose-gold-brush.webp" },
  { local: "D_Q_NP_852841-MLA98533937420_112025-F.webp",      nice: "tei-sky-high-original-black-brush.webp" },
  { local: "D_Q_NP_782602-MLA99009373705_112025-F.webp",      nice: "tei-sky-high-original-dos-tubos.webp" },
];

const variantSpecs = [
  { name: "Rose Gold",  color_hex: "#D4A78A", stock: 12, ref: 2 },
  { name: "Super Black", color_hex: "#1A1A1A", stock: 12, ref: 3 },
];

const payload = {
  name: "Mascara Sky High Lash Sensational — TEI Cosmética (8002)",
  slug: "tei-mascara-sky-high-original-8002",
  description:
    "✨ Mascara Sky High de TEI Cosmética — la versión original Lash Sensational que se volvió cult. Para mujeres libres que aman pestañas largas, definidas y con drama tipo \"sky high\" (literal, llegan al cielo). Fórmula Super Black + Waterproof: color negro intenso que no se corre, no se va con la humedad y aguanta el día completo.\n\n🌟 **Beneficios:**\n\n- ✔️ Extensión y volumen al máximo en cada pasada\n- ✔️ Pestañas largas, separadas y definidas\n- ✔️ Color Super Black intenso\n- ✔️ Waterproof — resiste agua, sudor y lágrimas\n- ✔️ Cepillo flexible tipo Lash Sensational — abraza cada pestaña\n- ✔️ Ideal para look diario o de noche\n- ✔️ Sin grumos ni costras\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en dos ediciones de packaging (misma fórmula Super Black por dentro):\n\n- **Rose Gold** — envase rosé gold metalizado con detalles dorados, vibe femenina y elegante\n- **Super Black** — envase negro con detalles dorados, vibe edgy y minimal\n\n**Modo de uso:**\n\n1. Mirate al espejo desde abajo levantando el mentón.\n2. Apoyá el cepillo en la raíz de las pestañas y movelo en zig-zag hacia las puntas.\n3. Para máximo efecto, aplicá una segunda capa antes de que la primera se seque — así se fusiona y queda parejo.\n4. Bonus: pasá el cepillo también por debajo de las pestañas para abrir la mirada.\n\nTip: rizá las pestañas con eyelash curler antes de aplicar — la fórmula respeta el curl durante todo el día. Para sacar el waterproof al final del día usá desmaquillante bifásico.\n\nÍtem TEI 8002.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3000,
  compare_price: 4500,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 35,
  length_cm: 14,
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
    image_url: galleryUrls[v.ref],
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
