"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Plus, Minus, X, Search, Tag, ShoppingBag, ScanBarcode } from "lucide-react";
import type { RemitItem } from "@/types/remito";
import { wholesaleTierInfo } from "@cancerianas/shared";
import {
  formatPriceARG,
  normalize,
  normalizeBarcode,
  unitPriceFor,
  findByScan,
  type CatalogProduct,
} from "@/lib/remito-catalog";

// ============================================================
// Picker de productos: busca en el catálogo real, acepta escaneo con
// pistola lectora, respeta stock y aplica precio mayorista automáticamente.
//
// Flujo con lector: el campo de búsqueda está enfocado → disparás →
// el lector "tipea" el código y manda Enter → el producto queda elegido y
// el foco salta al campo de cantidad → tipeás la cantidad → Enter → cargado
// con el precio que corresponda a esa cantidad (mayorista si aplica).
// ============================================================

export default function ProductPicker({
  catalog,
  reserved,
  remitoItems,
  onAdd,
  autoFocus = false,
}: {
  catalog: CatalogProduct[];
  reserved: Map<string, number>;
  remitoItems: RemitItem[];
  onAdd: (item: Omit<RemitItem, "id">) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [qty, setQty] = useState(1);
  const [manualMode, setManualMode] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [scanFeedback, setScanFeedback] = useState<
    { kind: "ok" | "miss" | "empty"; text: string } | null
  >(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const availableFor = useCallback(
    (p: CatalogProduct) => Math.max(0, p.stock - (reserved.get(p.id) ?? 0)),
    [reserved]
  );

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    const code = normalizeBarcode(query.trim());
    return catalog
      .filter(
        (p) =>
          normalize(p.name).includes(q) ||
          (p.barcode && normalizeBarcode(p.barcode).includes(code)) ||
          (p.sku && normalizeBarcode(p.sku).includes(code))
      )
      .slice(0, 8);
  }, [catalog, query]);

  const selectProduct = (p: CatalogProduct) => {
    if (availableFor(p) <= 0) return;
    setSelected(p);
    setQuery(p.name);
    setOpen(false);
    setQty(1);
    // Foco directo en cantidad para cargar rápido
    setTimeout(() => qtyRef.current?.select(), 0);
  };

  const clearSelection = useCallback(() => {
    setSelected(null);
    setQuery("");
    setQty(1);
    setTimeout(() => searchRef.current?.focus(), 0);
  }, []);

  // El mensajito de "escaneado / no encontrado" se borra solo.
  useEffect(() => {
    if (!scanFeedback) return;
    const t = setTimeout(() => setScanFeedback(null), 3500);
    return () => clearTimeout(t);
  }, [scanFeedback]);

  // Intenta resolver lo tipeado/escaneado como código de barras.
  // Devuelve true si lo manejó (así el Enter no cae en la lista de resultados).
  const tryScan = (raw: string): boolean => {
    const found = findByScan(catalog, raw);
    if (!found) return false;
    if (availableFor(found) <= 0) {
      setScanFeedback({ kind: "empty", text: `${found.name} — sin stock disponible` });
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 0);
      return true;
    }
    setScanFeedback({ kind: "ok", text: `${found.name} — poné la cantidad` });
    selectProduct(found);
    return true;
  };

  const maxQty = selected ? availableFor(selected) : 0;
  // Unidades del mismo producto que YA están en este remito: el precio
  // mayorista se calcula por el total acumulado (lo que lleva + lo nuevo).
  const already = selected
    ? remitoItems
        .filter((i) => i.productId === selected.id)
        .reduce((s, i) => s + i.quantity, 0)
    : 0;
  const pricing = selected ? unitPriceFor(selected, qty + already) : null;

  const setQtyClamped = (n: number) => {
    const v = Math.floor(Number.isFinite(n) ? n : 1);
    setQty(Math.min(Math.max(1, v), Math.max(1, maxQty)));
  };

  const handleAddFromCatalog = () => {
    if (!selected || !pricing || qty < 1 || qty > maxQty) return;
    onAdd({
      product: selected.name,
      quantity: qty,
      price: pricing.unit,
      productId: selected.id,
      wholesale: pricing.wholesale,
    });
    clearSelection();
  };

  const handleAddManual = () => {
    const name = query.trim();
    const normalized = (manualPrice || "").replace(/[^0-9,\.]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const p = parseFloat(normalized) || 0;
    if (!name || p <= 0 || qty < 1) return;
    onAdd({ product: name, quantity: qty, price: p });
    setManualMode(false);
    setManualPrice("");
    clearSelection();
  };

  return (
    <div className="bg-rose-whisper rounded-2xl p-3">
      {/* Buscador / lector */}
      <div className="relative">
        {manualMode ? (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none" />
        ) : (
          <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-deep pointer-events-none" />
        )}
        <input
          ref={searchRef}
          type="text"
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={
            manualMode ? "Nombre del item manual" : "Escaneá el código o buscá por nombre…"
          }
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (!manualMode) {
              // Lectores sin sufijo Enter: si lo tipeado coincide exacto con
              // un código, lo tomamos igual sin esperar la tecla.
              if (v.trim().length >= 6 && tryScan(v)) return;
              setOpen(true);
              setHighlight(0);
              if (selected) setSelected(null);
            }
          }}
          onFocus={() => {
            if (!manualMode && query && !selected) setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (manualMode) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              // El Enter del lector primero se prueba como código.
              if (tryScan(query)) return;
              if (open && results[highlight]) {
                selectProduct(results[highlight]);
              } else if (query.trim()) {
                setScanFeedback({
                  kind: "miss",
                  text: `Sin producto con el código "${query.trim()}"`,
                });
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="w-full pl-9 pr-24 py-2 bg-white border border-rose-medium/40 rounded-xl text-sm text-ink-primary placeholder:text-ink-soft focus:outline-none focus:border-rose-primary focus:ring-2 focus:ring-rose-pastel"
        />
        <button
          type="button"
          onClick={() => {
            setManualMode((v) => !v);
            setSelected(null);
            setOpen(false);
          }}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg transition ${
            manualMode
              ? "bg-rose-deep text-white"
              : "bg-rose-pastel text-ink-secondary hover:bg-rose-medium/50"
          }`}
          title="Cargar un item que no está en la tienda"
        >
          Manual
        </button>

        {/* Dropdown de resultados */}
        {open && !manualMode && query.trim() && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-lift border border-rose-pastel overflow-hidden">
            {results.length === 0 ? (
              <p className="px-4 py-3 text-xs text-ink-soft">
                Sin resultados en la tienda. Usá el botón <strong>Manual</strong> para cargarlo a mano.
              </p>
            ) : (
              results.map((p, i) => {
                const avail = availableFor(p);
                const out = avail <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={out}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectProduct(p);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                      out
                        ? "opacity-45 cursor-not-allowed"
                        : i === highlight
                        ? "bg-rose-whisper"
                        : "bg-white hover:bg-rose-whisper"
                    }`}
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt=""
                        className="w-9 h-9 rounded-xl object-cover flex-shrink-0 border border-rose-pastel"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-rose-pastel flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-4 h-4 text-rose-deep" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-ink-primary truncate">{p.name}</p>
                      <p className="text-[11px] text-ink-soft">
                        {formatPriceARG(p.price)}
                        {p.barcode && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-ink-soft">
                            <ScanBarcode size={9} /> {p.barcode}
                          </span>
                        )}
                        {p.tiers.length > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-rose-deep font-bold">
                            <Tag size={9} /> mayorista
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        out
                          ? "bg-error/15 text-error"
                          : avail <= 5
                          ? "bg-warning/25 text-ink-secondary"
                          : "bg-success/25 text-ink-secondary"
                      }`}
                    >
                      {out ? "Sin stock" : `${avail} disp.`}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Resultado del último escaneo */}
      {scanFeedback && (
        <div
          className={`mt-2 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold ${
            scanFeedback.kind === "ok"
              ? "bg-success/20 text-ink-secondary"
              : scanFeedback.kind === "empty"
              ? "bg-warning/25 text-ink-secondary"
              : "bg-error/15 text-error"
          }`}
        >
          <ScanBarcode size={12} />
          <span>{scanFeedback.text}</span>
        </div>
      )}

      {/* Producto seleccionado del catálogo */}
      {selected && pricing && !manualMode && (
        <div className="mt-2.5 bg-white rounded-2xl border border-rose-pastel p-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Stepper de cantidad */}
            <div className="flex items-center bg-rose-whisper rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setQtyClamped(qty - 1)}
                className="px-2.5 py-2 text-rose-deep hover:bg-rose-pastel transition disabled:opacity-40"
                disabled={qty <= 1}
              >
                <Minus size={14} />
              </button>
              <input
                ref={qtyRef}
                type="number"
                min={1}
                max={maxQty}
                step={1}
                inputMode="numeric"
                value={qty}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQtyClamped(parseInt(e.target.value, 10) || 1)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddFromCatalog();
                  }
                }}
                className="w-12 py-2 text-center text-sm font-bold text-ink-primary bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQtyClamped(qty + 1)}
                className="px-2.5 py-2 text-rose-deep hover:bg-rose-pastel transition disabled:opacity-40"
                disabled={qty >= maxQty}
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex-1 min-w-[110px]">
              <p className="text-sm font-bold text-ink-primary leading-tight">
                {formatPriceARG(pricing.unit)}{" "}
                <span className="text-[11px] font-normal text-ink-soft">c/u</span>
              </p>
              <p className="text-[11px] text-ink-soft leading-tight">
                {already > 0 ? (
                  <>
                    Ya lleva {already} u. → total{" "}
                    <strong>{formatPriceARG(pricing.unit * (qty + already))}</strong> · quedan {maxQty}
                  </>
                ) : (
                  <>
                    Total: <strong>{formatPriceARG(pricing.unit * qty)}</strong> · quedan {maxQty}
                  </>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddFromCatalog}
              className="btn-primary !py-2 !px-4 !text-sm"
              disabled={qty < 1 || qty > maxQty}
            >
              <Plus size={14} /> Agregar
            </button>

            <button
              type="button"
              onClick={clearSelection}
              className="p-1.5 text-ink-soft hover:text-error transition"
              title="Cancelar"
            >
              <X size={15} />
            </button>
          </div>

          {/* Info mayorista */}
          {pricing.wholesale && (
            <div className="mt-2 flex items-center gap-1.5 bg-rose-deep/10 text-rose-deep rounded-xl px-2.5 py-1.5">
              <Tag size={12} />
              <p className="text-[11px] font-bold">
                Precio mayorista aplicado ({pricing.tier?.label || `${pricing.tier?.units}+ unidades`}
                {pricing.discountPct > 0 ? ` · −${pricing.discountPct}%` : ""})
                {already > 0 ? ` por ${qty + already} u. en total` : ""}
              </p>
            </div>
          )}
          {!pricing.wholesale && selected.tiers.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {selected.tiers.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQtyClamped(Math.max(1, t.units - already))}
                  disabled={t.units - already > maxQty}
                  className="text-[10px] font-bold bg-rose-pastel hover:bg-rose-medium/50 text-ink-secondary px-2 py-1 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Aplicar cantidad mayorista"
                >
                  <Tag size={9} className="inline mr-0.5" />
                  {t.units}+ u → {formatPriceARG(wholesaleTierInfo(t, selected.price).unitPrice)} c/u
                  {already > 0 && t.units - already > 0 ? ` (faltan ${t.units - already})` : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modo manual (item fuera de catálogo) */}
      {manualMode && (
        <div className="mt-2.5 bg-white rounded-2xl border border-rose-pastel p-3 flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-rose-whisper rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="px-2.5 py-2 text-rose-deep hover:bg-rose-pastel transition"
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={qty}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setQty(Math.max(1, Math.floor(parseInt(e.target.value, 10) || 1)))}
              className="w-12 py-2 text-center text-sm font-bold text-ink-primary bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="px-2.5 py-2 text-rose-deep hover:bg-rose-pastel transition"
            >
              <Plus size={14} />
            </button>
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="$ Precio"
            value={manualPrice}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setManualPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddManual();
              }
            }}
            className="flex-1 min-w-[90px] px-3 py-2 bg-rose-whisper border border-rose-medium/40 rounded-xl text-sm text-right text-ink-primary focus:outline-none focus:border-rose-primary"
          />
          <button
            type="button"
            onClick={handleAddManual}
            className="btn-primary !py-2 !px-4 !text-sm"
            disabled={!query.trim() || !manualPrice}
          >
            <Plus size={14} /> Agregar
          </button>
          <button
            type="button"
            onClick={() => {
              setManualMode(false);
              setManualPrice("");
              setQty(1);
              clearSelection();
            }}
            className="p-1.5 text-ink-soft hover:text-error transition"
            title="Cancelar item manual"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
