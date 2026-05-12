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
 * Calcula peso + dimensiones aproximadas para todo un cart.
 * Reglas:
 *  - peso = sum(weight_grams * qty) + buffer (default 10g por item)
 *    si un producto no tiene peso, asumimos 200g por unidad
 *  - largo / ancho = max(largo, ancho) entre todos los items
 *  - alto = sum(altos)
 *    si no hay dimensiones, default 25 × 20 × 10 cm
 *  - Tope mínimo de peso 500g (los carriers no aceptan menos en general)
 */
export function calcPackageFromCart(
  items: CartLikeItem[],
  options: { perItemBufferGrams?: number; defaultWeightGrams?: number } = {}
): PackageDimensions {
  const buffer = options.perItemBufferGrams ?? 10;
  const defaultWeight = options.defaultWeightGrams ?? 200;

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
