"use client";

// Botón de agregar al carrito en la página de detalle del producto.
//
// Caso 1: producto SIN variantes → un solo stepper de cantidad.
// Caso 2: producto CON variantes → un stepper por variante.
//   Esto evita que el stock se "vuelva loco": cada línea del carrito queda con
//   su variant_id y su qty, y stockeamos descontando por variante en checkout.
//   El total muestra la suma de unidades y de precio (con price_diff por variante).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Minus, Plus, LogIn } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { addItemToCart } from "@/lib/cart";
import { formatPrice } from "@cancerianas/shared";
import type { ProductVariant } from "@cancerianas/shared";
import LoginModal from "./LoginModal";

export default function AddToCartButton({
  productId,
  price,
  variants,
}: {
  productId: string;
  price: number;
  variants: ProductVariant[];
}) {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const hasVariants = variants.length > 0;

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

  const totals = useMemo(() => {
    if (!hasVariants) {
      return { qty: qtyNoVariant, price: price * qtyNoVariant };
    }
    let qty = 0;
    let total = 0;
    for (const v of variants) {
      const q = qtyByVariant[v.id] ?? 0;
      if (q > 0) {
        qty += q;
        total += q * (price + Number(v.price_diff ?? 0));
      }
    }
    return { qty, price: total };
  }, [hasVariants, qtyNoVariant, qtyByVariant, variants, price]);

  const canSubmit = totals.qty > 0;

  function bump(variantId: string, delta: number, max: number) {
    setQtyByVariant((prev) => {
      const curr = prev[variantId] ?? 0;
      const next = Math.max(0, Math.min(max, curr + delta));
      return { ...prev, [variantId]: next };
    });
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

      if (!hasVariants) {
        await addItemToCart(supabase, {
          userId: user.id,
          productId,
          variantId: null,
          quantity: qtyNoVariant,
          unitPrice: price,
        });
      } else {
        for (const v of variants) {
          const q = qtyByVariant[v.id] ?? 0;
          if (q <= 0) continue;
          await addItemToCart(supabase, {
            userId: user.id,
            productId,
            variantId: v.id,
            quantity: q,
            unitPrice: price + Number(v.price_diff ?? 0),
          });
        }
      }

      toast.success(
        totals.qty === 1
          ? "Agregado al carrito 🌸"
          : `${totals.qty} productos agregados al carrito 🌸`,
        {
          action: { label: "Ver carrito", onClick: () => router.push("/checkout") },
        }
      );

      // Reset para evitar dobles agregados al volver a clickear
      if (!hasVariants) setQtyNoVariant(1);
      else setQtyByVariant({});
    } catch (e: any) {
      toast.error(e.message || "Algo falló");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Lista de variantes con stepper por cada una */}
      {hasVariants && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-sm font-semibold text-ink-primary">
              Elegí los tonos/sabores
            </label>
            <span className="text-xs text-ink-soft">
              Sumá cuánto querés de cada uno
            </span>
          </div>

          <ul className="rounded-2xl border border-rose-pastel divide-y divide-rose-pastel/70 bg-white overflow-hidden">
            {variants.map((v) => {
              const colorHex = v.attributes?.color_hex as string | undefined;
              const stock = v.stock ?? 0;
              const outOfStock = stock <= 0;
              const q = qtyByVariant[v.id] ?? 0;
              const lowStock = !outOfStock && stock <= 3;
              const diff = Number(v.price_diff ?? 0);

              return (
                <li
                  key={v.id}
                  className={`flex items-center gap-3 px-3 py-2.5 ${
                    outOfStock ? "opacity-50" : ""
                  }`}
                >
                  {/* Swatch / placeholder */}
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

                  {/* Nombre + sub-info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold text-ink-primary leading-tight truncate ${outOfStock ? "line-through" : ""}`}>
                      {v.name}
                      {diff !== 0 && !outOfStock && (
                        <span className="ml-2 text-xs font-medium text-ink-soft">
                          {diff > 0 ? "+" : ""}
                          {formatPrice(diff)}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      {outOfStock
                        ? "Agotado"
                        : lowStock
                        ? `¡Últimas ${stock}!`
                        : `Stock disponible: ${stock}`}
                    </p>
                  </div>

                  {/* Stepper */}
                  {!outOfStock && (
                    <div className="inline-flex items-center bg-rose-whisper rounded-full border border-rose-pastel overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => bump(v.id, -1, stock)}
                        disabled={q === 0}
                        className="w-8 h-8 flex items-center justify-center text-ink-soft hover:text-rose-deep hover:bg-rose-pastel transition disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label={`Restar ${v.name}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span
                        className={`w-8 h-8 flex items-center justify-center font-bold text-sm tabular-nums ${
                          q > 0 ? "text-rose-deep" : "text-ink-soft"
                        }`}
                      >
                        {q}
                      </span>
                      <button
                        type="button"
                        onClick={() => bump(v.id, +1, stock)}
                        disabled={q >= stock}
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
        </div>
      )}

      {/* Stepper simple cuando NO hay variantes */}
      {!hasVariants && (
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-widest text-ink-soft font-medium">
              Cantidad
            </span>
            <div className="inline-flex items-center bg-white rounded-xl border border-rose-medium/30 shadow-sm overflow-hidden">
              <button
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
                onClick={() => setQtyNoVariant(qtyNoVariant + 1)}
                className="w-9 h-9 flex items-center justify-center text-ink-soft hover:text-rose-deep hover:bg-rose-whisper transition-colors"
                aria-label="Sumar"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col items-end leading-tight">
            <span className="text-[10px] uppercase tracking-widest text-ink-soft font-medium">
              Total
            </span>
            <span className="font-display font-black text-3xl text-ink-primary tracking-tight">
              {formatPrice(totals.price)}
            </span>
          </div>
        </div>
      )}

      {/* Totales cuando HAY variantes */}
      {hasVariants && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-rose-whisper border border-rose-pastel">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-widest text-ink-soft font-medium">
              Total
            </span>
            <span className="text-sm font-semibold text-ink-primary">
              {totals.qty} {totals.qty === 1 ? "unidad" : "unidades"}
            </span>
          </div>
          <span className="font-display font-black text-3xl text-ink-primary tracking-tight">
            {formatPrice(totals.price)}
          </span>
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
