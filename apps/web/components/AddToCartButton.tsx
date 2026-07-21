"use client";

// Botón de agregar al carrito en la página de detalle del producto.
//
// Ejes independientes del producto:
//   - variantes (colores/tonos): puede tener o no.
//   - precios por mayor (packs por N unidades a un precio con descuento): puede tener o no.
//
// Modos resultantes:
//   1. Sin packs, sin variantes → stepper simple.
//   2. Sin packs, con variantes → un stepper por variante (cantidad libre).
//   3. Con packs → tarjetas de opción ("1 unidad / suelto" + cada pack).
//        - Opción suelta: igual que 1 o 2 (precio normal, con price_diff por variante).
//        - Opción pack sin variantes: agrega exactamente N unidades al precio del pack.
//        - Opción pack CON variantes:
//            · Si el pack es una CAJA o MEDIA CAJA (label contiene "caja"): el cliente
//              NO elige tonos. Las N unidades se reparten automáticamente en partes
//              iguales entre los tonos con stock (ej: caja de 24 con 6 tonos → 4 c/u).
//            · Cualquier otro pack (ej "3 unidades"): reparto manual entre tonos.
//          El precio del pack es fijo → unit_price = precio_pack / N para cada variante
//          (se ignora el price_diff porque el pack es una oferta plana).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Minus, Plus, LogIn, Check } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { addItemToCart } from "@/lib/cart";
import { formatPrice, wholesaleTierInfo } from "@cancerianas/shared";
import type { ProductVariant, WholesaleTier } from "@cancerianas/shared";
import LoginModal from "./LoginModal";

