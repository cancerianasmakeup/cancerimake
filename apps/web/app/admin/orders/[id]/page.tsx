"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Truck, CheckCircle2, Package, Banknote, MessageCircle,
  FileText, Image as ImageIcon, ExternalLink, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { formatPrice } from "@cancerianas/shared";
import { useConfirm, usePrompt } from "@/components/ConfirmDialog";
import { getOrderStatusLabel } from "@/lib/order-status";

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const confirm = useConfirm();
  const prompt = usePrompt();
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
      .select("*, profiles!user_id(full_name, first_name, last_name, email, phone), order_items(*)")
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Aprueba el pago de la orden y, si la clienta pidió envío, crea un shipment
   *  en estado pending_address (cliente debe llenar formulario de dirección). */
  async function approvePayment() {
    if (!orderId || !order) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      // Guardamos si la orden ya estaba "paid" antes — si lo estaba (caso re-aprobación
      // para crear shipment) NO descontamos stock de nuevo.
      const wasAlreadyPaid = order.status === "paid";

      // 1) Mover orden a paid + marcar quién/cuándo aprobó
      const { error: orderErr } = await supabase.from("orders").update({
        status: "paid",
        paid_at: now,
        payment_approved_at: now,
        payment_approved_by: user?.id ?? null,
      }).eq("id", orderId);
      if (orderErr) throw orderErr;

      // 1.b) Descontar stock por cada item — solo si la orden no estaba ya pagada
      //      (en pagos vía MP el webhook descuenta; acá manejamos transferencia/manual).
      if (!wasAlreadyPaid) {
        for (const it of (order.order_items ?? [])) {
          try {
            if (it.variant_id) {
              await supabase.rpc("decrement_variant_stock", {
                p_variant_id: it.variant_id,
                p_qty: it.quantity,
              });
            } else if (it.product_id) {
              await supabase.rpc("decrement_product_stock", {
                p_product_id: it.product_id,
                p_qty: it.quantity,
              });
            }
          } catch (stockErr) {
            // No abortamos la aprobación por un error de stock individual —
            // logueamos para que admin pueda corregir manualmente.
            console.error("decrement_stock falló para item", it.id, stockErr);
          }
        }
      }

      // 2) Si la clienta pidió envío, crear shipment usando el carrier elegido en checkout
      if (order.wants_shipping !== false) {
        const description = (order.order_items ?? [])
          .map((it: any) => `${it.quantity}x ${it.description}`)
          .join(", ")
          .slice(0, 200) || `Pedido ${order.order_number}`;

        // Si la clienta eligió Correo Argentino en el checkout, ya pagó el envío;
        // el shipment queda con CP + tipo de destino + costo ya cargado.
        const shippingMeta = order.shipping_address ?? {};
        const carrierSelected = shippingMeta.carrier_selected ?? "personalizado";
        const correoQuote = shippingMeta.correo_quote ?? null;

        const baseRow: any = {
          user_id: order.user_id,
          order_id: order.id,
          status: "pending_address",
          carrier: carrierSelected,
          description,
          weight_grams: 500, // default; admin lo ajusta luego
          declared_value: order.subtotal,
          destination_type: order.destination_type_requested ?? "domicilio",
          created_by: user?.id ?? null,
        };

        if (carrierSelected === "correo_argentino" && correoQuote?.cost && correoQuote?.cp) {
          baseRow.cost_quoted = correoQuote.cost;
          baseRow.cost_charged = correoQuote.cost;
          baseRow.destination_address = {
            codigoPostal: correoQuote.cp,
            full_name: shippingMeta.full_name ?? null,
            telefono: shippingMeta.phone ?? null,
            // resto lo completa la clienta en el wizard (calle, número, localidad, etc)
          };
          // El envío ya está pagado junto con la orden — saltamos directo a "paid"
          baseRow.status = "pending_address";
          baseRow.paid_at = now;
        }

        const { error: shipErr } = await supabase.from("shipments").insert(baseRow);
        if (shipErr) throw shipErr;
        const carrierLabel = carrierSelected === "correo_argentino" ? "Correo Argentino" : carrierSelected === "andreani" ? "Andreani" : "Personalizado";
        toast.success(`Pago aprobado + envío creado (${carrierLabel}). La clienta ahora puede completar la dirección 🌸`);
      } else {
        toast.success("Pago aprobado 🌸");
      }

      await reload();
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error("No se pudo aprobar: " + (e?.message ?? "error"));
    } finally {
      setBusy(false);
    }
  }

  /** Pide número de seguimiento (obligatorio) y lo guarda en el shipment
   *  vinculado con status='dispatched'. El trigger sync_order_from_shipment
   *  pone la orden en 'shipped' automáticamente. Si no hay shipment (caso
   *  legacy), actualizamos sólo la orden. */
  async function markAsShipped() {
    if (!orderId) return;
    const result = await prompt({
      title: "Marcar orden como enviada",
      description: "Cargá el número de seguimiento para que la clienta pueda rastrear su paquete.",
      tone: "info",
      confirmLabel: "Marcar como enviada",
      fields: [
        { name: "tracking_number", label: "Número de seguimiento", placeholder: "Ej: CA123456789AR", required: true },
        { name: "tracking_provider", label: "Carrier / proveedor", placeholder: "Correo Argentino", defaultValue: "Correo Argentino" },
        { name: "tracking_url", label: "URL de tracking (opcional)", placeholder: "https://www.correoargentino.com.ar/...", type: "url" },
      ],
    });
    if (!result) return;

    setBusy(true);
    try {
      const now = new Date().toISOString();
      const { data: shipment } = await supabase
        .from("shipments")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();
      if (shipment) {
        // El trigger DB se encarga de mover la orden a 'shipped'
        const { error } = await supabase.from("shipments").update({
          status: "dispatched",
          dispatched_at: now,
          tracking_number: result.tracking_number.trim(),
          tracking_provider: (result.tracking_provider || "").trim() || null,
          tracking_url: (result.tracking_url || "").trim() || null,
        }).eq("id", shipment.id);
        if (error) throw error;
      } else {
        // Fallback legacy: orden sin shipment vinculado
        const { error } = await supabase.from("orders").update({
          status: "shipped",
          shipped_at: now,
        }).eq("id", orderId);
        if (error) throw error;
      }
      toast.success("Orden marcada como enviada 🌸");
      await reload();
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error("No se pudo marcar como enviada: " + (e?.message ?? "error"));
    } finally {
      setBusy(false);
    }
  }

  /** Marca como entregada. Actualiza el shipment vinculado primero (trigger
   *  sincroniza la orden), o la orden directo si no hay shipment. */
  async function markAsDelivered() {
    if (!orderId) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const { data: shipment } = await supabase
        .from("shipments")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();
      if (shipment) {
        const { error } = await supabase.from("shipments").update({
          status: "delivered",
          delivered_at: now,
        }).eq("id", shipment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("orders").update({
          status: "delivered",
          delivered_at: now,
        }).eq("id", orderId);
        if (error) throw error;
      }
      toast.success("Orden marcada como entregada 🌸");
      await reload();
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error("No se pudo marcar como entregada: " + (e?.message ?? "error"));
    } finally {
      setBusy(false);
    }
  }

  /** Borra la orden, devuelve el stock al producto/variante (si la orden estuvo
   *  paga) y limpia shipments asociados. Todo en una RPC transaccional. */
  async function deleteOrder() {
    if (!orderId || !order) return;
    const wasPaid = ["paid", "preparing", "shipped", "delivered"].includes(order.status);
    const ok = await confirm({
      title: `Eliminar la orden ${order.order_number}`,
      description: wasPaid
        ? `Se borra la orden, sus productos y el envío asociado.\nEl stock de cada producto vuelve al catálogo.\n\nEsta acción no se puede deshacer.`
        : `Se borra la orden, sus productos y el envío asociado.\n\nEsta acción no se puede deshacer.`,
      confirmLabel: "Sí, eliminar",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_delete_order_with_restock", { p_order_id: orderId });
      if (error) throw error;
      toast.success(wasPaid ? "Orden eliminada y stock restaurado 🌸" : "Orden eliminada");
      router.push("/admin/orders");
    } catch (e: any) {
      toast.error("No se pudo eliminar: " + (e?.message ?? "error"));
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
              <div className="flex justify-between">
                <span>Envío</span>
                <span>
                  {order.shipping_cost > 0
                    ? <>{formatPrice(order.shipping_cost)} <span className="text-xs text-ink-soft">(Correo)</span></>
                    : <span className="text-ink-soft italic">se cotiza aparte</span>}
                </span>
              </div>
              <div className="flex justify-between font-display text-xl pt-2"><span>Total</span><span className="text-rose-deep font-bold">{formatPrice(order.total)}</span></div>
            </div>
          </div>

          {/* Envío elegido en checkout — carrier + CP + zona + costo */}
          {order.wants_shipping !== false && (() => {
            const carrierKey = (order.shipping_address?.carrier_selected ?? "personalizado") as string;
            const correoQuote = order.shipping_address?.correo_quote ?? null;
            const carrierMeta: Record<string, { label: string; emoji: string; tone: string; note: string }> = {
              correo_argentino: {
                label: "Correo Argentino",
                emoji: "📮",
                tone: "bg-success/15 border-success/40 text-success",
                note: "Envío cobrado en el checkout — pagás vos cuando despachás.",
              },
              andreani: {
                label: "Andreani",
                emoji: "📦",
                tone: "bg-warning/15 border-warning/40 text-ink-primary",
                note: "Envío diferido — después de aprobar pago hay que mandarle el link de pago de Andreani.",
              },
              personalizado: {
                label: "Envío personalizado",
                emoji: "🤝",
                tone: "bg-rose-pastel/40 border-rose-medium/40 text-ink-primary",
                note: "Coordinar con la clienta por chat después de aprobar pago.",
              },
            };
            const meta = carrierMeta[carrierKey] ?? carrierMeta.personalizado;
            return (
              <div className="card space-y-3">
                <h2 className="font-display text-xl">Envío elegido por la clienta</h2>
                <div className={`rounded-2xl border-2 p-4 ${meta.tone}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{meta.emoji}</span>
                    <span className="font-display text-2xl font-bold">{meta.label}</span>
                  </div>
                  <p className="text-xs opacity-80">{meta.note}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-rose-whisper p-3">
                    <p className="text-xs text-ink-soft uppercase font-bold tracking-wider">Modalidad</p>
                    <p className="font-semibold text-ink-primary mt-1">
                      {order.destination_type_requested === "sucursal" ? "Retiro en sucursal" : "A domicilio"}
                    </p>
                  </div>
                  {carrierKey === "correo_argentino" && correoQuote ? (
                    <div className="rounded-xl bg-rose-whisper p-3">
                      <p className="text-xs text-ink-soft uppercase font-bold tracking-wider">CP destino</p>
                      <p className="font-semibold text-ink-primary mt-1">{correoQuote.cp ?? "—"} <span className="text-xs text-ink-soft">({correoQuote.zone ?? "?"})</span></p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-rose-whisper p-3">
                      <p className="text-xs text-ink-soft uppercase font-bold tracking-wider">Envío $</p>
                      <p className="font-semibold text-ink-soft italic mt-1">se cotiza aparte</p>
                    </div>
                  )}
                </div>

                {carrierKey === "correo_argentino" && correoQuote && (
                  <div className="rounded-xl bg-success/10 border border-success/30 p-3 text-sm">
                    <p className="text-ink-primary">
                      Envío Correo ya cobrado: <strong className="text-success">{formatPrice(correoQuote.cost ?? 0)}</strong> · Zona <strong>{correoQuote.zone}</strong> · tier hasta <strong>{correoQuote.tier}</strong>
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

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
                <button onClick={markAsShipped} disabled={busy} className="btn-secondary w-full justify-start disabled:opacity-50">
                  <Truck className="w-4 h-4" /> Marcar como enviada
                </button>
              )}
              {order.status === "shipped" && (
                <button onClick={markAsDelivered} disabled={busy} className="btn-primary w-full justify-start disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" /> Marcar como entregada
                </button>
              )}

              <div className="text-xs space-y-1 pt-2 border-t border-rose-pastel">
                <p className="text-ink-soft">
                  Estado: <span className="font-bold text-ink-primary">{getOrderStatusLabel(order.status).label}</span>
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

          {/* Zona peligrosa: eliminar */}
          <div className="card border border-error/30 bg-error/5">
            <h3 className="font-display text-sm text-error mb-1.5">Zona peligrosa</h3>
            <p className="text-xs text-ink-soft mb-3">
              Eliminar la orden borra los productos asociados y el envío vinculado. No se puede deshacer.
            </p>
            <button
              onClick={deleteOrder}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-error text-white text-sm font-semibold hover:bg-error/90 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar orden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
