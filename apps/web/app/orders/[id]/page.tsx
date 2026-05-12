import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { CheckCircle2, Clock, X, Banknote, Copy } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { formatPrice } from "@cancerianas/shared";
import TransferInstructions from "@/components/TransferInstructions";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status: mpStatus } = await searchParams;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [{ data: order }, { data: pmRow }] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("site_settings").select("value").eq("key", "payment_methods").maybeSingle(),
  ]);

  if (!order) notFound();

  const pm = pmRow?.value ?? {};
  const isTransferPending = order.payment_method === "transfer" && order.status === "pending" && !order.paid_at;
  const isTransferPaid = order.payment_method === "transfer" && (order.status === "paid" || !!order.paid_at);

  return (
    <>
      <Header />
      <section className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        {/* ── Banners de estado MP ─────────────────────── */}
        {mpStatus === "success" && (
          <div className="card bg-success/20 text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-2" />
            <p className="font-display text-2xl text-ink-primary">¡Gracias por tu compra! 🌸</p>
            <p className="text-ink-secondary mt-1">Tu pago se está procesando. Te avisamos cuando se confirme.</p>
          </div>
        )}
        {mpStatus === "pending" && (
          <div className="card bg-warning/20 text-center py-6">
            <Clock className="w-12 h-12 text-warning mx-auto mb-2" />
            <p className="font-display text-2xl">Pago pendiente</p>
            <p className="text-ink-secondary mt-1">Estamos esperando la confirmación de Mercado Pago.</p>
          </div>
        )}
        {mpStatus === "failure" && (
          <div className="card bg-error/20 text-center py-6">
            <X className="w-12 h-12 text-error mx-auto mb-2" />
            <p className="font-display text-2xl">El pago no se pudo procesar</p>
            <p className="text-ink-secondary mt-1">Intentá nuevamente o usá otro medio de pago.</p>
          </div>
        )}

        {/* ── Instrucciones de transferencia ──────────── */}
        {isTransferPending && (
          <TransferInstructions
            orderNumber={order.order_number}
            total={order.total}
            alias={pm.transfer_alias ?? ""}
            cbu={pm.transfer_cbu ?? ""}
            bank={pm.transfer_bank ?? ""}
            holder={pm.transfer_holder ?? ""}
          />
        )}

        {isTransferPaid && (
          <div className="card bg-success/20 text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-2" />
            <p className="font-display text-2xl text-ink-primary">¡Pago confirmado! 🌸</p>
            <p className="text-ink-secondary mt-1">Tu pedido está siendo preparado. En breve te contactamos para el envío.</p>
          </div>
        )}

        {/* ── Detalle de orden ─────────────────────────── */}
        <div className="card">
          <div className="flex justify-between mb-4">
            <div>
              <p className="text-xs text-ink-soft uppercase">Orden</p>
              <p className="font-mono font-bold text-lg">{order.order_number}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-rose-pastel text-rose-deep">{order.status}</span>
              {order.payment_method && (
                <p className="text-xs text-ink-soft mt-1">{order.payment_method === "transfer" ? "Transferencia" : "Mercado Pago"}</p>
              )}
            </div>
          </div>

          <h2 className="font-display text-lg mt-6 mb-3">Productos</h2>
          <div className="space-y-3">
            {order.order_items.map((it: any) => (
              <div key={it.id} className="flex gap-3 pb-3 border-b border-rose-pastel last:border-0">
                {it.image_url && <img src={it.image_url} alt="" className="w-14 h-14 rounded-xl object-cover" />}
                <div className="flex-1">
                  <p className="font-semibold">{it.description}</p>
                  <p className="text-sm text-ink-soft">x{it.quantity}</p>
                </div>
                <p className="font-bold text-rose-deep">{formatPrice(it.subtotal)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-rose-pastel mt-4 pt-4 flex justify-between font-display text-xl">
            <span>Total</span>
            <span className="font-bold text-rose-deep">{formatPrice(order.total)}</span>
          </div>
        </div>

        <Link href="/orders" className="btn-secondary w-full">Ver todas mis compras</Link>
      </section>
      <Footer />
    </>
  );
}
