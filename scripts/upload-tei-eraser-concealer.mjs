import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const MAQUILLAJE_CATEGORY_ID = "a7557e9c-bca6-4598-80bd-ffcc4c1b11bf";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "3-1-0cea1751e5246ba49e17559639441944-1024-1024.webp",      nice: "tei-eraser-concealer-multi-use-before-after.webp" },
  { local: "4-1fec15c117c2bf76f417559639471142-640-0.webp",             nice: "tei-eraser-concealer-aplicador-esponjinha.webp" },
  { local: "D_NQ_NP_2X_991220-MLA106777760122_022026-F.webp",          nice: "tei-eraser-concealer-display-cover.webp" },
  { local: "D_NQ_NP_2X_769228-MLA106982666030_022026-F.webp",          nice: "tei-eraser-concealer-frasco-marble.webp" },
];

const variantSpecs = [
  { name: "Tono 01 — Light porcelana",  color_hex: "#F5DCC3", stock: 4, file: "1-635d7ff3a5cf396f4117592457772167-640-0.webp", nice: "tei-eraser-tono-01.webp" },
  { name: "Tono 02 — Light beige",      color_hex: "#EDC9A6", stock: 4, file: "2-6b2ed3c3c3f5c53d9517592457775798-640-0.webp", nice: "tei-eraser-tono-02.webp" },
  { name: "Tono 03 — Beige natural",    color_hex: "#E3B690", stock: 4, file: "3-b7d0f5f8a9a8f45b8717592457783910-640-0.webp", nice: "tei-eraser-tono-03.webp" },
  { name: "Tono 04 — Beige medio",      color_hex: "#D6A06E", stock: 4, file: "4-00481e04d74c7cfefc17592457774453-640-0.webp", nice: "tei-eraser-tono-04.webp" },
  { name: "Tono 05 — Honey cálido",     color_hex: "#C68F58", stock: 4, file: "5-4ebff2ca907b1792c817592457775793-640-0.webp", nice: "tei-eraser-tono-05.webp" },
  { name: "Tono 06 — Caramelo",         color_hex: "#B07A48", stock: 4, file: "6-1c936c6821c4a1d9ff17592457774679-640-0.webp", nice: "tei-eraser-tono-06.webp" },
];

const payload = {
  name: "Eraser Concealer Instant Anti-Age — TEI Cosmética (8010)",
  slug: "tei-eraser-concealer-instant-anti-age-8010",
  description:
    "Eraser Concealer Instant Anti-Age de TEI Cosmética — corrector líquido multi-uso con aplicador de esponjita antimicrobiana 🪄. Inspirado en el cult Maybelline Age Rewind. Tapa, ilumina y rejuvenece la mirada al instante. Para mujeres libres que aman corrector que cubra sin marcar pliegues.\n\nCaracterísticas:\n\n- ✨ **Multi-Use Concealer** — sirve para ojeras, manchitas, rojeces, contorno luminoso\n- 🪶 **Aplicador esponjita** protegido por sistema antimicrobiano — fácil aplicación con golpecitos\n- ⏱️ **Hasta 12 horas** de duración hidratante (Up to 12HR Moisturizing Wear)\n- 💧 **Crease Resistant Coverage** — no se mete en las líneas de expresión\n- 🪞 **Satin Finish Hydrating** — acabado satinado natural, no mate plasta\n- 🍃 **Instant Anti-Age** — efecto rejuvenecedor visual al toque\n- 🐰 Cruelty Free · Autorizado ANMAT\n\nDisponible en 6 tonos. Elegí el tuyo al agregar al carrito:\n\n- **Tono 01** — Light porcelana (piel muy clara con subtono rosado)\n- **Tono 02** — Light beige (piel clara neutra)\n- **Tono 03** — Beige natural (piel media-clara)\n- **Tono 04** — Beige medio (piel media cálida)\n- **Tono 05** — Honey cálido (piel media-oscura cálida)\n- **Tono 06** — Caramelo (piel oscura)\n\nModo de uso:\n\n1. Presioná suave la esponjita 1-2 veces para cargar producto.\n2. Aplicá puntitos en la zona a corregir (debajo del ojo en triángulo invertido, sobre granitos, en alas de la nariz).\n3. Difuminá con la misma esponjita con golpecitos suaves (no frotando).\n4. Sellá con un toque de polvo translúcido si querés más duración.\n\nTip pro: para iluminar el contorno del ojo y abrir la mirada, dibujá un triángulo invertido (de la sien al pómulo) y difuminá hacia afuera.\n\nÍtem TEI 8010.",
  category_id: MAQUILLAJE_CATEGORY_ID,
  price: 3700,
  compare_price: 5000,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 25,
  length_cm: 13,
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
