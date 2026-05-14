"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Truck, CheckCircle2, Package, Banknote, MessageCircle,
  FileText, Image as ImageIcon, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { formatPrice } from "@cancerianas/shared";

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [proofSignedUrl, setProofSignedUrl] = useState<string | null>(null);

  useEffect(() => { params.then(p => setOrderId(p.id)); }, [params]);

  const reload = async () => {
    if (!orderId) return;
    const { data } = await supabase
      .from("orders")
      .select("*, profiles(full_name, first_name, last_name, email, phone), order_items(*)")
      .eq("id", orderId)
      .single();
    setOrder(data);
    setLoading(false);
  };

  useEffect(() => { if (orderId) reload(); /* eslint-disable-next-line */ }, [orderId]);

  // Signed URL del comprobante para preview
  useEffect(() => {
    if (!order?.payment_proof_url) { setProofSignedUrl(null); return; }
    let cancelled = false;
    supabase.storage
      .from("payment-proofs")
      .createSignedUrl(order.payment_proof_url, 60 * 60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.signedUrl) setProofSignedUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [order?.payment_proof_url, supabase]);

  async function updateStatus(newStatus: string, extra: Record<string, any> = {}) {
    if (!orderId) return;
    setBusy(true);
    const { error } = await supabase.from("orders").update({ status: newStatus, ...extra }).eq("id", orderId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Estado actualizado");
    await reload();
    router.refresh();
  }

  /** Aprueba el pago de la orden y, si la clienta pidió envío, crea un shipment
   *  en estado pending_address (cliente debe llenar formulario de dirección). */
  async function approvePayment() {
    if (!orderId || !order) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      // 1) Mover orden a paid + marcar quién/cuándo aprobó
      const { error: orderErr } = await supabase.from("orders").update({
        status: "paid",
        paid_at: now,
        payment_approved_at: now,
        payment_approved_by: user?.id ?? null,
      }).eq("id", orderId);
      if (orderErr) throw orderErr;

      // 2) Si la clienta pidió envío, crear shipment
      if (order.wants_shipping !== false) {
        const description = (order.order_items ?? [])
          .map((it: any) => `${it.quantity}x ${it.description}`)
          .join(", ")
          .slice(0, 200) || `Pedido ${order.order_number}`;

        const { error: shipErr } = await supabase.from("shipments").insert({
          user_id: order.user_id,
          order_id: order.id,
          status: "pending_address",
          carrier: "personalizado",
          description,
          weight_grams: 500,            // default; admin lo ajusta luego
          declared_value: order.subtotal,
          destination_type: order.destination_type_requested ?? "domicilio",
          created_by: user?.id ?? null,
        });
        if (shipErr) throw shipErr;
        toast.success("Pago aprobado + envío creado. La clienta ahora puede llenar el formulario 🌸");
      } else {
        toast.success("Pago aprobado 🌸");
      }

      await reload();
      router.refresh();
    } catch (e: any) {
      toast.error("No se pudo aprobar: " + (e?.message ?? "error"));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !order) return <div className="text-center py-20 text-ink-soft">Cargando...</div>;

  const addr = order.shipping_address;
  const profName =
    [order.profiles?.first_name, order.profiles?.last_name].filter(Boolean).join(" ") ||
    order.profiles?.full_name || "—";

  const hasProof = !!order.payment_proof_url;
  const proofViaWA = !!order.payment_proof_via_whatsapp;
  const isImage = hasProof && /\.(jpe?g|png|webp)$/i.test(order.payment_proof_url);

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
          {/* Comprobante / Marca de WhatsApp */}
          {(hasProof || proofViaWA) && (
            <div className="card border-2 border-rose-deep/30 bg-rose-whisper/40">
              <h2 className="font-display text-xl mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-deep" />
                Comprobante de pago
              </h2>
              {proofViaWA && (
                <div className="rounded-2xl bg-success/10 border border-success/30 p-3 flex items-start gap-2 mb-3">
                  <MessageCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-ink-primary">La clienta marcó que envía el comprobante por WhatsApp</p>
                    <p className="text-ink-soft text-xs mt-0.5">
                      Verificá en tu WA con la referencia <strong>ORDEN {order.order_number}</strong>.
                      Si lo recibiste y está OK, aprobá el pago abajo.
                    </p>
                  </div>
                </div>
              )}
              {hasProof && proofSignedUrl && (
                <div className="space-y-2">
                  {isImage ? (
                    <a href={proofSignedUrl} target="_blank" rel="noopener" className="block rounded-2xl overflow-hidden border border-rose-pastel hover:shadow-lift transition">
                      <img src={proofSignedUrl} alt="Comprobante" className="w-full max-h-96 object-contain bg-white" />
                    </a>
                  ) : (
                    <a href={proofSignedUrl} target="_blank" rel="noopener" className="flex items-center gap-2 text-rose-deep font-semibold hover:underline">
                      <ImageIcon className="w-4 h-4" />
                      Ver comprobante (PDF)
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <p className="text-xs text-ink-soft">
                    Subido {new Date(order.payment_proof_at).toLocaleString("es-AR")}
                  </p>
                </div>
              )}
              {hasProof && !proofSignedUrl && (
                <p className="text-xs text-ink-soft">Cargando comprobante...</p>
              )}
            </div>
          )}

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
              <div className="flex justify-between"><span>Envío</span><span>{order.shipping_cost > 0 ? formatPrice(order.shipping_cost) : "se cotiza aparte"}</span></div>
              <div className="flex justify-between font-display text-xl pt-2"><span>Total</span><span className="text-rose-deep font-bold">{formatPrice(order.total)}</span></div>
            </div>
          </div>

          {/* Modalidad de entrega elegida en checkout */}
          {order.wants_shipping !== false && (
            <div className="card">
              <h2 className="font-display text-xl mb-2">Modalidad de entrega</h2>
              <p className="text-sm text-ink-secondary">
                La clienta eligió: <strong className="text-ink-primary">
                  {order.destination_type_requested === "sucursal" ? "Retiro en sucursal de correo" : "Envío a domicilio"}
                </strong>
              </p>
              <p className="text-xs text-ink-soft mt-1">Cuando apruebes el pago, se crea automáticamente un envío y se le pide la dirección/sucursal exacta.</p>
            </div>
          )}

          {/* Dirección original del checkout (datos de contacto) */}
          {addr && (
            <div className="card">
              <h2 className="font-display text-xl mb-3">Contacto del checkout</h2>
              <div className="text-ink-secondary text-sm space-y-1">
                <p className="font-semibold text-ink-primary">{addr.full_name}</p>
                {addr.email && <p>✉️ {addr.email}</p>}
                {addr.phone && <p>📱 {addr.phone}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="font-display text-lg mb-3">Cliente</h3>
            <p className="font-semibold">{profName}</p>
            <p className="text-sm text-ink-soft">{order.profiles?.email}</p>
            {order.profiles?.phone && <p className="text-sm text-ink-soft">{order.profiles.phone}</p>}
          </div>

          <div className="card">
            <h3 className="font-display text-lg mb-3">Acciones</h3>
            <div className="space-y-2">
              {order.status === "pending_approval" && (
                <button onClick={approvePayment} disabled={busy} className="btn-primary w-full justify-start disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" /> Aprobar pago
                </button>
              )}
              {order.status === "pending" && order.payment_method === "transfer" && (
                <button onClick={approvePayment} disabled={busy} className="btn-primary w-full justify-start disabled:opacity-50">
                  <Banknote className="w-4 h-4" /> Confirmar y aprobar
                </button>
              )}
              {order.status === "paid" && (
                <button onClick={() => updateStatus("preparing")} disabled={busy} className="btn-secondary w-full justify-start disabled:opacity-50">
                  <Package className="w-4 h-4" /> Marcar como preparando
                </button>
              )}
              {(order.status === "preparing" || order.status === "paid") && (
                <button onClick={() => updateStatus("shipped", { shipped_at: new Date().toISOString() })} disabled={busy} className="btn-secondary w-full justify-start disabled:opacity-50">
                  <Truck className="w-4 h-4" /> Marcar como enviada
                </button>
              )}
              {order.status === "shipped" && (
                <button onClick={() => updateStatus("delivered", { delivered_at: new Date().toISOString() })} disabled={busy} className="btn-primary w-full justify-start disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" /> Marcar como entregada
                </button>
              )}

              <div className="text-xs space-y-1 pt-2 border-t border-rose-pastel">
                <p className="text-ink-soft">
                  Estado: <span className="font-bold text-ink-primary">{order.status}</span>
                </p>
                {order.payment_method && (
                  <p className="text-ink-soft">
                    Pago: <span className="font-semibold">{order.payment_method === "transfer" ? "Transferencia" : "Mercado Pago"}</span>
                  </p>
                )}
                {order.paid_at && (
                  <p className="text-success font-semibold">
                    ✅ Pago confirmado: {new Date(order.paid_at).toLocaleString("es-AR")}
                  </p>
                )}
                {order.payment_approved_at && order.payment_approved_at !== order.paid_at && (
                  <p className="text-ink-soft">
                    Aprobado: {new Date(order.payment_approved_at).toLocaleString("es-AR")}
                  </p>
                )}
                {order.mp_payment_id && <p className="text-ink-soft">MP: {order.mp_payment_id}</p>}
              </div>
            </div>
          </div>

          {/* Link rápido al shipment si ya existe */}
          {order.status !== "pending" && order.status !== "pending_approval" && order.wants_shipping !== false && (
            <div className="card bg-rose-whisper/40 border border-rose-pastel">
              <p className="text-xs text-ink-soft mb-2">Envío asociado</p>
              <Link href={`/admin/shipments?order_id=${order.id}`} className="text-rose-deep font-semibold text-sm hover:underline inline-flex items-center gap-1">
                Ver envío de esta orden <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
