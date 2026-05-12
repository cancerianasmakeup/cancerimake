"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { formatPrice } from "@cancerianas/shared";
import type { ProductVariant } from "@cancerianas/shared";

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
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function addToCart() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth?redirect=" + encodeURIComponent(window.location.pathname));
        return;
      }

      // Encontrar o crear carrito activo
      let { data: cart } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!cart) {
        const { data: newCart } = await supabase
          .from("carts")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        cart = newCart;
      }
      if (!cart) throw new Error("No se pudo crear el carrito");

      // Buscar item existente
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cart.id)
        .eq("product_id", productId)
        .eq("variant_id", selectedVariant ?? null)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + qty })
          .eq("id", existing.id);
      } else {
        await supabase.from("cart_items").insert({
          cart_id: cart.id,
          product_id: productId,
          variant_id: selectedVariant,
          quantity: qty,
          unit_price: price,
        });
      }

      toast.success("Agregado al carrito 🌸", {
        action: { label: "Ver carrito", onClick: () => router.push("/checkout") },
      });
    } catch (e: any) {
      toast.error(e.message || "Algo falló");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {variants.length > 0 && (
        <div>
          <label className="text-sm font-semibold text-ink-primary mb-2 block text-center">
            Elegí una opción
            {selectedVariant && (
              <span className="ml-2 font-normal text-ink-soft">
                — {variants.find((v) => v.id === selectedVariant)?.name}
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-3 justify-center">
            {variants.map((v) => {
              const colorHex = v.attributes?.color_hex as string | undefined;
              const isSelected = selectedVariant === v.id;
              const outOfStock = v.stock === 0;

              if (colorHex) {
                // Mostrar como swatch circular de color
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v.id)}
                    disabled={outOfStock}
                    title={v.name}
                    aria-label={v.name}
                    className={`relative w-10 h-10 rounded-full transition-transform focus:outline-none ${
                      isSelected ? "ring-2 ring-offset-2 ring-rose-deep scale-110" : "hover:scale-110"
                    } ${outOfStock ? "opacity-40" : ""}`}
                    style={{ backgroundColor: colorHex }}
                  >
                    {outOfStock && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">✕</span>
                    )}
                  </button>
                );
              }

              // Fallback: botón texto (variantes sin color_hex)
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(v.id)}
                  disabled={outOfStock}
                  className={`px-4 py-2 rounded-full border font-medium transition ${
                    isSelected
                      ? "bg-rose-deep text-white border-rose-deep"
                      : "bg-white text-ink-primary border-rose-medium/40 hover:border-rose-deep"
                  } ${outOfStock ? "opacity-40 line-through" : ""}`}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-6">
        {/* Selector de cantidad — más chico */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-widest text-ink-soft font-medium">Cantidad</span>
          <div className="inline-flex items-center bg-white rounded-xl border border-rose-medium/30 shadow-sm overflow-hidden">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-8 h-8 flex items-center justify-center text-ink-soft hover:text-rose-deep hover:bg-rose-whisper transition-colors"
              aria-label="Restar"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 h-8 flex items-center justify-center font-bold text-base text-ink-primary border-x border-rose-medium/20">
              {qty}
            </span>
            <button
              onClick={() => setQty(qty + 1)}
              className="w-8 h-8 flex items-center justify-center text-ink-soft hover:text-rose-deep hover:bg-rose-whisper transition-colors"
              aria-label="Sumar"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Precio final — derecha, grande, negro */}
        <div className="flex flex-col items-end leading-tight">
          <span className="text-[10px] uppercase tracking-widest text-ink-soft font-medium">Total</span>
          <span className="font-display font-black text-3xl text-ink-primary tracking-tight">
            {formatPrice(price * qty)}
          </span>
        </div>
      </div>

      <button
        onClick={addToCart}
        disabled={loading || (variants.length > 0 && !selectedVariant)}
        className="btn-primary w-full text-base py-4"
      >
        <ShoppingBag className="w-5 h-5" />
        {loading ? "Agregando..." : "Agregar al carrito"}
      </button>
    </div>
  );
}
