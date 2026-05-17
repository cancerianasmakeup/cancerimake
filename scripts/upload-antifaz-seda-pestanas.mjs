import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, R2 } from "./lib/secrets.mjs";

const ACCESORIOS_CATEGORY_ID = "d1418bcd-1e3f-4c96-896d-91547c1af0df";
const downloadsDir = "C:/Users/LIYO/Downloads";

const galleryImages = [
  { local: "D_NQ_NP_2X_983629-MLA108032797031_032026-F.webp", nice: "antifaz-seda-pestanas-rosa-hero.webp" },
  { local: "D_NQ_NP_2X_740392-MLA108032796859_032026-F.webp", nice: "antifaz-seda-pestanas-rosa-detalle-bordado.webp" },
  { local: "D_NQ_NP_2X_706718-MLA107320750586_032026-F.webp", nice: "antifaz-seda-pestanas-rosa-modelo.webp" },
  { local: "D_NQ_NP_2X_632051-MLA108031657091_032026-F.webp", nice: "antifaz-seda-pestanas-blanco.webp" },
  { local: "D_NQ_NP_2X_931712-MLA108031268765_032026-F.webp", nice: "antifaz-seda-pestanas-negro.webp" },
  { local: "D_NQ_NP_2X_956563-MLA108032526635_032026-F.webp", nice: "antifaz-seda-pestanas-rosa-flatlay.webp" },
];

const variantSpecs = [
  { name: "Rosa pastel", color_hex: "#F4C5D2", stock: 2 },
  { name: "Blanco",      color_hex: "#FFFFFF", stock: 2 },
  { name: "Negro",       color_hex: "#1A1A1A", stock: 2 },
];

const payload = {
  name: "Antifaz de Seda Saten para Dormir — Bordado Pestañas — Antiojeras",
  slug: "antifaz-seda-saten-pestanas-bordadas-dormir",
  description:
    "Antifaz de **saten/seda artificial** con pestañas bordadas blancas 💤👁️ — para dormir, viajar o meditar. Ayuda a relajarse, dormir profundo y prevenir ojeras + arrugas por la fricción de la almohada. Vibes K-Beauty hotel-spa.\n\nCaracterísticas:\n\n- 💤 **Saten suave tacto seda** — no irrita ni pega en la piel\n- 👁️ **Bordado pestañas cerradas** blanco — diseño cute clásico\n- 🌑 **Bloqueo de luz 100%** — opacidad total para dormir mejor\n- 🌸 **Antiojeras y antiarrugas** — la fricción de saten reduce líneas de expresión vs almohadas de algodón\n- ✈️ **Ideal para viajar** — pesa nada, plegable\n- 🎀 **Banda elástica negra ajustable** — no aprieta\n- 🇦🇷 Apto piel sensible\n\n⚠ Stock muy limitado: solo 6 unidades en total (2 por color).\n\nDisponible en 3 colores. Elegí el tuyo al agregar al carrito:\n\n- **Rosa pastel** — rosa suave dreamy\n- **Blanco** — clásico minimalista con pestañas negras\n- **Negro** — clásico elegante con pestañas blancas\n\nModo de uso:\n\n1. Colocá el antifaz sobre los ojos cerrados.\n2. Ajustá la banda elástica trasera (queda firme pero no aprieta).\n3. Para potenciar el efecto antiojeras: guardalo en la heladera 10 min antes de usar — frío deshincha bolsas matinales.\n\nLavado: a mano con agua fría y jabón neutro. Dejá secar al aire (no usar centrifugado / secarropas).\n\nTip beauty: combinalo con tu rutina de skincare nocturna — aplicá el contorno de ojos primero y después el antifaz; la saten ayuda a que el activo no se transfiera a la almohada.",
  category_id: ACCESORIOS_CATEGORY_ID,
  price: 5000,
  compare_price: 6800,
  status: "active",
  is_featured: false,
  cost: 0,
  weight_grams: 40,
  length_cm: 20,
  width_cm: 10,
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

  const variantImagesByName = {
    "Rosa pastel": galleryUrls[0],
    "Blanco": galleryUrls[3],
    "Negro": galleryUrls[4],
  };
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
    image_url: variantImagesByName[v.name],
  }));
  const insertedVariants = await postRest("product_variants", variantRows);
  for (const v of insertedVariants) {
    console.log(`  Variante: ${v.name} (stock ${v.stock}) — ${v.id}`);
  }
})().catch((err) => { console.error("Error:", err); process.exit(1); });
