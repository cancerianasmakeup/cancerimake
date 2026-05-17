// Actualiza weight_grams de todos los productos según un mapeo por slug.
// Para envío Correo Argentino — los tiers son ≤1kg / ≤3kg / ≤5kg, así que
// las estimaciones razonables alcanzan. Después se suma +200g de embalaje
// fijo en calcPackageFromCart() (films, cartón, burbuja).

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from "./lib/secrets.mjs";

// Mapeo explícito slug → weight_grams. Sólo se actualiza si el slug coincide.
// Los que NO aparecen acá quedan como están (los que ya tienen un peso cargado).
const WEIGHTS = {
  // ===== Body Mists / Body Splash / Perfumes (ajustes) =====
  "vvlove-blazing-rose-body-mist-250ml": 300,
  "vvlove-royal-sweety-body-mist-250ml": 300,
  "vvlove-pink-cutie-body-mist-250ml": 300,
  "vvlove-charming-vanilla-body-mist-250ml": 300,
  "body-splash-vanilla-zealot-250ml": 300,
  "body-splash-velvety-euphoria-250ml": 300,
  "body-splash-berry-top-deco-250ml": 300,
  "body-splash-cookie-lust-236ml": 290,
  "perfume-pink-sexy-scandal-sexy-sexy-100ml": 300,
  "perfume-2i2-vip-men-club-edition-100ml": 300,
  "perfume-2i2-vip-men-are-you-on-the-list-nyc-100ml": 300,
  "perfume-cool-girl-90ml": 280,
  "perfume-2i2-vip-rose-dama-100ml": 300,

  // ===== Textiles (perfume aerosol o splash) =====
  "textil-sandalo-y-violetas": 280,
  "textil-limon-dulce-y-vainilla": 280,
  "textil-vainilla": 280,
  "textil-indiana": 280, // "Textil Mandalorian"
  "textil-rocio": 280,
  "textil-naranja-pimienta": 280,
  "textil-amour": 280,
  "textil-darth-vader": 280,
  "textil-frutilla": 280,
  "textil-cony": 280,
  "textil-cars": 280,
  "textil-woody-y-buzz": 280,
  "textl-minnie": 280, // typo en slug, OK
  "textil-angel": 280,
  "textil-princesa": 280,
  "textil-micky": 280,
  "textil-lotso": 280,
  "textil-woody-y-jessie": 280,

  // ===== Difusores premium (frasco + líquido + varillas) =====
  "difusor-premium-vainilla-coco": 450,
  "difusor-premium-vainilla-oriental": 450,

  // ===== Varillas de repuesto (solo varillas) =====
  "varilla-difusor-cony": 50,
  "difusor-varilla-princesa": 50,
  "difusor-varilla-lotso": 50,
  "difusor-varilla-woody-y-jessie": 50,
  "difusor-varilla-woody-y-buzz": 50,
  "difusor-varilla-mandalorian": 50,
  "varilla-difusor-bubleegum": 50,
  "varilla-difusor-dart-vader": 50,
  "difusor-varilla-amour": 50,
  "difusor-varilla-vainilla": 50,
  "difusor-varilla-hulk": 50,
  "varilla-difusor-minnie": 50,

  // ===== Lipgloss / lip oil sin peso (algunos antiguos) =====
  "Brillo Labial Efecto Glow 4 Angels": 18,
  "balsamo-emoji-pink-21": 10,
  "lip-balm-color-change-duo-tei": 15,
  "super-gloss-pink-21": 18,
  "lip-oil-glitter-bomb-13ml": 20,
};

async function patchProduct(slug, weight) {
  const url = `${SUPABASE_URL}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ weight_grams: weight }),
  });
  if (!res.ok) {
    throw new Error(`PATCH ${slug} → ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data[0];
}

(async () => {
  console.log(`Actualizando ${Object.keys(WEIGHTS).length} productos...\n`);
  let ok = 0;
  let missed = 0;
  for (const [slug, weight] of Object.entries(WEIGHTS)) {
    try {
      const updated = await patchProduct(slug, weight);
      if (updated) {
        console.log(`  ✔ ${weight}g  ${updated.name}`);
        ok++;
      } else {
        console.log(`  ✘ ${slug} no encontrado`);
        missed++;
      }
    } catch (e) {
      console.log(`  ✘ ${slug} — ${e.message}`);
      missed++;
    }
  }
  console.log(`\n${ok} actualizados, ${missed} fallos.`);
})().catch((err) => { console.error("Error:", err); process.exit(1); });
