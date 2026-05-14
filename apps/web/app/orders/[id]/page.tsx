import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { CheckCircle2, Clock, X, Truck, ArrowRight, Package } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getBrandInfo } from "@/lib/site-settings";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { formatPrice } from "@cancerianas/shared";
import TransferInstructions from "@/components/TransferInstructions";
import PaymentProofUploader from "@/components/PaymentProofUploader";
import { getOrderStatusLabel } from "@/lib/order-status";

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

  const [{ data: order }, { data: pmRow }, brand] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("site_settings").select("value").eq("key", "payment_methods").maybeSingle(),
    getBrandInfo(),
  ]);

  if (!order) notFound();

  // Shipment vinculado (si admin ya aprobó el pago y creó el envío)
  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, status, destination_type, cost_charged, tracking_number, tracking_url")
    .eq("order_id", order.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const pm = pmRow?.value ?? {};
  const isTransfer = order.payment_method === "transfer";
  const isTransferPending = isTransfer && order.status === "pending" && !order.paid_at;
  const isTransferPendingApproval = isTransfer && order.status === "pending_approval";
  const isPaid = order.status === "paid" || !!order.paid_at;
  const statusCfg = getOrderStatusLabel(order.status);

  return (
    <>
      <Header />
      <section className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        {/* ── Banner CTA del envío (cuando hay shipment vinculado) ────── */}
        {shipment && shipment.status === "pending_address" && (
          <Link
            href={`/shipment/${shipment.id}`}
            className="block rounded-3xl bg-gradient-to-r from-rose-deep to-rose-primary text-white p-5 shadow-lift hover:scale-[1.01] transition-transform"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg font-bold leading-tight">Tenés un envío esperando 📦</p>
                <p className="text-sm text-white/85">Completá tus datos para que te lo mandemos</p>
              </div>
              <ArrowRight className="w-5 h-5 flex-shrink-0" />
            </div>
          </Link>
        )}
        {shipment && (shipment.status === "pending_custom_quote" || shipment.status === "pending_quote") && (
          <div className="rounded-3xl bg-rose-whisper border-2 border-rose-pastel p-5">
            <div className="flex items-center gap-4">
              <Clock className="w-6 h-6 text-rose-deep flex-shrink-0" />
              <div className="flex-1">
                <p className="font-display font-bold text-ink-primary">Cotizando tu envío 💗</p>
                <p className="text-sm text-ink-secondary">Estamos calculando cuánto sale tu envío. Te avisamos por WhatsApp ni bien lo tengamos.</p>
              </div>
            </div>
          </div>
        )}
        {shipment && shipment.status === "pending_payment" && (
          <Link
            href={`/shipment/${shipment.id}`}
            className="block rounded-3xl bg-gradient-to-r from-warning to-rose-deep text-white p-5 shadow-lift hover:scale-[1.01] transition-transform"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg font-bold leading-tight">Pagá tu envío 💸</p>
                <p className="text-sm text-white/85">Ya cotizamos: ${Number(shipment.cost_charged ?? 0).toLocaleString("es-AR")}. Click acá para pagarlo.</p>
              </div>
              <ArrowRight className="w-5 h-5 flex-shrink-0" />
            </div>
          </Link>
        )}
        {shipment && shipment.tracking_number && (
          <Link
            href={`/shipment/${shipment.id}`}
            className="block rounded-3xl bg-success/15 border-2 border-success/40 p-5 hover:bg-success/20 transition"
          >
            <div className="flex items-center gap-4">
              <Truck className="w-6 h-6 text-success flex-shrink-0" />
              <div className="flex-1">
                <p className="font-display font-bold text-ink-primary">Tu paquete está en camino 📦</p>
                <p className="text-sm text-ink-secondary">Seguimiento: <span className="font-mono">{shipment.tracking_number}</span></p>
              </div>
              <ArrowRight className="w-5 h-5 text-success" />
            </div>
          </Link>
        )}

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
        {(isTransferPending || isTransferPendingApproval) && (
          <TransferInstructions
            orderNumber={order.order_number}
            total={order.total}
            alias={pm.transfer_alias ?? ""}
            cbu={pm.transfer_cbu ?? ""}
            bank={pm.transfer_bank ?? ""}
            holder={pm.transfer_holder ?? ""}
          />
        )}

        {/* ── Subir comprobante / Marcar enviado por WhatsApp ──── */}
        {isTransfer && (order.status === "pending" || order.status === "pending_approval") && (
          <PaymentProofUploader
            entityType="order"
            entityId={order.id}
            userId={user.id}
            reference={order.order_number}
            amount={Number(order.total)}
            whatsappNumber={brand.whatsapp}
            label="la orden"
            existingProofUrl={order.payment_proof_url}
            existingViaWhatsapp={order.payment_proof_via_whatsapp}
            currentStatus={order.status}
          />
        )}

        {isPaid && (
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
              <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${statusCfg.badge}`}>
                {statusCfg.label}
              </span>
              {order.payment_method && (
                <p className="text-xs text-ink-soft mt-1">{order.payment_method === "transfer" ? "Transferencia" : "Mercado Pago"}</p>
              )}
            </div>
          </div>

          {order.wants_shipping !== false && order.destination_type_requested && (
            <div className="bg-rose-whisper/50 rounded-xl p-3 mb-4 text-sm">
              <strong className="text-ink-primary">Modalidad de entrega:</strong>{" "}
              {order.destination_type_requested === "domicilio" ? "Envío a domicilio" : "Retiro en sucursal de correo"}
            </div>
          )}

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
