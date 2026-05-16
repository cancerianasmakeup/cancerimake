"use client";

// Botón "+" en la card de producto, estilo Glovo/Rappi:
// - Estado inicial: pill circular con "+"
// - Después del primer click: stepper [ − N + ] al lado del mismo lugar
// - "−" baja 1 (si llega a 0 vuelve a mostrarse el +)
// - "+" suma 1 más en el carrito
// - Si el producto tiene variantes, el + NO suma directo: lleva al detalle

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { addItemToCart, removeOneFromCart } from "@/lib/cart";
import LoginModal from "./LoginModal";

export default function QuickAddButton({
  productId,
  productSlug,
  price,
  hasVariants,
  className = "",
}: {
  productId: string;
  productSlug: string;
  price: number;
  hasVariants: boolean;
  className?: string;
}) {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [qty, setQty] = useState(0); // 0 = mostrar "+", >0 = mostrar stepper
  const [busy, setBusy] = useState<null | "add" | "sub">(null);
  const [loginOpen, setLoginOpen] = useState(false);

  async function ensureAuth(): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoginOpen(true);
      return null;
    }
    return user.id;
  }

  async function doAdd() {
    if (busy) return;
    setBusy("add");
    try {
      const userId = await ensureAuth();
      if (!userId) return;
      await addItemToCart(supabase, {
        userId,
        productId,
        variantId: null,
        quantity: 1,
        unitPrice: price,
      });
      const next = qty + 1;
      setQty(next);
      if (next === 1) {
        toast.success("Sumado al carrito 🌸", {
          action: { label: "Ver carrito", onClick: () => router.push("/checkout") },
        });
      }
    } catch (e: any) {
      toast.error(e.message || "No se pudo sumar");
    } finally {
      setBusy(null);
    }
  }

  async function doSub() {
    if (busy || qty <= 0) return;
    setBusy("sub");
    try {
      const userId = await ensureAuth();
      if (!userId) return;
      const { newQty } = await removeOneFromCart(supabase, {
        userId,
        productId,
        variantId: null,
      });
      setQty(newQty);
    } catch (e: any) {
      toast.error(e.message || "No se pudo restar");
    } finally {
      setBusy(null);
    }
  }

  function handlePlusClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants && qty === 0) {
      router.push(`/product/${productSlug}`);
      return;
    }
    doAdd();
  }

  function handleMinusClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    doSub();
  }

  // --- Stepper ya tiene cantidad > 0 ---
  if (qty > 0) {
    return (
      <>
        <div
          className={`inline-flex items-center bg-rose-deep text-white rounded-full shadow-md overflow-hidden ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleMinusClick}
            disabled={busy !== null}
            aria-label="Restar 1"
            className="w-9 h-9 flex items-center justify-center hover:bg-rose-primary/80 active:scale-90 transition disabled:opacity-60"
          >
            {busy === "sub" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Minus className="w-4 h-4" strokeWidth={3} />}
          </button>
          <span className="min-w-[22px] px-1 text-center font-black text-sm tabular-nums select-none">
            {qty}
          </span>
          <button
            type="button"
            onClick={handlePlusClick}
            disabled={busy !== null}
            aria-label="Sumar 1"
            className="w-9 h-9 flex items-center justify-center hover:bg-rose-primary/80 active:scale-90 transition disabled:opacity-60"
          >
            {busy === "add" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={3} />}
          </button>
        </div>

        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          title="Iniciá sesión para sumar al carrito"
          onSuccess={() => {
            setLoginOpen(false);
            doAdd();
          }}
        />
      </>
    );
  }

  // --- Pill circular "+" inicial ---
  const label = hasVariants ? "Elegir variante y sumar" : "Sumar al carrito";
  return (
    <>
      <button
        type="button"
        onClick={handlePlusClick}
        disabled={busy !== null}
        aria-label={label}
        title={label}
        className={`w-10 h-10 rounded-full flex items-center justify-center bg-rose-deep text-white shadow-md transition-all duration-200 hover:bg-rose-primary hover:scale-110 active:scale-95 disabled:opacity-80 disabled:cursor-wait ${className}`}
      >
        {busy === "add" ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Plus className="w-5 h-5" strokeWidth={3} />
        )}
      </button>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        title="Iniciá sesión para sumar al carrito"
        onSuccess={() => {
          setLoginOpen(false);
          if (!hasVariants) doAdd();
          else router.push(`/product/${productSlug}`);
        }}
      />
    </>
  );
}