export default function AddToCartButton({
  productId,
  price,
  variants,
  stock,
  wholesaleTiers = [],
}: {
  productId: string;
  price: number;
  variants: ProductVariant[];
  stock?: number;
  wholesaleTiers?: WholesaleTier[];
}) {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const hasVariants = variants.length > 0;
  const showWholesale = wholesaleTiers.length > 0;

  // Stock total disponible (para deshabilitar packs que no se pueden armar).
  const totalStock = hasVariants
    ? variants.reduce((s, v) => s + Math.max(0, v.stock ?? 0), 0)
    : stock ?? Infinity;

  const [qtyByVariant, setQtyByVariant] = useState<Record<string, number>>({});
  const [qtyNoVariant, setQtyNoVariant] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setIsAuthed(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setIsAuthed(!!session?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // ===== Opciones de compra =====
  // options[0] = suelto/precio normal, luego cada pack cargado.
  const options = useMemo(() => {
    const regular = {
      key: "regular",
      label: hasVariants ? "Suelto" : "1 unidad",
      units: 1,
      price,
      unitPrice: price,
      discountPct: 0,
      isRegular: true as const,
    };
    const tierOpts = wholesaleTiers.map((t, i) => {
      const info = wholesaleTierInfo(t, price);
      return {
        key: `tier-${i}`,
        label: t.label || `${info.units} unidades`,
        units: info.units,
        price: info.price,
        unitPrice: info.unitPrice,
        discountPct: info.discountPct,
        isRegular: false as const,
      };
    });
    return [regular, ...tierOpts];
  }, [wholesaleTiers, price, hasVariants]);

  const [selectedKey, setSelectedKey] = useState("regular");
  const selected = options.find((o) => o.key === selectedKey) ?? options[0];
  const isPack = !selected.isRegular;

  // Los packs "caja" / "media caja" van surtidos automáticamente; otros packs
  // (ej "3 unidades") mantienen el reparto manual de tonos.
  const isCajaTier = (label: string) => /caja/i.test(label);
  const isAutoPack = isPack && isCajaTier(selected.label);

  // Reparto automático del pack entre variantes: partes iguales (round-robin)
  // respetando el stock de cada tono. El cliente no elige tonos en las cajas
  // para que el surtido salga siempre parejo.
  const packAlloc = useMemo(() => {
    if (!isAutoPack || !hasVariants) return null;
    const avail = variants.filter((v) => (v.stock ?? 0) > 0);
    const alloc: Record<string, number> = {};
    for (const v of avail) alloc[v.id] = 0;
    let remaining = selected.units;
    while (remaining > 0) {
      let progressed = false;
      for (const v of avail) {
        if (remaining === 0) break;
        if (alloc[v.id] < (v.stock ?? 0)) {
          alloc[v.id]++;
          remaining--;
          progressed = true;
        }
      }
      if (!progressed) break; // no queda stock para completar el pack
    }
    return { alloc, allocated: selected.units - remaining };
  }, [isAutoPack, hasVariants, variants, selected.units]);

  function selectOption(key: string) {
    setSelectedKey(key);
    // Reset de cantidades al cambiar de modo, para no arrastrar reparto viejo.
    setQtyByVariant({});
    setQtyNoVariant(1);
  }

  // Total de unidades repartidas entre variantes (suelto o pack manual).
  const variantQtyTotal = variants.reduce((s, v) => s + (qtyByVariant[v.id] ?? 0), 0);
  const packTarget = isPack && !isAutoPack ? selected.units : 0;
  const packRemaining = Math.max(0, packTarget - variantQtyTotal);

  // Unidades / precio final según el modo activo.
  const summary = useMemo(() => {
    if (isPack) {
      const units = hasVariants
        ? isAutoPack
          ? packAlloc?.allocated ?? 0
          : variantQtyTotal
        : selected.units;
      const finalPrice = selected.unitPrice * units;
      const regularPrice = price * units;
      return { units, finalPrice, regularPrice, savings: Math.max(0, regularPrice - finalPrice) };
    }
    if (hasVariants) {
      let units = 0;
      let total = 0;
      for (const v of variants) {
        const q = qtyByVariant[v.id] ?? 0;
        if (q > 0) {
          units += q;
          total += q * (price + Number(v.price_diff ?? 0));
        }
      }
      return { units, finalPrice: total, regularPrice: total, savings: 0 };
    }
    return { units: qtyNoVariant, finalPrice: price * qtyNoVariant, regularPrice: price * qtyNoVariant, savings: 0 };
  }, [isPack, isAutoPack, hasVariants, variants, qtyByVariant, qtyNoVariant, selected, price, packAlloc, variantQtyTotal]);

  const canSubmit = isPack
    ? hasVariants
      ? isAutoPack
        ? packAlloc?.allocated === selected.units
        : variantQtyTotal === selected.units
      : selected.units <= totalStock
    : hasVariants
    ? variantQtyTotal > 0
    : qtyNoVariant > 0;

  function bump(variantId: string, delta: number, max: number) {
    setQtyByVariant((prev) => {
      const curr = prev[variantId] ?? 0;
      const next = Math.max(0, Math.min(max, curr + delta));
      return { ...prev, [variantId]: next };
    });
  }

  // Cap por variante: en suelto = su stock; en pack manual = no pasar N total.
  function maxForVariant(v: ProductVariant): number {
    const st = Math.max(0, v.stock ?? 0);
    if (!isPack || isAutoPack) return st;
    const curr = qtyByVariant[v.id] ?? 0;
    return Math.min(st, curr + packRemaining);
  }

  function handleClick() {
    if (isAuthed === false) {
      setLoginOpen(true);
      return;
    }
    addAll();
  }

  async function addAll() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setLoginOpen(true);
        return;
      }

      const lines: Array<{ variantId: string | null; qty: number; unitPrice: number }> = [];
      if (isPack) {
        const eff = selected.price / selected.units; // precio efectivo por unidad del pack
        if (hasVariants) {
          for (const v of variants) {
            const q = isAutoPack ? packAlloc?.alloc[v.id] ?? 0 : qtyByVariant[v.id] ?? 0;
            if (q > 0) lines.push({ variantId: v.id, qty: q, unitPrice: eff });
          }
        } else {
          lines.push({ variantId: null, qty: selected.units, unitPrice: eff });
        }
      } else if (hasVariants) {
        for (const v of variants) {
          const q = qtyByVariant[v.id] ?? 0;
          if (q > 0) lines.push({ variantId: v.id, qty: q, unitPrice: price + Number(v.price_diff ?? 0) });
        }
      } else {
        lines.push({ variantId: null, qty: qtyNoVariant, unitPrice: price });
      }

      for (const ln of lines) {
        await addItemToCart(supabase, {
          userId: user.id,
          productId,
          variantId: ln.variantId,
          quantity: ln.qty,
          unitPrice: ln.unitPrice,
        });
      }

      const addedQty = lines.reduce((s, l) => s + l.qty, 0);
      toast.success(
        addedQty === 1 ? "Agregado al carrito 🌸" : `${addedQty} productos agregados al carrito 🌸`,
        { action: { label: "Ver carrito", onClick: () => router.push("/checkout") } }
      );

      // Reset
      setSelectedKey("regular");
      setQtyByVariant({});
      setQtyNoVariant(1);
    } catch (e: any) {
      toast.error(e.message || "Algo falló");
    } finally {
      setLoading(false);
    }
  }

  // ===== Render helper: lista de variantes con stepper (solo modo suelto) =====
  const renderVariantSteppers = (getMax: (v: ProductVariant) => number, showDiff: boolean) => (
    <ul className="rounded-2xl border border-rose-pastel divide-y divide-rose-pastel/70 bg-white overflow-hidden">
      {variants.map((v) => {
        const colorHex = v.attributes?.color_hex as string | undefined;
        const st = Math.max(0, v.stock ?? 0);
        const outOfStock = st <= 0;
        const q = qtyByVariant[v.id] ?? 0;
        const lowStock = !outOfStock && st <= 3;
        const diff = Number(v.price_diff ?? 0);
        const max = getMax(v);

        return (
          <li key={v.id} className={`flex items-center gap-3 px-3 py-2.5 ${outOfStock ? "opacity-50" : ""}`}>
            {colorHex ? (
              <span
                className="w-7 h-7 rounded-full ring-1 ring-black/10 shrink-0"
                style={{ backgroundColor: colorHex }}
                title={v.name}
              />
            ) : (
              <span className="w-7 h-7 rounded-full bg-rose-pastel text-rose-deep text-xs font-bold flex items-center justify-center shrink-0">
                {v.name.charAt(0).toUpperCase()}
              </span>
            )}

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold text-ink-primary leading-tight truncate ${outOfStock ? "line-through" : ""}`}>
                {v.name}
                {showDiff && diff !== 0 && !outOfStock && (
                  <span className="ml-2 text-xs font-medium text-ink-soft">
                    {diff > 0 ? "+" : ""}
                    {formatPrice(diff)}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-ink-soft">
                {outOfStock ? "Agotado" : lowStock ? `¡Últimas ${st}!` : `Stock disponible: ${st}`}
              </p>
            </div>

            {!outOfStock && (
              <div className="inline-flex items-center bg-rose-whisper rounded-full border border-rose-pastel overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => bump(v.id, -1, max)}
                  disabled={q === 0}
                  className="w-8 h-8 flex items-center justify-center text-ink-soft hover:text-rose-deep hover:bg-rose-pastel transition disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label={`Restar ${v.name}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className={`w-8 h-8 flex items-center justify-center font-bold text-sm tabular-nums ${q > 0 ? "text-rose-deep" : "text-ink-soft"}`}>
                  {q}
                </span>
                <button
                  type="button"
                  onClick={() => bump(v.id, +1, max)}
                  disabled={q >= max}
                  className="w-8 h-8 flex items-center justify-center text-ink-soft hover:text-rose-deep hover:bg-rose-pastel transition disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label={`Sumar ${v.name}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-5">
      {/* Tarjetas de opción (packs por mayor) */}
      {showWholesale && (
        <div>
          <label className="text-sm font-semibold text-ink-primary block mb-2.5">
            Elegí cómo comprarlo
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {options.map((o) => {
              const isSel = o.key === selectedKey;
              const disabled = !o.isRegular && o.units > totalStock;
              return (
                <button
                  key={o.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectOption(o.key)}
                  className={`relative text-left rounded-2xl border-2 p-3 transition ${
                    disabled
                      ? "border-rose-pastel bg-rose-pastel/20 opacity-50 cursor-not-allowed"
                      : isSel
                      ? "border-rose-deep bg-rose-whisper shadow-sm"
                      : "border-rose-pastel bg-white hover:border-rose-medium/60"
                  }`}
                >
                  {o.discountPct > 0 && (
                    <span className="absolute -top-2 -right-2 bg-rose-deep text-white text-[11px] font-black rounded-full px-2 py-0.5 shadow">
                      -{o.discountPct}%
                    </span>
                  )}
                  {isSel && (
                    <span className="absolute top-2 right-2 text-rose-deep">
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </span>
                  )}
                  <p className="font-semibold text-sm text-ink-primary leading-tight pr-5">{o.label}</p>
                  <p className="text-[11px] text-ink-soft mt-0.5">
                    {o.isRegular && hasVariants
                      ? "Elegí la cantidad"
                      : `${o.units} ${o.units === 1 ? "unidad" : "unidades"}${
                          hasVariants && isCajaTier(o.label) ? " · tonos surtidos" : ""
                        }`}
                  </p>
                  <div className="mt-1.5 leading-tight">
                    <p className="font-display font-bold text-lg text-rose-deep">
                      {o.isRegular && hasVariants ? `desde ${formatPrice(o.price)}` : formatPrice(o.price)}
                    </p>
                    {!o.isRegular && <p className="text-[11px] text-ink-soft">{formatPrice(o.unitPrice)} c/u</p>}
                  </div>
                  {disabled && <p className="text-[10px] text-error mt-1">Sin stock suficiente</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== PACK CAJA/MEDIA CAJA CON VARIANTES: surtido automático ===== */}
      {isAutoPack && hasVariants && packAlloc && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-sm font-semibold text-ink-primary">Surtido incluido</label>
            <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-rose-pastel text-rose-deep">
              {packAlloc.allocated} {packAlloc.allocated === 1 ? "unidad" : "unidades"}
            </span>
          </div>
          <p className="text-xs text-ink-soft mb-2">
            Los packs vienen surtidos: las {selected.units} unidades se reparten en partes
            iguales entre los tonos/sabores disponibles.
          </p>
          <ul className="rounded-2xl border border-rose-pastel divide-y divide-rose-pastel/70 bg-white overflow-hidden">
            {variants
              .filter((v) => (packAlloc.alloc[v.id] ?? 0) > 0)
              .map((v) => {
                const colorHex = v.attributes?.color_hex as string | undefined;
                const q = packAlloc.alloc[v.id] ?? 0;
                return (
                  <li key={v.id} className="flex items-center gap-3 px-3 py-2.5">
                    {colorHex ? (
                      <span
                        className="w-7 h-7 rounded-full ring-1 ring-black/10 shrink-0"
                        style={{ backgroundColor: colorHex }}
                        title={v.name}
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-rose-pastel text-rose-deep text-xs font-bold flex items-center justify-center shrink-0">
                        {v.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <p className="flex-1 min-w-0 text-sm font-semibold text-ink-primary leading-tight truncate">
                      {v.name}
                    </p>
                    <span className="text-sm font-bold text-rose-deep tabular-nums shrink-0">
                      ×{q}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* ===== PACK MANUAL (no caja) CON VARIANTES: repartir N unidades ===== */}
      {isPack && !isAutoPack && hasVariants && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-sm font-semibold text-ink-primary">
              Elegí {selected.units} {selected.units === 1 ? "unidad" : "unidades"}
            </label>
            <span
              className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                variantQtyTotal === selected.units
                  ? "bg-success/20 text-success"
                  : "bg-rose-pastel text-rose-deep"
              }`}
            >
              {variantQtyTotal} de {selected.units}
            </span>
          </div>
          <p className="text-xs text-ink-soft mb-2">
            Repartí las {selected.units} unidades entre los tonos/sabores con stock.
          </p>
          {renderVariantSteppers(maxForVariant, false)}
        </div>
      )}

      {/* ===== MODO SUELTO CON VARIANTES: cantidad libre ===== */}
      {!isPack && hasVariants && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-sm font-semibold text-ink-primary">Elegí los tonos/sabores</label>
            <span className="text-xs text-ink-soft">Sumá cuánto querés de cada uno</span>
          </div>
          {renderVariantSteppers(maxForVariant, true)}
        </div>
      )}

      {/* ===== MODO SUELTO SIN VARIANTES: stepper simple ===== */}
      {!isPack && !hasVariants && (
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-widest text-ink-soft font-medium">Cantidad</span>
            <div className="inline-flex items-center bg-white rounded-xl border border-rose-medium/30 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setQtyNoVariant(Math.max(1, qtyNoVariant - 1))}
                className="w-9 h-9 flex items-center justify-center text-ink-soft hover:text-rose-deep hover:bg-rose-whisper transition-colors"
                aria-label="Restar"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-9 h-9 flex items-center justify-center font-bold text-base text-ink-primary border-x border-rose-medium/20">
                {qtyNoVariant}
              </span>
              <button
                type="button"
                onClick={() => setQtyNoVariant(qtyNoVariant + 1)}
                className="w-9 h-9 flex items-center justify-center text-ink-soft hover:text-rose-deep hover:bg-rose-whisper transition-colors"
                aria-label="Sumar"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-end leading-tight">
            <span className="text-[10px] uppercase tracking-widest text-ink-soft font-medium">Total</span>
            <span className="font-display font-black text-3xl text-ink-primary tracking-tight">
              {formatPrice(summary.finalPrice)}
            </span>
          </div>
        </div>
      )}

      {/* ===== Resumen con precio tachado (packs) o total (suelto con variantes) ===== */}
      {(isPack || (!isPack && hasVariants)) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-rose-whisper border border-rose-pastel">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-widest text-ink-soft font-medium">Total</span>
            <span className="text-sm font-semibold text-ink-primary">
              {summary.units} {summary.units === 1 ? "unidad" : "unidades"}
            </span>
          </div>
          <div className="flex flex-col items-end leading-tight">
            {summary.savings > 0 && (
              <span className="text-sm text-ink-soft line-through">{formatPrice(summary.regularPrice)}</span>
            )}
            <span className="font-display font-black text-3xl text-ink-primary tracking-tight">
              {formatPrice(summary.finalPrice)}
            </span>
            {summary.savings > 0 && (
              <span className="text-xs font-semibold text-rose-deep">
                Ahorrás {formatPrice(summary.savings)} 🌸
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={loading || !canSubmit}
        className="btn-primary w-full text-base py-4"
      >
        {isAuthed === false ? <LogIn className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
        {loading
          ? "Agregando..."
          : isAuthed === false
          ? "Iniciá sesión para comprar"
          : isAutoPack && hasVariants && !canSubmit
          ? "Sin stock suficiente para el pack"
          : isPack && !isAutoPack && hasVariants && variantQtyTotal !== selected.units
          ? `Elegí ${packRemaining} más`
          : !canSubmit && hasVariants
          ? "Elegí al menos 1 unidad"
          : "Agregar al carrito"}
      </button>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        title="Iniciá sesión para agregar al carrito"
        onSuccess={() => {
          addAll();
        }}
      />
    </div>
  );
}
