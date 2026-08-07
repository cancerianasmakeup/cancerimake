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

// Precio unitario a aplicar según cantidad: si alcanza un tier mayorista,
// usa el del tier más grande que entre en la cantidad. El cálculo del precio
// unitario vive en wholesaleTierInfo (shared), que soporta tiers cargados
// como total del pack O como precio por unidad.
export function unitPriceFor(p: CatalogProduct, qty: number) {
  let tier: WholesaleTier | null = null;
  for (const t of p.tiers) {
    if (qty >= t.units) tier = t; // tiers vienen ordenados por units asc
  }
  if (tier) {
    const info = wholesaleTierInfo(tier, p.price);
    return { unit: info.unitPrice, wholesale: true, tier, discountPct: info.discountPct };
  }
  return { unit: p.price, wholesale: false, tier: null, discountPct: 0 };
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
