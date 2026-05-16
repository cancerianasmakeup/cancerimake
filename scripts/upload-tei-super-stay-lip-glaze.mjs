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
  { local: "1-ee77eaf93f65bc9b7c17641883058846-1024-1024.webp", nice: "tei-super-stay-matte-lip-glaze-infografia.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Vino berry",     color_hex: "#6E1F33", stock: 4 },
  { name: "Tono 02 — Rojo intenso",   color_hex: "#B81C20", stock: 4 },
  { name: "Tono 03 — Rosa fucsia",    color_hex: "#B83A6D", stock: 4 },
  { name: "Tono 04 — Berry marrón",   color_hex: "#7A4244", stock: 4 },
  { name: "Tono 05 — Pink coral",     color_hex: "#D58A75", stock: 4 },
  { name: "Tono 06 — Nude marrón",    color_hex: "#9C6A4D", stock: 4 },
];

const payload = {
  name: "Super Stay Matte Lip Glaze 24h — TEI Cosmética (8469)",
  slug: "tei-super-stay-matte-lip-glaze-8469",
  description:
    "Super Stay Matte Lip Glaze de TEI Cosmética — labial líquido mate de máxima duración (¡24 horas long lasting!), transfer-proof y waterproof. La cápsula que se transformó en favorita de las mujeres libres que aman color mate intenso sin retoques en todo el día.\n\nCaracterísticas:\n\n- 💋 Acabado matte finish — sin brillo, color full pigmento\n- ⏱️ Long lasting 24h — aguanta el día entero sin caerse\n- 🚫 Transfer-proof — no se transfiere al café, a las copas ni al beso\n- 💧 Water-proof — resiste agua y sudor\n- 🪞 Fórmula liviana — no reseca, no se cuartea\n- 🌸 Aplicador doe-foot — preciso y cómodo\n- 💎 Formato cuadrado tipo \"cubo\" con tapa magnética\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 6 tonos de la línea berry-rojo-nude — todos pensados para uso diario y looks de noche. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Vino berry (vino oscuro intenso, vibe noche)\n- **Tono 02** — Rojo intenso (rojo clásico atemporal)\n- **Tono 03** — Rosa fucsia (pink intenso vibrante)\n- **Tono 04** — Berry marrón (berry oscuro con fondo marrón)\n- **Tono 05** — Pink coral (rosa-coral fresco para uso diario)\n- **Tono 06** — Nude marrón (nude cálido con fondo café)\n\nModo de uso: aplicá una capa fina del centro hacia afuera con el aplicador. Dejá secar 30 segundos sin frotar los labios — el color se fija y queda mate. Para máxima intensidad, aplicá una segunda capa después de que la primera se seque.\n\nTip: exfoliá los labios antes de aplicar para que el mate no marque pliegues. Una vez seco, podés comer y tomar — no se va.\n\nÍtem TEI 8469.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 2900,
  compare_price: 3900,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 18,
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
