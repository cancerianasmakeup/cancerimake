"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Truck,
  Printer,
  Package,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Copy,
  AlertCircle,
  MessageCircle,
  Mail,
  HandCoins,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { formatPrice, CARRIER_LABELS, type ShipmentCarrier } from "@cancerianas/shared";
import { useConfirm } from "@/components/ConfirmDialog";

// Labels específicos del admin (más action-oriented que los del cliente).
// Los estados que no figuran caen al helper getShipmentStatusLabel.
const STATUS_META: Record<string, { label: string; color: string; emoji: string }> = {
  pending_address:      { label: "Esperando dirección",            color: "bg-warning/30 text-ink-primary", emoji: "📝" },
  pending_custom_quote: { label: "Cotizar personalizado",          color: "bg-rose-deep text-white animate-soft-pulse", emoji: "🤝" },
  pending_quote:        { label: "Cotizar personalizado",          color: "bg-rose-deep text-white animate-soft-pulse", emoji: "🤝" },
  pending_payment:      { label: "Esperando pago",                 color: "bg-warning/40 text-ink-primary", emoji: "⏳" },
  pending_approval:     { label: "Aprobar comprobante",            color: "bg-rose-deep text-white animate-soft-pulse", emoji: "🔔" },
  paid:                 { label: "Pagado · listo p/ etiqueta",     color: "bg-success/40 text-ink-primary animate-soft-pulse", emoji: "💚" },
  label_generated:      { label: "Etiqueta lista",                 color: "bg-rose-deep text-white", emoji: "🏷️" },
  dispatched:           { label: "Despachado",                     color: "bg-rose-medium text-ink-primary", emoji: "📦" },
  in_transit:           { label: "En tránsito",                    color: "bg-rose-pastel text-ink-primary", emoji: "🚚" },
  out_for_delivery:     { label: "En reparto",                     color: "bg-rose-pastel text-ink-primary", emoji: "🚪" },
  delivered:            { label: "Entregado",                      color: "bg-success/30 text-ink-primary", emoji: "✅" },
  returned:             { label: "Devuelto",                       color: "bg-error/20 text-ink-primary", emoji: "↩️" },
  failed:               { label: "Falló",                          color: "bg-error/30 text-ink-primary", emoji: "⚠️" },
  cancelled:            { label: "Cancelado",                      color: "bg-ink-soft/15 text-ink-soft", emoji: "❌" },
};

