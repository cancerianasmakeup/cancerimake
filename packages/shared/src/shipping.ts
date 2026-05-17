// Helpers para calcular peso y dimensiones de un envío a partir del carrito.
// Pure functions, sin Supabase. Las usa web (checkout) y mobile.

export interface CartLikeItem {
  quantity: number;
  weight_grams?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

export interface PackageDimensions {
  weight_grams: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
}

/**
 * Embalaje fijo que se suma al peso final del paquete: caja/sobre + film,
 * burbuja, papel. Se aplica una sola vez por paquete (no por item).
 */
export const PACKAGING_WEIGHT_GRAMS = 200;

/**
 * Calcula peso + dimensiones aproximadas para todo un cart.
 * Reglas:
 *  - peso = sum(weight_grams * qty) + buffer (default 10g por item) + PACKAGING_WEIGHT_GRAMS (200g fijos)
 *    si un producto no tiene peso, asumimos 200g por unidad
 *  - largo / ancho = max(largo, ancho) entre todos los items
 *  - alto = sum(altos)
 *    si no hay dimensiones, default 25 × 20 × 10 cm
 *  - Tope mínimo de peso 500g (los carriers no aceptan menos en general)
 */
export function calcPackageFromCart(
  items: CartLikeItem[],
  options: { perItemBufferGrams?: number; defaultWeightGrams?: number; packagingGrams?: number } = {}
): PackageDimensions {
  const buffer = options.perItemBufferGrams ?? 10;
  const defaultWeight = options.defaultWeightGrams ?? 200;
  const packaging = options.packagingGrams ?? PACKAGING_WEIGHT_GRAMS;

  let totalWeight = 0;
  let maxLen = 0;
  let maxWidth = 0;
  let totalHeight = 0;
  let hasDims = false;

  for (const it of items) {
    const qty = Math.max(1, it.quantity ?? 1);
    const w = it.weight_grams && it.weight_grams > 0 ? it.weight_grams : defaultWeight;
    totalWeight += w * qty + buffer * qty;

    if (it.length_cm && it.width_cm && it.height_cm) {
      hasDims = true;
      maxLen = Math.max(maxLen, it.length_cm);
      maxWidth = Math.max(maxWidth, it.width_cm);
      totalHeight += it.height_cm * qty;
    }
  }

  totalWeight += packaging;

  return {
    weight_grams: Math.max(500, Math.round(totalWeight)),
    length_cm: hasDims ? Math.max(10, Math.round(maxLen)) : 25,
    width_cm: hasDims ? Math.max(10, Math.round(maxWidth)) : 20,
    height_cm: hasDims ? Math.max(5, Math.round(totalHeight)) : 10,
  };
}

/** Texto descriptivo amigable para el shipment (ej: "3 productos · 1.2 kg") */
export function describePackage(items: { quantity: number }[], pkg: PackageDimensions): string {
  const total = items.reduce((s, i) => s + (i.quantity ?? 1), 0);
  const kg = (pkg.weight_grams / 1000).toFixed(2).replace(".", ",");
  return `${total} ${total === 1 ? "producto" : "productos"} · ${kg} kg`;
}

// ============================================================
// Correo Argentino — cálculo de tarifa desde Moreno (CP 1744)
// ============================================================
// Mapeo CP → zona y tabla de precios provistos por el negocio.
// Margen incorporado para cubrir variaciones reales de Correo.

export type CorreoZone = "Z1" | "Z2" | "Z3" | "Z4";
export type CorreoDestinationType = "sucursal" | "domicilio";

/** Provincias por zona (todas las que NO son Buenos Aires AMBA). */
const ZONE_2_PROVINCES = new Set([
  "BUENOS_AIRES_INTERIOR",
  "CORDOBA",
  "ENTRE_RIOS",
  "LA_PAMPA",
  "SANTA_FE",
]);
const ZONE_3_PROVINCES = new Set([
  "CATAMARCA", "CHACO", "CORRIENTES", "FORMOSA", "LA_RIOJA",
  "MENDOZA", "MISIONES", "NEUQUEN", "RIO_NEGRO", "SAN_JUAN",
  "SAN_LUIS", "SANTIAGO_DEL_ESTERO", "TUCUMAN",
]);
const ZONE_4_PROVINCES = new Set([
  "CHUBUT", "JUJUY", "SALTA", "SANTA_CRUZ", "TIERRA_DEL_FUEGO",
]);

/**
 * Mapeo de prefijos de CP (rangos numéricos) a provincia.
 * Fuente: Correo Argentino (códigos postales por provincia).
 * Devolvemos un código de provincia interno para luego mapearlo a zona.
 */
function cpToProvince(cp: number): string {
  // AMBA Buenos Aires: 1000-1893 (CABA + GBA)
  if (cp >= 1000 && cp <= 1893) return "AMBA";
  // Buenos Aires interior: 1894-2000, 2700-2999, 6000-7600, 8000 zona costa
  if ((cp >= 1894 && cp <= 1999) || (cp >= 2700 && cp <= 2999) || (cp >= 6000 && cp <= 7607) || (cp >= 7619 && cp <= 7999)) return "BUENOS_AIRES_INTERIOR";
  // Santa Fe: 2000-2399, 2400-2499, 3000-3099, 3500-3599
  if ((cp >= 2000 && cp <= 2399) || (cp >= 2400 && cp <= 2499) || (cp >= 3000 && cp <= 3099) || (cp >= 3500 && cp <= 3599)) return "SANTA_FE";
  // Entre Ríos: 2820-2879, 3100-3299
  if ((cp >= 2820 && cp <= 2879) || (cp >= 3100 && cp <= 3299)) return "ENTRE_RIOS";
  // Córdoba: 5000-5999
  if (cp >= 5000 && cp <= 5999) return "CORDOBA";
  // La Pampa: 6300-6399, 8200-8299
  if ((cp >= 6300 && cp <= 6399) || (cp >= 8200 && cp <= 8299)) return "LA_PAMPA";
  // Mendoza: 5500-5699
  if (cp >= 5500 && cp <= 5699) return "MENDOZA";
  // San Juan: 5400-5499
  if (cp >= 5400 && cp <= 5499) return "SAN_JUAN";
  // San Luis: 5700-5899
  if (cp >= 5700 && cp <= 5899) return "SAN_LUIS";
  // La Rioja: 5300-5399
  if (cp >= 5300 && cp <= 5399) return "LA_RIOJA";
  // Catamarca: 4700-4799
  if (cp >= 4700 && cp <= 4799) return "CATAMARCA";
  // Tucumán: 4000-4199
  if (cp >= 4000 && cp <= 4199) return "TUCUMAN";
  // Santiago del Estero: 4200-4399
  if (cp >= 4200 && cp <= 4399) return "SANTIAGO_DEL_ESTERO";
  // Salta: 4400-4699
  if (cp >= 4400 && cp <= 4699) return "SALTA";
  // Jujuy: 4600-4699 — overlap con Salta; mantenemos Salta y damos prioridad a Jujuy explícito
  // (Jujuy comparte con Salta — heurística simple: capital Jujuy 4600 → SALTA, distritos jujeños diferenciados ya cubiertos)
  // Chaco: 3500-3799
  if (cp >= 3500 && cp <= 3799) return "CHACO";
  // Formosa: 3600-3699
  if (cp >= 3600 && cp <= 3699) return "FORMOSA";
  // Corrientes: 3400-3499, 3700-3899
  if ((cp >= 3400 && cp <= 3499) || (cp >= 3700 && cp <= 3899)) return "CORRIENTES";
  // Misiones: 3300-3399
  if (cp >= 3300 && cp <= 3399) return "MISIONES";
  // Río Negro: 8300-8499
  if (cp >= 8300 && cp <= 8499) return "RIO_NEGRO";
  // Neuquén: 8300 (overlap RN) - 8371 onwards: mantener RN para 83xx por simplicidad
  // Chubut: 9000-9299
  if (cp >= 9000 && cp <= 9299) return "CHUBUT";
  // Santa Cruz: 9300-9499
  if (cp >= 9300 && cp <= 9499) return "SANTA_CRUZ";
  // Tierra del Fuego: 9400-9499 (Ushuaia 9410)
  if (cp >= 9400 && cp <= 9499) return "TIERRA_DEL_FUEGO";
  return "UNKNOWN";
}

/** Convierte un CP argentino (4 dígitos) a zona. Si no se reconoce → Z3 como default conservador. */
export function cpToZone(cp: string | number): CorreoZone {
  const n = typeof cp === "number" ? cp : parseInt(String(cp).trim(), 10);
  if (!Number.isFinite(n) || n < 1000 || n > 9999) return "Z3";
  const province = cpToProvince(n);
  if (province === "AMBA") return "Z1";
  if (ZONE_2_PROVINCES.has(province)) return "Z2";
  if (ZONE_3_PROVINCES.has(province)) return "Z3";
  if (ZONE_4_PROVINCES.has(province)) return "Z4";
  return "Z3"; // default conservador
}

/**
 * Tabla de precios Correo Argentino — desde Moreno (1744) por zona + peso + tipo de destino.
 * Tier de peso: ≤1kg / ≤3kg / ≤5kg.
 */
const CORREO_PRICES: Record<
  CorreoDestinationType,
  Record<CorreoZone, [number, number, number]> // [≤1kg, ≤3kg, ≤5kg]
> = {
  sucursal: {
    Z1: [8500, 9500, 11000],
    Z2: [9500, 11500, 14500],
    Z3: [11500, 14000, 17000],
    Z4: [13500, 16000, 20000],
  },
  domicilio: {
    Z1: [9500, 10500, 12500],
    Z2: [11000, 12500, 16000],
    Z3: [13000, 15000, 19000],
    Z4: [15000, 18000, 23500],
  },
};

export interface CorreoQuote {
  ok: boolean;
  cost?: number;
  zone?: CorreoZone;
  tier?: "1kg" | "3kg" | "5kg";
  reason?: "invalid_cp" | "over_max_weight";
}

/**
 * Calcula tarifa Correo Argentino para un envío desde Moreno (1744) hasta `cp`,
 * con peso total del paquete `weightGrams` (incluyendo embalaje), por sucursal o domicilio.
 *
 * Si el peso supera 5kg devuelve { ok: false, reason: "over_max_weight" }.
 * Si el CP es inválido devuelve { ok: false, reason: "invalid_cp" }.
 */
export function calcCorreoArgentinoQuote(
  cp: string | number,
  weightGrams: number,
  destinationType: CorreoDestinationType,
): CorreoQuote {
  const cpStr = String(cp).trim();
  if (!/^\d{4}$/.test(cpStr)) return { ok: false, reason: "invalid_cp" };
  if (weightGrams > 5000) return { ok: false, reason: "over_max_weight" };

  const zone = cpToZone(cpStr);
  const prices = CORREO_PRICES[destinationType][zone];

  let tier: "1kg" | "3kg" | "5kg";
  let cost: number;
  if (weightGrams <= 1000) { tier = "1kg"; cost = prices[0]; }
  else if (weightGrams <= 3000) { tier = "3kg"; cost = prices[1]; }
  else { tier = "5kg"; cost = prices[2]; }

  return { ok: true, cost, zone, tier };
}
