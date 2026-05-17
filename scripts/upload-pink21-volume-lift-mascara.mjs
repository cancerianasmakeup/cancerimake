import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const files = [
  { local: "whatsapp-image-2025-08-20-at-17-14-04-8efbd724a2bc7b7e8317558179162865-640-0.jpg", nice: "pink21-volume-lift-cover-caracteristicas.jpg" },
  { local: "photoroom_20240116_115354-8a06e5912aa754e36b17558179177363-640-0.jpeg",            nice: "pink21-volume-lift-mascara-pestanas.jpeg" },
  { local: "img_7937-825fc338ff8538b30817558179188384-640-0.jpeg",                              nice: "pink21-volume-lift-display.jpeg" },
  { local: "D_NQ_NP_2X_778760-MLA74413212665_022024-F.webp",                                    nice: "pink21-volume-lift-cepillo-zoom.webp" },
  { local: "D_NQ_NP_2X_797359-MLA74413476887_022024-F.webp",                                    nice: "pink21-volume-lift-frasco-abierto.webp" },
  { local: "D_NQ_NP_2X_955219-MLA74414159853_022024-F.webp",                                    nice: "pink21-volume-lift-tres-tubos.webp" },
];

const payload = {
  name: "Volume & Lift Mascara — Pink21 (CS4133)",
  slug: "pink21-volume-lift-mascara-cs4133",
  description:
    "Volume & Lift Mascara de Pink21 — máscara de pestañas con doble efecto: volumen + alargamiento en una sola pasada. Para mujeres libres que aman pestañas dramáticas con drama sin caer en lo plástico. Tubo metalizado violeta-rosado súper aesthetic.\n\nCaracterísticas:\n\n- 👁️ **Extra Volumen** — fórmula densa que infla cada pestaña sin grumos\n- ⬆️ **Efecto Lift** — eleva y curva la pestaña, abriendo la mirada\n- 🖤 **Color negro intenso** — pigmento full desde la primera pasada\n- ✨ Cepillo cónico (más ancho en el centro, más fino en la punta) — perfecto para llegar a las pestañas del lagrimal\n- 💎 Tubo metalizado violeta-rosa iridiscente — pieza linda para el tocador\n- 🐰 Cruelty Free · Aprobado ANMAT\n\n**Modo de uso:**\n\n1. Mirate al espejo desde abajo levantando el mentón.\n2. Apoyá el cepillo en la raíz de las pestañas y movelo en zig-zag suave hacia las puntas.\n3. Para máximo volumen, aplicá una segunda capa antes de que la primera se seque — se fusionan y se ve más denso.\n4. Bonus: usá la punta fina del cepillo para definir las pestañas inferiores y las del lagrimal.\n\nTip: si querés efecto pestañas postizas sin postizas, combiná esta máscara con un eyelash curler antes de aplicar. La fórmula respeta el curl durante todo el día.\n\nÍtem Pink21 CS4133.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3600,
  compare_price: 4700,
  stock: 24,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 30,
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
  const urls = [];
  for (const f of files) {
    const full = path.join(downloadsDir, f.local);
    const url = await uploadToR2(client, full, f.nice);
    console.log("  R2:", url);
    urls.push(url);
  }

  const [product] = await postRest("products", [{ ...payload, images: urls }]);
  console.log("  Product ID:", product.id, " slug:", product.slug);

  await postRest("product_categories", [{
    product_id: product.id,
    category_id: MAQUILLAJE_CATEGORY_ID,
    is_primary: true,
  }]);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