export default function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  const supabase = createSupabaseBrowser();
  const confirm = useConfirm();
  const [shipment, setShipment] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [packages, setPackages] = useState<any[]>([]);
  const [proofSignedUrl, setProofSignedUrl] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState({ number: "", provider: "Correo Argentino", url: "" });

  const load = useCallback(async () => {
    const [{ data: s }, { data: ev }, { data: pp }] = await Promise.all([
      supabase
        .from("shipments")
        .select("*, profiles!user_id(full_name, email, phone)")
        .eq("id", shipmentId)
        .single(),
      supabase
        .from("shipment_events")
        .select("*")
        .eq("shipment_id", shipmentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("pending_packages")
        .select("id, description, amount, unit_count, live_event_id, created_at")
        .eq("shipment_id", shipmentId)
        .order("created_at", { ascending: true }),
    ]);
    setShipment(s);
    setEvents(ev ?? []);
    setPackages(pp ?? []);
    setLoading(false);
  }, [shipmentId]);

  // Signed URL del comprobante para preview (si la clienta subió uno)
  useEffect(() => {
    if (!shipment?.payment_proof_url) { setProofSignedUrl(null); return; }
    let cancelled = false;
    supabase.storage
      .from("payment-proofs")
      .createSignedUrl(shipment.payment_proof_url, 60 * 60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.signedUrl) setProofSignedUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [shipment?.payment_proof_url, supabase]);

  // Pre-poblar el campo tracking si admin ya cargó antes
  useEffect(() => {
    if (shipment?.tracking_number) {
      setTrackingInput({
        number: shipment.tracking_number,
        provider: shipment.tracking_provider || "Correo Argentino",
        url: shipment.tracking_url || "",
      });
    }
  }, [shipment?.tracking_number, shipment?.tracking_provider, shipment?.tracking_url]);

  /** Admin aprueba el pago manual del envío (comprobante / WhatsApp): mueve a paid. */
  async function approveShipmentPayment() {
    setBusy("approve-shipment");
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const { error } = await supabase.from("shipments").update({
      status: "paid",
      paid_at: now,
      payment_approved_at: now,
      payment_approved_by: user?.id ?? null,
    }).eq("id", shipmentId);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Pago del envío aprobado 🌸");
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Admin marca el envío como despachado, guardando tracking number genérico. */
  async function markDispatchedWithTracking() {
    if (!trackingInput.number.trim()) {
      toast.error("Cargá el número de seguimiento");
      return;
    }
    setBusy("dispatch");
    const { error } = await supabase.from("shipments").update({
      status: "dispatched",
      dispatched_at: new Date().toISOString(),
      tracking_number: trackingInput.number.trim(),
      tracking_provider: trackingInput.provider.trim() || null,
      tracking_url: trackingInput.url.trim() || null,
    }).eq("id", shipmentId);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Marcaste el envío como despachado 🌸");
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`shipment-${shipmentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shipments", filter: `id=eq.${shipmentId}` },
        load
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shipment_events", filter: `shipment_id=eq.${shipmentId}` },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [shipmentId, load]);

  async function callEdge(action: string, body: any = {}) {
    setBusy(action);
    const { data: session } = await supabase.auth.getSession();
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/andreani?action=${action}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
    setBusy(null);
    return res;
  }

  async function generateLabel() {
    const ok = await confirm({
      title: "¿Generar la etiqueta de Andreani ahora?",
      description: "Esto crea la orden de envío real con el carrier (o mock si no hay credenciales).",
      confirmLabel: "Sí, generar",
      tone: "info",
    });
    if (!ok) return;
    const res = await callEdge("create-shipment", { shipment_id: shipmentId });
    const j = await res.json();
    if (!res.ok) toast.error(j.error || "Error");
    else {
      toast.success(`Etiqueta generada · tracking ${j.tracking}${j.mode === "mock" ? " (modo MOCK)" : ""}`);
      load();
    }
  }

  async function downloadLabel() {
    setBusy("label");
    const { data: session } = await supabase.auth.getSession();
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/andreani?action=label`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ shipment_id: shipmentId }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Error descargando etiqueta");
      return;
    }
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    window.open(downloadUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
  }

  async function pollTracking() {
    const res = await callEdge("track", { shipment_id: shipmentId });
    const j = await res.json();
    if (!res.ok) toast.error(j.error || "Error");
    else {
      toast.success(`Tracking actualizado (${j.eventos?.length || 0} eventos)`);
      load();
    }
  }

  async function markDispatched() {
    const { error } = await supabase
      .from("shipments")
      .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
      .eq("id", shipmentId);
    if (error) toast.error(error.message);
    else {
      toast.success("Marcado como despachado 📦");
    }
  }

  function shareLink() {
    return `${window.location.origin}/shipment/${shipmentId}`;
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink());
    toast.success("Link copiado");
  }

  function shareWhatsApp() {
    const phone = (shipment.profiles?.phone || "").replace(/\D/g, "");
    const name = shipment.profiles?.full_name?.split(" ")[0] || "Hola";
    const msg = encodeURIComponent(
      `${name}! 🌸 Te dejo el link para que cargues tu dirección y completes el envío de Cancerianas:\n\n${shareLink()}\n\nElegís correo (Andreani o Correo Argentino), domicilio o sucursal y pagás. Cualquier duda me decís 💗`
    );
    const url = phone
      ? `https://wa.me/${phone.startsWith("54") ? phone : "54" + phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank");
    toast.success("Abriendo WhatsApp...");
  }

  async function sendEmail() {
    setBusy("email");
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-shipment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({ shipment_id: shipmentId, channel: "email" }),
      }
    );
    setBusy(null);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(j.error || "Error enviando mail");
      return;
    }
    toast.success(j.skipped ? "Email no enviado: " + j.skipped : "📧 Email enviado a la clienta");
  }

  if (loading || !shipment)
    return <div className="text-center py-20 text-ink-soft">Cargando envío...</div>;

  const meta = STATUS_META[shipment.status];
  const dest = shipment.destination_address;
  const branch = shipment.destination_branch;

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/shipments"
        className="inline-flex items-center gap-2 text-ink-soft hover:text-rose-deep mb-4 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a envíos
      </Link>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-ink-primary">
            Envío para {shipment.profiles?.full_name || shipment.profiles?.email}
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            Creado {new Date(shipment.created_at).toLocaleString("es-AR")}
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full font-bold text-xs ${meta.color}`}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      {/* ACTIONS row */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-2">
          {shipment.status === "pending_address" && (
            <>
              <button onClick={shareWhatsApp} className="btn-primary">
                <MessageCircle className="w-4 h-4" /> Mandar por WhatsApp
              </button>
              <button onClick={sendEmail} disabled={busy === "email"} className="btn-secondary text-sm">
                <Mail className="w-4 h-4" /> {busy === "email" ? "Enviando..." : "Enviar email"}
              </button>
              <button onClick={copyLink} className="btn-secondary text-sm">
                <Copy className="w-4 h-4" /> Copiar link
              </button>
            </>
          )}
          {/* Aprobar pago manual del envío */}
          {shipment.status === "pending_approval" && (
            <button onClick={approveShipmentPayment} disabled={busy === "approve-shipment"} className="btn-primary">
              <CheckCircle2 className="w-4 h-4" />
              {busy === "approve-shipment" ? "Aprobando..." : "Aprobar pago del envío"}
            </button>
          )}
          {/* Para carriers con API (andreani/correo) - genera etiqueta */}
          {shipment.status === "paid" && shipment.carrier !== "personalizado" && (
            <button
              onClick={generateLabel}
              disabled={busy === "create-shipment"}
              className="btn-primary"
            >
              <Truck className="w-4 h-4" />
              {busy === "create-shipment"
                ? "Generando..."
                : `Generar etiqueta ${CARRIER_LABELS[shipment.carrier as ShipmentCarrier] ?? "correo"}`}
            </button>
          )}
          {shipment.andreani_remito && (
            <button
              onClick={downloadLabel}
              disabled={busy === "label"}
              className="btn-primary"
            >
              <Printer className="w-4 h-4" />
              {busy === "label" ? "Descargando..." : "Imprimir rótulo"}
            </button>
          )}
          {shipment.status === "label_generated" && (
            <button onClick={markDispatched} className="btn-secondary">
              <Package className="w-4 h-4" /> Marcar despachado
            </button>
          )}
          {(shipment.carrier_tracking_number || shipment.andreani_tracking_number) && (
            <button onClick={pollTracking} disabled={busy === "track"} className="btn-secondary text-sm">
              <RefreshCw className={`w-4 h-4 ${busy === "track" ? "animate-spin" : ""}`} />
              Actualizar tracking
            </button>
          )}
        </div>
      </div>

      {/* CARD: COMPROBANTE DE PAGO DEL ENVÍO */}
      {(shipment.payment_proof_url || shipment.payment_proof_via_whatsapp) && (
        <div className="card mb-4 border-2 border-rose-deep/30 bg-rose-whisper/40">
          <h2 className="font-display text-lg text-ink-primary mb-3">Comprobante de pago del envío</h2>
          {shipment.payment_proof_via_whatsapp && (
            <div className="rounded-2xl bg-success/10 border border-success/30 p-3 flex items-start gap-2 mb-3">
              <MessageCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                La clienta marcó que envía el comprobante por WhatsApp. Verificá en tu chat con la
                referencia <strong>ENVIO-{shipment.id.slice(0, 8).toUpperCase()}</strong>.
              </p>
            </div>
          )}
          {shipment.payment_proof_url && proofSignedUrl && (
            <a href={proofSignedUrl} target="_blank" rel="noopener" className="block rounded-2xl overflow-hidden border border-rose-pastel hover:shadow-lift transition">
              {/\.(jpe?g|png|webp)$/i.test(shipment.payment_proof_url) ? (
                <img src={proofSignedUrl} alt="Comprobante" className="w-full max-h-80 object-contain bg-white" />
              ) : (
                <div className="p-4 text-rose-deep font-semibold flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Ver comprobante (PDF)
                </div>
              )}
            </a>
          )}
          {shipment.payment_proof_at && (
            <p className="text-xs text-ink-soft mt-2">
              Recibido {new Date(shipment.payment_proof_at).toLocaleString("es-AR")}
            </p>
          )}
        </div>
      )}

      {/* CARD: AGREGAR NÚMERO DE SEGUIMIENTO + DESPACHAR */}
      {shipment.status === "paid" && shipment.carrier === "personalizado" && (
        <div className="card mb-4 border-2 border-rose-deep/40 bg-white">
          <h2 className="font-display text-lg text-ink-primary mb-1">Marcar como enviado</h2>
          <p className="text-sm text-ink-soft mb-3">Una vez que lo despachaste, cargá el seguimiento para que la clienta lo siga.</p>
          <div className="grid sm:grid-cols-[1fr_180px] gap-2 mb-2">
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Número de seguimiento</label>
              <input
                value={trackingInput.number}
                onChange={(e) => setTrackingInput({ ...trackingInput, number: e.target.value })}
                placeholder="Ej: CA123456789AR"
                className="input !h-10 !text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Carrier / proveedor</label>
              <input
                value={trackingInput.provider}
                onChange={(e) => setTrackingInput({ ...trackingInput, provider: e.target.value })}
                placeholder="Correo Argentino"
                className="input !h-10 !text-sm"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-ink-soft mb-1">URL de tracking (opcional)</label>
            <input
              value={trackingInput.url}
              onChange={(e) => setTrackingInput({ ...trackingInput, url: e.target.value })}
              placeholder="https://www.correoargentino.com.ar/formularios/oal?..."
              className="input !h-10 !text-sm"
            />
          </div>
          <button onClick={markDispatchedWithTracking} disabled={busy === "dispatch" || !trackingInput.number.trim()} className="btn-primary">
            <Send className="w-4 h-4" />
            {busy === "dispatch" ? "Despachando..." : "Marcar como enviado"}
          </button>
        </div>
      )}

      {/* PAQUETES CONSOLIDADOS */}
      {packages.length > 0 && (
        <div className="card mb-4 bg-rose-whisper/40">
          <h2 className="font-display text-lg text-ink-primary mb-2 flex items-center gap-2">
            <Package className="w-5 h-5 text-rose-deep" />
            Paquetes consolidados ({packages.length})
          </h2>
          <ul className="space-y-1 text-sm">
            {packages.map((p) => (
              <li
                key={p.id}
                className="flex justify-between items-center bg-white rounded-xl p-2.5"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-ink-primary line-clamp-1">
                    {p.description}
                  </span>
                  <span className="text-xs text-ink-soft block">
                    {p.unit_count > 1 && `${p.unit_count} u · `}
                    {new Date(p.created_at).toLocaleDateString("es-AR")}
                  </span>
                </div>
                <span className="font-bold text-rose-deep">{formatPrice(Number(p.amount))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* LEFT: detail */}
        <div className="lg:col-span-2 space-y-4">
          {shipment.status === "pending_custom_quote" && (
            <CustomQuotePanel shipment={shipment} onSaved={load} />
          )}

          <div className="card">
            <h2 className="font-display text-lg text-ink-primary mb-3">Paquete</h2>
            <p className="text-sm text-ink-secondary mb-3">{shipment.description}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <KV label="Peso" value={`${(shipment.weight_grams / 1000).toFixed(2)} kg`} />
              <KV label="Largo" value={shipment.length_cm ? `${shipment.length_cm} cm` : "—"} />
              <KV label="Ancho" value={shipment.width_cm ? `${shipment.width_cm} cm` : "—"} />
              <KV label="Alto" value={shipment.height_cm ? `${shipment.height_cm} cm` : "—"} />
              <KV
                label="Valor declarado"
                value={shipment.declared_value ? formatPrice(Number(shipment.declared_value)) : "—"}
              />
              <KV
                label="Cotizado"
                value={shipment.cost_quoted ? formatPrice(Number(shipment.cost_quoted)) : "—"}
              />
              <KV
                label="Cobrado"
                value={
                  shipment.cost_charged ? (
                    <span className="text-rose-deep font-bold">
                      {formatPrice(Number(shipment.cost_charged))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <KV
                label="Pagado"
                value={shipment.paid_at ? new Date(shipment.paid_at).toLocaleString("es-AR") : "—"}
              />
            </div>
            {shipment.internal_notes && (
              <p className="text-xs italic text-ink-soft mt-3 bg-rose-whisper/60 px-3 py-2 rounded-xl">
                📝 {shipment.internal_notes}
              </p>
            )}
          </div>

          {/* Destino */}
          <div className="card">
            <h2 className="font-display text-lg text-ink-primary mb-3">Destino</h2>
            {!shipment.destination_type ? (
              <div className="bg-warning/15 rounded-xl p-3 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-sm text-ink-secondary">
                  La clienta todavía no completó su dirección. Mandale el link copiando arriba.
                </p>
              </div>
            ) : shipment.destination_type === "sucursal" ? (
              <div className="space-y-3">
                <p className="text-xs uppercase font-bold text-ink-soft tracking-wider">
                  📍 Retira en sucursal
                </p>

                {/* Sucursal elegida */}
                <div>
                  <p className="font-semibold text-ink-primary">{branch?.nombre || branch?.name || "—"}</p>
                  {(branch?.direccion || branch?.address) && (
                    <p className="text-sm text-ink-secondary">{branch?.direccion || branch?.address}</p>
                  )}
                  {(branch?.lat && branch?.lng) && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${branch.lat},${branch.lng}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-xs text-rose-deep hover:underline mt-1 font-semibold"
                    >
                      Ver en mapa →
                    </a>
                  )}
                  {branch?.operator && (
                    <p className="text-xs text-ink-soft mt-1 uppercase tracking-wide font-semibold">{branch.operator}</p>
                  )}
                </div>

                {/* Ubicación (CP / localidad / provincia) — del branch o del form */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-rose-pastel">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-ink-soft tracking-wider">Provincia</p>
                    <p className="text-sm font-semibold text-ink-primary mt-0.5">
                      {branch?.region || branch?.provincia || dest?.region || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-ink-soft tracking-wider">Localidad</p>
                    <p className="text-sm font-semibold text-ink-primary mt-0.5">
                      {branch?.localidad || dest?.localidad || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-ink-soft tracking-wider">CP</p>
                    <p className="text-sm font-semibold text-ink-primary mt-0.5">
                      {branch?.codigoPostal || dest?.codigoPostal || "—"}
                    </p>
                  </div>
                </div>

                {/* Contacto de la clienta */}
                {(dest?.nombre_completo || dest?.telefono || dest?.documento) && (
                  <div className="pt-2 border-t border-rose-pastel">
                    {dest?.nombre_completo && (
                      <p className="text-sm font-semibold text-ink-primary">{dest.nombre_completo}</p>
                    )}
                    <p className="text-sm text-ink-secondary">
                      {dest?.telefono && <>📱 {dest.telefono}</>}
                      {dest?.telefono && dest?.documento && " · "}
                      {dest?.documento && <>DNI {dest.documento}</>}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs uppercase font-bold text-ink-soft tracking-wider">
                  🏠 Envío a domicilio
                </p>

                <div>
                  <p className="font-semibold text-ink-primary">{dest?.nombre_completo}</p>
                  <p className="text-sm text-ink-secondary">
                    {dest?.calle} {dest?.numero}
                    {dest?.piso ? `, Piso ${dest.piso}` : ""}
                    {dest?.depto ? ` Depto ${dest.depto}` : ""}
                  </p>
                  {dest?.entre_calles && (
                    <p className="text-sm text-ink-secondary">
                      Entre calles: <span className="font-medium">{dest.entre_calles}</span>
                    </p>
                  )}
                  {dest?.referencias && (
                    <p className="text-xs text-ink-soft mt-1 italic">📍 {dest.referencias}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-rose-pastel">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-ink-soft tracking-wider">Provincia</p>
                    <p className="text-sm font-semibold text-ink-primary mt-0.5">{dest?.region || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-ink-soft tracking-wider">Localidad</p>
                    <p className="text-sm font-semibold text-ink-primary mt-0.5">{dest?.localidad || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-ink-soft tracking-wider">CP</p>
                    <p className="text-sm font-semibold text-ink-primary mt-0.5">{dest?.codigoPostal || "—"}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-rose-pastel">
                  <p className="text-sm text-ink-secondary">
                    📱 {dest?.telefono} · DNI {dest?.documento}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Carrier info */}
          {(shipment.carrier_tracking_number || shipment.andreani_tracking_number) && (
            <div className="card bg-rose-whisper/40 border border-rose-medium/30">
              <h2 className="font-display text-lg text-ink-primary mb-3">
                📦 {CARRIER_LABELS[(shipment.carrier as ShipmentCarrier) ?? "andreani"]}
              </h2>
              <div className="space-y-1 text-sm">
                <KV
                  label="Tracking"
                  value={
                    <span className="font-mono">
                      {shipment.carrier_tracking_number || shipment.andreani_tracking_number}
                    </span>
                  }
                />
                <KV
                  label="Remito"
                  value={
                    <span className="font-mono">
                      {shipment.carrier_remito || shipment.andreani_remito}
                    </span>
                  }
                />
                <KV
                  label="Entrega estimada"
                  value={
                    (shipment.carrier_estimated_delivery || shipment.andreani_estimated_delivery)
                      ? new Date(
                          shipment.carrier_estimated_delivery || shipment.andreani_estimated_delivery
                        ).toLocaleDateString("es-AR")
                      : "—"
                  }
                />
                <KV
                  label="Último estado"
                  value={shipment.carrier_last_status || shipment.andreani_last_status || "—"}
                />
                <KV
                  label="Último polling"
                  value={
                    (shipment.carrier_last_polled_at || shipment.andreani_last_polled_at)
                      ? new Date(
                          shipment.carrier_last_polled_at || shipment.andreani_last_polled_at
                        ).toLocaleString("es-AR")
                      : "—"
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: timeline */}
        <div>
          <div className="card">
            <h2 className="font-display text-lg text-ink-primary mb-3">Timeline</h2>
            {events.length === 0 ? (
              <p className="text-ink-soft text-sm text-center py-6">Sin eventos todavía</p>
            ) : (
              <div className="space-y-3">
                {events.map((e) => {
                  const m = STATUS_META[e.status];
                  return (
                    <div key={e.id} className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-rose-deep text-white flex items-center justify-center text-xs">
                          {m?.emoji ?? "•"}
                        </div>
                        <div className="w-0.5 flex-1 bg-rose-pastel" />
                      </div>
                      <div className="flex-1 pb-3 border-b border-rose-pastel/40 last:border-0">
                        <p className="text-xs font-semibold text-ink-primary">
                          {m?.label ?? e.status}
                        </p>
                        <p className="text-[10px] uppercase text-ink-soft mt-0.5">
                          {e.source} · {new Date(e.created_at).toLocaleString("es-AR")}
                        </p>
                        {e.message && (
                          <p className="text-xs text-ink-secondary mt-1">{e.message}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold text-ink-soft tracking-wider">{label}</div>
      <div className="text-sm text-ink-primary">{value}</div>
    </div>
  );
}

const QUICK_PRICES = [1500, 2500, 3500, 5000, 8000, 12000, 15000, 20000];

function CustomQuotePanel({
  shipment,
  onSaved,
}: {
  shipment: any;
  onSaved: () => void;
}) {
  const supabase = createSupabaseBrowser();
  const [amount, setAmount] = useState<string>(
    shipment.custom_quote_amount ? String(shipment.custom_quote_amount) : ""
  );
  const [message, setMessage] = useState<string>(shipment.custom_quote_message ?? "");
  const [busy, setBusy] = useState(false);
  const [notifying, setNotifying] = useState(false);

  async function save(notify: boolean) {
    const num = Number(amount);
    if (!num || num <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_custom_quote", {
      p_shipment_id: shipment.id,
      p_amount: num,
      p_message: message || null,
    });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cotización guardada — la clienta ya puede pagar");

    if (notify) {
      setNotifying(true);
      try {
        await supabase.functions.invoke("notify-custom-quote", {
          body: { shipmentId: shipment.id },
        });
        toast.success("Aviso enviado por mail/WhatsApp");
      } catch (e: any) {
        toast.error("Cotización guardada, pero falló el aviso: " + (e?.message ?? e));
      }
      setNotifying(false);
    }

    onSaved();
  }

  return (
    <div className="card border-2 border-rose-deep bg-gradient-to-br from-white via-rose-whisper to-rose-pastel/40">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-rose-deep text-white flex items-center justify-center flex-shrink-0">
          <HandCoins className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-xl text-ink-primary">Cotizar envío personalizado</h2>
          <p className="text-sm text-ink-secondary">
            La clienta está esperando que le pases el precio. Coordiná por WhatsApp y cargá el monto acá.
          </p>
        </div>
      </div>

      {shipment.custom_quote_message && (
        <div className="bg-white rounded-2xl p-3 mb-4">
          <p className="text-xs uppercase font-bold text-ink-soft tracking-wider mb-1">
            Mensaje de la clienta
          </p>
          <p className="text-sm text-ink-primary italic">"{shipment.custom_quote_message}"</p>
        </div>
      )}

      <div className="mb-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-2">
          Monto a cobrar
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft font-bold">$</span>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="input pl-8 text-2xl font-bold text-rose-deep"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {QUICK_PRICES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(String(p))}
              className="text-xs px-3 py-1 rounded-full bg-rose-pastel/70 hover:bg-rose-pastel text-rose-deep font-semibold"
            >
              ${(p / 1000).toLocaleString("es-AR")}k
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
          Mensaje para la clienta (opcional)
        </label>
        <textarea
          rows={3}
          className="input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ej: Te lo mando por motoboy hoy a la tarde, quedan los $3.500. Cualquier cosa avisame por WhatsApp."
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy || notifying}
          className="btn-primary flex-1"
        >
          <Send className="w-4 h-4" />
          {busy ? "Guardando..." : notifying ? "Enviando aviso..." : "Guardar y avisar a la clienta"}
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy || notifying}
          className="btn-secondary text-sm"
        >
          Solo guardar
        </button>
      </div>
    </div>
  );
}
