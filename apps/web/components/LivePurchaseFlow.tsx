"use client";

import { useEffect, useState } from "react";
import { Clock, ExternalLink, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { formatPrice } from "@cancerianas/shared";
import type { LivePurchase } from "@cancerianas/shared";

export default function LivePurchaseFlow({
  purchase,
  onUpdate,
}: {
  purchase: LivePurchase & { live_offers?: any };
  onUpdate: () => void;
}) {
  const supabase = createSupabaseBrowser();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  // Countdown cuando está en estado paying
  useEffect(() => {
    if (purchase.status !== "paying" || !purchase.reserved_until) return;

    const updateCountdown = () => {
      const expires = new Date(purchase.reserved_until!).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        toast.error("Se venció tu turno 🌸");
        onUpdate();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [purchase.reserved_until, purchase.status]);

  async function startPayment() {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-preference`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: "live_purchase", id: purchase.id }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.init_point) throw new Error(result.error || "Error iniciando pago");
      window.location.href = result.init_point;
    } catch (e: any) {
      toast.error(e.message);
      setCreating(false);
    }
  }

  async function cancel() {
    if (!confirm("¿Querés salir de la fila?")) return;
    await supabase
      .from("live_purchases")
      .update({ status: "cancelled" })
      .eq("id", purchase.id);
    toast.success("Saliste de la fila");
    onUpdate();
  }

  if (purchase.status === "queued") {
    return (
      <div className="card bg-gradient-to-br from-rose-pastel to-rose-medium/30 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Clock className="w-6 h-6 text-rose-deep" />
          <span className="font-display text-xl text-ink-primary">Estás en la fila</span>
        </div>
        <p className="text-ink-secondary mb-2">
          Posición <span className="font-bold text-rose-deep text-2xl">#{purchase.queue_position}</span>
        </p>
        <p className="text-sm text-ink-soft mb-4">
          Cuando se libere un lugar, te avisamos. Mantené esta página abierta.
        </p>
        <p className="font-semibold text-ink-primary">
          {purchase.live_offers?.name} · {formatPrice(purchase.amount)}
        </p>
        <button onClick={cancel} className="text-sm text-ink-soft mt-3 hover:text-error inline-flex items-center gap-1">
          <X className="w-4 h-4" /> Salir de la fila
        </button>
      </div>
    );
  }

  if (purchase.status === "paying") {
    const minutes = Math.floor((secondsLeft ?? 0) / 60);
    const seconds = (secondsLeft ?? 0) % 60;
    const urgent = (secondsLeft ?? 0) < 30;

    return (
      <div className={`card mb-6 ${urgent ? "bg-error/10 animate-soft-pulse" : "bg-gradient-to-br from-rose-pastel to-rose-medium/40"}`}>
        <div className="text-center">
          <div className="text-5xl mb-2">🌸</div>
          <p className="font-display text-2xl text-ink-primary">¡Es tu turno!</p>
          <p className="text-ink-secondary mt-1 mb-4">{purchase.live_offers?.name}</p>

          <div className={`text-5xl font-bold tabular-nums my-4 ${urgent ? "text-error" : "text-rose-deep"}`}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          <p className="text-xs text-ink-soft mb-6">Tiempo para completar el pago</p>

          <p className="font-display text-3xl text-ink-primary mb-6">
            {formatPrice(purchase.amount)}
          </p>

          <button
            onClick={startPayment}
            disabled={creating || secondsLeft === 0}
            className="btn-primary w-full text-base py-4"
          >
            <ExternalLink className="w-5 h-5" />
            {creating ? "Conectando con Mercado Pago..." : "Pagar con Mercado Pago"}
          </button>
          <p className="text-xs text-ink-soft mt-3">
            Te llevamos a Mercado Pago. Volvé acá después de pagar.
          </p>
        </div>
      </div>
    );
  }

  if (purchase.status === "paid") {
    return (
      <div className="card bg-success/20 mb-6 text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-2" />
        <p className="font-display text-xl text-ink-primary">¡Pago confirmado! 🌸</p>
        <p className="text-ink-secondary mt-1">Te enviamos el comprobante por mail.</p>
      </div>
    );
  }

  return null;
}
