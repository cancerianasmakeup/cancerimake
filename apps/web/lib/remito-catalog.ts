"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { sanitizeWholesaleTiers, wholesaleTierInfo } from "@cancerianas/shared";
import type { WholesaleTier } from "@cancerianas/shared";

// Producto del catálogo real de la tienda (cargado 1 sola vez desde la DB)
export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string | null;
  sku: string | null;
  barcode: string | null;
  tiers: WholesaleTier[];
}

export type CatalogState = "loading" | "ready" | "error";

// Formatea precio con separador de miles y moneda argentina
export function formatPriceARG(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// Normaliza texto para búsqueda (minúsculas, sin tildes)
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Normaliza un código de barras para comparar: la pistola puede meter
// espacios o guiones según cómo esté configurada, y algunos códigos se
// cargan a mano con separadores.
export function normalizeBarcode(s: string): string {
  return s.replace(/[\s-]/g, "").toUpperCase();
}

// ============================================================
// MODALIDADES DE VENTA
// ============================================================
// Vendiendo en vivo el precio no depende solo de cuánto se lleva: se anuncia
// "hoy todo a precio de caja" y esa condición vale para todo el remito.
//
// Las tres modalidades son la misma regla con distinto piso: la modalidad fija
// un pack MÍNIMO, y se aplica el mejor entre lo que la cantidad gana sola y ese
// piso. Por eso "VIVO X 6" sigue dando media caja si la clienta lleva 12.
export type SaleMode = "normal" | "vivo6" | "vivo_media" | "vivo_caja";

export const SALE_MODES: { id: SaleMode; label: string; hint: string }[] = [
  { id: "normal", label: "Normal", hint: "El precio sale de la cantidad, como siempre" },
  { id: "vivo6", label: "VIVO X 6", hint: "Desde 1 unidad pagan precio de 6" },
  { id: "vivo_media", label: "VIVO ½ CAJA", hint: "Desde 1 unidad pagan precio de media caja" },
  { id: "vivo_caja", label: "VIVO CAJA ENTERA", hint: "Desde 1 unidad pagan precio de caja" },
];

// Los packs se cargan a mano y los nombres vienen sucios: hay "MEDIA  CAJA"
// con doble espacio y "3 UNIDQADES". Tampoco sirve identificarlos por cantidad,
// porque "CAJA ENTERA" son 24 unidades en unos productos y 12 en otros.
function normLabel(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ¿El pack representa la caja/paquete completo? Se mira el nombre y no la
// cantidad, porque "CAJA ENTERA" son 24 unidades en unos productos y 12 en
// otros, y hay uno que se llama "PAQUETE ENTERO".
function esCajaEntera(t: WholesaleTier): boolean {
  const l = normLabel(t.label);
  return (l.includes("CAJA") || l.includes("PAQUETE")) && !l.includes("MEDIA");
}

/**
 * El pack que la modalidad quiere cobrar en este producto.
 *
 * Si el producto no tiene ese pack, cae al más grande que NO lo supere. El
 * respaldo siempre baja, nunca sube: en "VIVO X 6" un producto que solo tenga
 * media caja no puede terminar cobrándose a media caja, porque saldría más
 * barato que el precio de 6 que se anunció. En ese caso va a precio de lista.
 *
 * Devuelve null cuando no hay ningún pack aplicable.
 */
function floorTierFor(p: CatalogProduct, mode: SaleMode): WholesaleTier | null {
  const tiers = p.tiers; // ya vienen ordenados por units asc
  if (mode === "normal" || !tiers.length) return null;

  if (mode === "vivo_caja") {
    // El pack más grande que tenga: resuelve solo las cajas de 12, las de 24
    // y los "PAQUETE ENTERO".
    return tiers[tiers.length - 1];
  }

  if (mode === "vivo_media") {
    const media = tiers.find((t) => normLabel(t.label).includes("MEDIA"));
    if (media) return media;
    // Sin pack de media caja hay que bajar un escalón, pero solo si el más
    // grande ES la caja. Si el producto llega hasta "6 UNIDADES" y nada más,
    // ese es su techo y ahí se queda: tomar el anterior (el de 3) saldría MÁS
    // CARO que VIVO X 6 y dejaría las modalidades desordenadas.
    const mayor = tiers[tiers.length - 1];
    return esCajaEntera(mayor) && tiers.length > 1 ? tiers[tiers.length - 2] : mayor;
  }

  // vivo6
  const seis = tiers.find((t) => t.units === 6) ?? tiers.find((t) => /(^|\D)6(\D|$)/.test(normLabel(t.label)));
  if (seis) return seis;
  // Sin pack de 6: el más grande que no pase de 6 unidades (típicamente el de 3).
  const menores = tiers.filter((t) => t.units <= 6);
  return menores.length ? menores[menores.length - 1] : null;
}

export interface PricingResult {
  unit: number;
  wholesale: boolean;
  tier: WholesaleTier | null;
  discountPct: number;
  /** true si la modalidad pedía un pack que este producto no tiene cargado. */
  modeFallback: boolean;
}

// Precio unitario a aplicar según cantidad y modalidad.
//
// Sin modalidad se comporta igual que siempre: el tier más grande que entre en
// la cantidad. Con modalidad, ese tier compite contra el piso y gana el mayor.
//
// El cálculo del precio unitario vive en wholesaleTierInfo (shared), que
// soporta tiers cargados como total del pack O como precio por unidad.
export function unitPriceFor(
  p: CatalogProduct,
  qty: number,
  mode: SaleMode = "normal"
): PricingResult {
  let porCantidad: WholesaleTier | null = null;
  for (const t of p.tiers) {
    if (qty >= t.units) porCantidad = t; // tiers vienen ordenados por units asc
  }

  const piso = floorTierFor(p, mode);
  // Gana el de más unidades: así "VIVO X 6" con 12 unidades cobra media caja.
  const tier =
    piso && (!porCantidad || piso.units > porCantidad.units) ? piso : porCantidad;

  // La modalidad no se pudo respetar si pedía un pack y el producto no tiene
  // ninguno aplicable, o si el que hay es de menos unidades que el pedido.
  const modeFallback = mode !== "normal" && (!piso || (tier?.units ?? 0) < unitsPedidas(p, mode));

  if (tier) {
    const info = wholesaleTierInfo(tier, p.price);
    return {
      unit: info.unitPrice,
      wholesale: true,
      tier,
      discountPct: info.discountPct,
      modeFallback,
    };
  }
  return { unit: p.price, wholesale: false, tier: null, discountPct: 0, modeFallback };
}

// Cuántas unidades pide idealmente la modalidad en este producto, para saber si
// el precio aplicado se quedó corto respecto de lo anunciado.
function unitsPedidas(p: CatalogProduct, mode: SaleMode): number {
  if (mode === "vivo6") return 6;
  if (!p.tiers.length) return Infinity;
  if (mode === "vivo_caja") return p.tiers[p.tiers.length - 1].units;
  if (mode === "vivo_media") {
    const media = p.tiers.find((t) => normLabel(t.label).includes("MEDIA"));
    return media ? media.units : p.tiers[p.tiers.length - 1].units;
  }
  return 0;
}

// Busca un producto por código de barras exacto (o por SKU, así una etiqueta
// vieja impresa con el SKU también entra al escanear).
export function findByScan(catalog: CatalogProduct[], raw: string): CatalogProduct | null {
  const code = normalizeBarcode(raw.trim());
  if (!code) return null;
  return (
    catalog.find((p) => p.barcode && normalizeBarcode(p.barcode) === code) ??
    catalog.find((p) => p.sku && normalizeBarcode(p.sku) === code) ??
    null
  );
}

// Catálogo real de la tienda: nombre, precio, stock, códigos y packs mayoristas.
export function useCatalog() {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogState, setCatalogState] = useState<CatalogState>("loading");

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let cancelled = false;

    const toCatalog = (rows: any[]): CatalogProduct[] =>
      rows.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
        image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null,
        sku: p.sku ?? null,
        barcode: p.barcode ?? null,
        tiers: sanitizeWholesaleTiers(p.wholesale_tiers),
      }));

    const load = async () => {
      const BASE = "id, name, price, stock, images, sku, wholesale_tiers";
      const run = (cols: string) =>
        supabase.from("products").select(cols).eq("status", "active").order("name");

      let { data, error } = (await run(`${BASE}, barcode`)) as {
        data: any[] | null;
        error: { message: string } | null;
      };

      // Si todavía no se corrió la migración del código de barras, el catálogo
      // sigue funcionando (búsqueda por nombre/SKU) en vez de romperse entero.
      if (error && /barcode/i.test(error.message)) {
        console.warn("Falta la columna products.barcode — corré la migración 20260806000000_product_barcode.sql");
        ({ data, error } = (await run(BASE)) as {
          data: any[] | null;
          error: { message: string } | null;
        });
      }

      if (cancelled) return;
      if (error) {
        console.error("Error cargando catálogo:", error);
        setCatalogState("error");
        return;
      }
      setCatalog(toCatalog(data ?? []));
      setCatalogState("ready");
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, catalogState };
}
