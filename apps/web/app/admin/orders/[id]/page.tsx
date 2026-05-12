"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck, CheckCircle2, Package, Banknote } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { formatPrice } from "@cancerianas/shared";

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { params.then(p => setOrderId(p.id)); }, [params]);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, profiles(full_name, email, phone), order_items(*)")
        .eq("id", orderId)
        .single();
      setOrder(data);
      setLoading(false);
    })();
  }, [orderId]);

  async function updateStatus(newStatus: string, extra: Record<string, any> = {}) {
    if (!orderId) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus, ...extra })
      .eq("id", orderId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Estado actualizado");
      router.refresh();
      const { data } = await supabase.from("orders").select("*, profiles(*), order_items(*)").eq("id", orderId).single();
      setOrder(data);
    }
  }

  if (loading || !order) return <div className="text-center py-20 text-ink-soft">Cargando...</div>;

  const addr = order.shipping_address;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/orders" className="p-2 hover:bg-rose-pastel rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-3xl text-ink-primary">{order.order_number}</h1>
          <p className="text-ink-soft text-sm">
            {new Date(order.created_at).toLocaleString("es-AR")}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Items */}
          <div className="card">
            <h2 className="font-display text-xl mb-4">Productos</h2>
            <div className="space-y-3">
              {order.order_items?.map((it: any) => (
                <div key={it.id} className="flex gap-3 pb-3 border-b border-rose-pastel last:border-0">
                  {it.image_url && (
                    <img src={it.image_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{it.description}</p>
                    <p className="text-sm text-ink-soft">x{it.quantity} · {formatPrice(it.unit_price)}</p>
                  </div>
                  <p className="font-bold text-rose-deep">{formatPrice(it.subtotal)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-rose-pastel mt-4 pt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
              <div className="flex justify-between"><span>Envío</span><span>{order.shipping_cost > 0 ? formatPrice(order.shipping_cost) : "Gratis"}</span></div>
              <div className="flex justify-between font-display text-xl pt-2"><span>Total</span><span className="text-rose-deep font-bold">{formatPrice(order.total)}</span></div>
            </div>
          </div>

          {/* Dirección */}
          {addr && (
            <div className="card">
              <h2 className="font-display text-xl mb-3">Envío</h2>
              <div className="text-ink-secondary text-sm space-y-1">
                <p className="font-semibold text-ink-primary">{addr.full_name}</p>
                <p>{addr.street} {addr.street_number}{addr.apartment ? `, ${addr.apartment}` : ""}</p>
                <p>{addr.city}, {addr.province} ({addr.zip_code})</p>
                {addr.phone && <p>📱 {addr.phone}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="font-display text-lg mb-3">Cliente</h3>
            <p className="font-semibold">{order.profiles?.full_name || "—"}</p>
            <p className="text-sm text-ink-soft">{order.profiles?.email}</p>
            {order.profiles?.phone && <p className="text-sm text-ink-soft">{order.profiles.phone}</p>}
          </div>

          <div className="card">
            <h3 className="font-display text-lg mb-3">Estado</h3>
            <div className="space-y-2">
              {order.status === "pending" && order.payment_method === "transfer" && (
                <button onClick={() => updateStatus("paid", { paid_at: new Date().toISOString() })} className="btn-primary w-full justify-start">
                  <Banknote className="w-4 h-4" /> Confirmar pago por transferencia
                </button>
              )}
              {order.status === "paid" && (
                <button onClick={() => updateStatus("preparing")} className="btn-secondary w-full justify-start">
                  <Package className="w-4 h-4" /> Marcar como preparando
                </button>
              )}
              {(order.status === "preparing" || order.status === "paid") && (
                <button onClick={() => updateStatus("shipped", { shipped_at: new Date().toISOString() })} className="btn-secondary w-full justify-start">
                  <Truck className="w-4 h-4" /> Marcar como enviada
                </button>
              )}
              {order.status === "shipped" && (
                <button onClick={() => updateStatus("delivered", { delivered_at: new Date().toISOString() })} className="btn-primary w-full justify-start">
                  <CheckCircle2 className="w-4 h-4" /> Marcar como entregada
                </button>
              )}
              <p className="text-xs text-ink-soft pt-2">
                Estado actual: <span className="font-bold text-ink-primary">{order.status}</span>
              </p>
              {order.payment_method && (
                <p className="text-xs text-ink-soft">
                  Pago: <span className="font-semibold">{order.payment_method === "transfer" ? "Transferencia" : "Mercado Pago"}</span>
                </p>
              )}
              {order.paid_at && (
                <p className="text-xs text-success font-semibold">
                  ✅ Pago confirmado: {new Date(order.paid_at).toLocaleString("es-AR")}
                </p>
              )}
              {order.mp_payment_id && (
                <p className="text-xs text-ink-soft">MP: {order.mp_payment_id}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
