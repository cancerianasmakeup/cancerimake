// scripts/seed-store-settings.mjs
// Siembra la identidad de una tienda recién creada en su tabla site_settings:
// nombre de marca, logo del menú y estado inicial. Todo lo demás (Mercado Pago,
// transferencia, envíos) se carga después desde /admin/settings.
//
// Es idempotente: vuelve a correrlo las veces que quieras. Solo pisa las claves
// que este script maneja y respeta el resto del objeto que ya esté guardado.
//
// USO
// ---
//   TARGET_SUPABASE_URL=https://xxxx.supabase.co \
//   TARGET_SERVICE_ROLE=eyJhbGciOi... \
//   STORE_NAME="Cancerianas Mar del Plata" \
//   STORE_LOGO=https://.../header-mar-del-plata.webp \
//   node scripts/seed-store-settings.mjs

const SUPABASE_URL = process.env.TARGET_SUPABASE_URL;
const SERVICE_ROLE = process.env.TARGET_SERVICE_ROLE;
const STORE_NAME = process.env.STORE_NAME ?? "Cancerianas Mar del Plata";
const STORE_LOGO =
  process.env.STORE_LOGO ??
  "https://pub-4ee8d6afe02b441fa29b28b501f5a6be.r2.dev/LOGOSNUEVOS/optimizados/header-mar-del-plata.webp";

const faltan = [];
if (!SUPABASE_URL) faltan.push("TARGET_SUPABASE_URL");
if (!SERVICE_ROLE) faltan.push("TARGET_SERVICE_ROLE");
if (faltan.length) {
  console.error(`\nFaltan variables: ${faltan.join(", ")}\n`);
  process.exit(1);
}

const H = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  "Content-Type": "application/json",
};

async function leer(key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.${key}&select=value`, {
    headers: H,
  });
  if (!r.ok) throw new Error(`leer ${key}: ${r.status} ${await r.text()}`);
  const rows = await r.json();
  return rows.length ? rows[0].value : null;
}

async function guardar(key, value) {
  // upsert: la fila puede no existir si la migración de settings no la sembró
  const r = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?on_conflict=key`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ key, value }),
  });
  if (!r.ok) throw new Error(`guardar ${key}: ${r.status} ${await r.text()}`);
  return (await r.json())[0];
}

// --- brand_info: solo nombre y logo; el resto queda como esté ---
const brandActual = (await leer("brand_info")) ?? {};
const brand = {
  ...brandActual,
  name: STORE_NAME,
  logo_url: STORE_LOGO,
};
await guardar("brand_info", brand);
console.log("brand_info");
console.log("  name     :", brand.name);
console.log("  logo_url :", brand.logo_url);

// --- store_status: la tienda nueva arranca CERRADA a la fuerza, para poder
//     cargar productos y configurar sin que nadie entre a comprar a medio
//     armar. El campo es force_state ('auto' | 'open' | 'closed'), no status. ---
const statusActual = (await leer("store_status")) ?? {};
if (statusActual.force_state === "closed") {
  console.log("store_status: ya estaba forzada cerrada, no se toca");
} else {
  await guardar("store_status", { ...statusActual, force_state: "closed" });
  console.log("store_status: force_state=closed (se abre desde /admin/store)");
}

console.log("\nListo. El resto (Mercado Pago, transferencia, envíos) se carga desde /admin/settings.");
