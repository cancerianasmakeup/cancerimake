"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Home,
  MapPin,
  Truck,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Sparkles,
  HandCoins,
  Clock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { formatPrice, CARRIER_LABELS, type ShipmentCarrier } from "@cancerianas/shared";
import TransferInstructions from "@/components/TransferInstructions";
import PaymentProofUploader from "@/components/PaymentProofUploader";
import BranchPicker, { type PickedBranch } from "@/components/BranchPicker";
import { getShipmentStatusLabel } from "@/lib/shipment-status";

type Step = "auth-check" | "carrier" | "method" | "address" | "branch" | "custom-request" | "custom-waiting" | "confirm" | "paying" | "done";

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

// Mock branches por CP — cuando Andreani API esté conectada esto se reemplaza por fetch
const MOCK_BRANCHES_BY_CP_PREFIX: Record<string, any[]> = {
  "14": [
    { id: "MORENO_001", nombre: "Andreani Sucursal Moreno", direccion: "Av. Victorica 234", localidad: "Moreno", region: "Buenos Aires", codigoPostal: "1744" },
    { id: "MERLO_001", nombre: "Andreani Sucursal Merlo", direccion: "Av. del Libertador 1234", localidad: "Merlo", region: "Buenos Aires", codigoPostal: "1722" },
  ],
  "10": [
    { id: "CABA_CENTRO", nombre: "Andreani CABA Centro", direccion: "Av. Corrientes 1500", localidad: "CABA", region: "CABA", codigoPostal: "1042" },
    { id: "CABA_BELGRANO", nombre: "Andreani Belgrano", direccion: "Av. Cabildo 2200", localidad: "CABA", region: "CABA", codigoPostal: "1428" },
  ],
  "50": [
    { id: "CBA_CENTRO", nombre: "Andreani Córdoba Centro", direccion: "27 de Abril 234", localidad: "Córdoba", region: "Córdoba", codigoPostal: "5000" },
  ],
  "20": [
    { id: "ROS_CENTRO", nombre: "Andreani Rosario Centro", direccion: "Av. Pellegrini 100", localidad: "Rosario", region: "Santa Fe", codigoPostal: "2000" },
  ],
};

function getBranchesForCP(cp: string) {
  if (!cp || cp.length < 2) return [];
  const prefix = cp.slice(0, 2);
  return MOCK_BRANCHES_BY_CP_PREFIX[prefix] ?? [];
}

export default function ShipmentWizard({ shipmentId }: { shipmentId: string }) {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shipment, setShipment] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [step, setStep] = useState<Step>("auth-check");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form state
  const [destinationType, setDestinationType] = useState<"domicilio" | "sucursal" | null>(null);
  const [address, setAddress] = useState({
    nombre_completo: "",
    documento: "",
    telefono: "",
    codigoPostal: "",
    calle: "",
    numero: "",
    piso: "",
    depto: "",
    localidad: "",
    region: "Buenos Aires",
    referencias: "",
  });
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [extras, setExtras] = useState<any>({});
  const [paymentMethods, setPaymentMethods] = useState<any>({});
  const [brand, setBrand] = useState<{ whatsapp?: string }>({});
  const [carrier, setCarrier] = useState<ShipmentCarrier>("andreani");
  const [customMessage, setCustomMessage] = useState("");
  // Cotizaciones por carrier (Andreani + Correo en paralelo)
  type QuoteData = { cost_quoted: number; cost_charged: number; mode: string; carrier: ShipmentCarrier };
  const [quotes, setQuotes] = useState<{ andreani: QuoteData | null; correo_argentino: QuoteData | null }>({
    andreani: null,
    correo_argentino: null,
  });
  // Cotización efectiva (la del carrier elegido por la clienta)
  const quote: QuoteData | null =
    carrier === "personalizado" ? null : quotes[carrier as "andreani" | "correo_argentino"];

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/auth?redirect=/shipment/${shipmentId}`);
      return;
    }
    const [{ data: s }, { data: p }, { data: settingsRows }] = await Promise.all([
      supabase.from("shipments").select("*").eq("id", shipmentId).single(),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("site_settings").select("key, value").in("key", ["shipping_extras", "payment_methods", "brand_info"]),
    ]);
    const settingsMap: Record<string, any> = {};
    (settingsRows ?? []).forEach((r: any) => { settingsMap[r.key] = r.value; });
    const ext = { value: settingsMap.shipping_extras ?? {} };
    setPaymentMethods(settingsMap.payment_methods ?? {});
    setBrand(settingsMap.brand_info ?? {});
    if (!s) {
      toast.error("Envío no encontrado o no es tuyo");
      router.push("/account");
      return;
    }
    setShipment(s);
    setProfile(p);
    setExtras(ext?.value ?? {});
    if (s.carrier) setCarrier(s.carrier as ShipmentCarrier);
    if (s.destination_branch) setSelectedBranch(s.destination_branch);
    if (s.destination_address) {
      setAddress((prev) => ({ ...prev, ...(s.destination_address as Record<string, any>) }));
    }

    // Pre-llenar el form con datos del profile
    setAddress((prev) => ({
      ...prev,
      nombre_completo: prev.nombre_completo || p?.full_name || "",
      telefono: prev.telefono || p?.phone || "",
    }));

    // Status-driven step. Si el carrier ya está marcado como 'personalizado'
    // (el caso cuando admin aprobó la orden y creó el shipment manual), saltamos
    // la pantalla de "elegí carrier" e ir directo al form simple.
    if (s.status === "pending_address") {
      if (s.carrier === "personalizado") {
        // Inicializar el tipo de destino que ya eligió en checkout
        if (s.destination_type) setDestinationType(s.destination_type);
        setStep("custom-request");
      } else {
        setStep("carrier");
      }
    }
    else if (s.status === "pending_custom_quote" || s.status === "pending_quote") setStep("custom-waiting");
    else if (s.status === "pending_payment" || s.status === "pending_approval") setStep("confirm");
    else if (s.status === "paid" || s.status === "label_generated" || ["dispatched", "in_transit", "out_for_delivery", "delivered"].includes(s.status)) setStep("done");
    else setStep("done");

    // Si volvió de MP success
    if (searchParams.get("status") === "success") {
      toast.success("Pago recibido — preparamos tu paquete 🌸");
      setStep("done");
    }

    setLoading(false);
  }, [shipmentId, router, searchParams]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`ship-wizard-${shipmentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments", filter: `id=eq.${shipmentId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shipmentId, load]);

  /**
   * Cotiza Andreani y Correo Argentino en paralelo. Las clientas comparan ambas
   * y eligen la que les conviene.
   */
  async function fetchAllQuotes(cp: string, type: "domicilio" | "sucursal") {
    if (!cp || cp.length !== 4) return;
    setBusy(true);
    const { data: session } = await supabase.auth.getSession();
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/andreani?action=quote`;
    const auth = `Bearer ${session.session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`;
    const bultos = [{
      kilos: shipment.weight_grams / 1000,
      volumen: ((shipment.length_cm || 25) * (shipment.width_cm || 20) * (shipment.height_cm || 10)) / 1000,
      length_cm: shipment.length_cm || 25,
      width_cm: shipment.width_cm || 20,
      height_cm: shipment.height_cm || 10,
      valorDeclarado: Number(shipment.declared_value || 0),
    }];

    const carriers: ("andreani" | "correo_argentino")[] = ["andreani", "correo_argentino"];

    try {
      const results = await Promise.all(
        carriers.map(async (c) => {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: auth },
              body: JSON.stringify({ carrier: c, cpDestino: cp, destinationType: type, bultos }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error);
            return [c, j as QuoteData] as const;
          } catch (e) {
            console.warn(`[wizard] cotización ${c} falló:`, e);
            return [c, null] as const;
          }
        })
      );
      const next = { andreani: null as QuoteData | null, correo_argentino: null as QuoteData | null };
      for (const [c, q] of results) next[c] = q;
      setQuotes(next);

      const failed = results.filter(([, q]) => !q).map(([c]) => CARRIER_LABELS[c]);
      if (failed.length === results.length) {
        toast.error("No pudimos cotizar con ningún carrier. Probá con personalizado o reintentá.");
      } else if (failed.length > 0) {
        toast.warning(`No pudimos cotizar con ${failed.join(", ")}. La otra opción está disponible.`);
      }
    } finally {
      setBusy(false);
    }
  }

  /** Cuando la clienta elige una de las dos cotizaciones, persistimos el carrier. */
  async function chooseQuote(c: "andreani" | "correo_argentino") {
    setCarrier(c);
    if (shipment?.carrier !== c) {
      await supabase.from("shipments").update({ carrier: c }).eq("id", shipmentId);
    }
  }

  /** Persiste un carrier puntual (usado en step `carrier` cuando arrancó eligiendo personalizado). */
  async function persistCarrier(c: ShipmentCarrier) {
    setCarrier(c);
    setQuotes({ andreani: null, correo_argentino: null });
    if (shipment?.carrier !== c) {
      await supabase.from("shipments").update({ carrier: c }).eq("id", shipmentId);
    }
  }

  async function submitAddress() {
    if (!shipment) return;
    if (destinationType === "domicilio") {
      if (!address.nombre_completo.trim()) return toast.error("Falta nombre completo");
      if (!address.documento.trim()) return toast.error("Falta DNI");
      if (!address.telefono.trim()) return toast.error("Falta teléfono");
      if (address.codigoPostal.length !== 4) return toast.error("CP inválido (4 dígitos)");
      if (!address.calle.trim() || !address.numero.trim()) return toast.error("Falta calle/número");
      if (!address.localidad.trim()) return toast.error("Falta localidad");
    } else if (destinationType === "sucursal") {
      if (!selectedBranch) return toast.error("Elegí una sucursal");
      if (!address.nombre_completo.trim() || !address.documento.trim() || !address.telefono.trim()) {
        return toast.error("Completá nombre, DNI y teléfono");
      }
    }
    if (!quote) return toast.error("Esperá a que se cotice el envío");

    setBusy(true);
    const { error } = await supabase.rpc("customer_set_shipment_address", {
      p_shipment_id: shipmentId,
      p_destination_type: destinationType,
      p_destination_address: destinationType === "domicilio" ? address : { nombre_completo: address.nombre_completo, documento: address.documento, telefono: address.telefono },
      p_destination_branch: destinationType === "sucursal" ? selectedBranch : null,
      p_cost_quoted: quote.cost_quoted,
      p_cost_charged: quote.cost_charged,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep("confirm");
  }

  async function requestCustomQuote() {
    if (!shipment) return;
    // Validación común
    if (!address.nombre_completo.trim()) return toast.error("Falta nombre completo");
    if (!address.documento.trim()) return toast.error("Falta DNI");
    if (!address.telefono.trim()) return toast.error("Falta teléfono / WhatsApp");
    if (address.codigoPostal.length !== 4) return toast.error("CP inválido (4 dígitos)");

    // Validación específica
    if (destinationType === "domicilio") {
      if (!address.calle.trim() || !address.numero.trim()) return toast.error("Falta calle/número");
      if (!address.localidad.trim()) return toast.error("Falta localidad");
    } else if (destinationType === "sucursal") {
      if (!address.localidad.trim()) return toast.error("Falta tu localidad — así te recomendamos la sucursal más cerca");
    }

    setBusy(true);
    // Hacemos update directo (no RPC) para incluir destination_type y branch si aplica.
    // RLS permite update mientras status sea pending_address (USING se evalúa antes del cambio).
    const updates: Record<string, any> = {
      status: "pending_custom_quote",
      carrier: "personalizado",
      destination_type: destinationType,
      destination_address: address,
      custom_quote_message: customMessage || null,
    };
    // Si eligió sucursal y picó una específica, la guardamos como snapshot
    if (destinationType === "sucursal" && selectedBranch) {
      updates.destination_branch = selectedBranch;
    }
    const { error } = await supabase
      .from("shipments")
      .update(updates)
      .eq("id", shipmentId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Listo, te avisamos cuando tengamos el precio del envío 🌸");
    setStep("custom-waiting");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function payNow() {
    setBusy(true);
    setStep("paying");
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-preference`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({ type: "shipment", id: shipmentId }),
      }
    );
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(j.error || "Error iniciando el pago");
      setStep("confirm");
      return;
    }
    window.location.href = j.init_point;
  }

  if (loading)
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-rose-deep" />
        <p className="text-ink-soft mt-3">Cargando tu envío...</p>
      </div>
    );

  return (
    <section className="max-w-2xl mx-auto px-4 py-8">
      {/* HEADER */}
      <div className="card mb-4">
        <p className="text-xs uppercase font-bold text-ink-soft tracking-wider mb-1">
          📦 Tu envío
        </p>
        <h1 className="font-display text-2xl text-ink-primary">{shipment.description}</h1>
        <p className="text-sm text-ink-soft mt-1">
          Peso: {(shipment.weight_grams / 1000).toFixed(2)}kg
          {shipment.declared_value > 0 && ` · Valor: ${formatPrice(Number(shipment.declared_value))}`}
        </p>
      </div>

      {/* PROGRESS dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {(["carrier", "method", "address", "confirm", "done"] as Step[]).map((s, i) => {
          // mapeo aplanado: address/branch → 2, paying → 3
          const order = ["carrier", "method", "address", "confirm", "done"];
          const flatten: Record<Step, number> = {
            "auth-check": 0,
            carrier: 0,
            method: 1,
            address: 2,
            branch: 2,
            "custom-request": 2,
            "custom-waiting": 2.5, // entre address y confirm
            confirm: 3,
            paying: 3,
            done: 4,
          };
          const adjusted = flatten[step];
          const targetIdx = order.indexOf(s);
          const active = adjusted === targetIdx;
          const done = adjusted > targetIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  done
                    ? "bg-success text-white"
                    : active
                    ? "bg-rose-deep text-white scale-110"
                    : "bg-rose-pastel text-ink-soft"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              {i < 4 && <div className={`w-6 h-0.5 ${done ? "bg-success" : "bg-rose-pastel"}`} />}
            </div>
          );
        })}
      </div>

      {/* STEPS */}
      {step === "carrier" && (
        <div className="space-y-3">
          <h2 className="font-display text-2xl text-ink-primary text-center mb-2">
            Elegí cómo querés que te llegue ✨
          </h2>
          <p className="text-center text-sm text-ink-soft mb-4">
            Comparamos los carriers en vivo. Si querés algo distinto, pedime un envío personalizado.
          </p>

          <button
            onClick={async () => {
              // Default Andreani; cuando llegue la cotización dual, la clienta elige
              if (carrier === "personalizado") await persistCarrier("andreani");
              setStep("method");
            }}
            className={`card w-full text-left transition flex items-center gap-4 ${
              carrier !== "personalizado" ? "ring-2 ring-rose-deep bg-rose-whisper" : "hover:shadow-soft"
            }`}
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                carrier !== "personalizado" ? "bg-rose-deep text-white" : "bg-rose-pastel"
              }`}
            >
              📦
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-ink-primary">Comparar Andreani vs Correo Argentino</h3>
              <p className="text-sm text-ink-soft">
                Te muestro los dos precios cuando cargues el CP y elegís el que te conviene.
              </p>
            </div>
            {carrier !== "personalizado" && <CheckCircle2 className="w-6 h-6 text-rose-deep" />}
          </button>

          <button
            onClick={async () => {
              await persistCarrier("personalizado");
              setStep("custom-request");
            }}
            className={`card w-full text-left transition flex items-center gap-4 ${
              carrier === "personalizado" ? "ring-2 ring-rose-deep bg-rose-whisper" : "hover:shadow-soft"
            }`}
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                carrier === "personalizado" ? "bg-rose-deep text-white" : "bg-rose-pastel"
              }`}
            >
              🤝
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-ink-primary">Envío personalizado</h3>
              <p className="text-sm text-ink-soft">
                Coordinamos por WhatsApp: motoboy, retiro, encomienda especial, transferencia, etc.
              </p>
            </div>
            {carrier === "personalizado" && <CheckCircle2 className="w-6 h-6 text-rose-deep" />}
          </button>
        </div>
      )}

      {step === "method" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setStep("carrier")} className="text-rose-deep">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <p className="text-xs uppercase font-bold text-ink-soft tracking-wider">
              📦 {CARRIER_LABELS[carrier]}
            </p>
            <span className="w-5" />
          </div>
          <h2 className="font-display text-2xl text-ink-primary text-center mb-2">
            ¿Cómo querés recibirlo? 💗
          </h2>
          <button
            onClick={() => {
              setDestinationType("domicilio");
              setStep("address");
            }}
            className="card w-full text-left hover:shadow-lift transition-all hover:-translate-y-0.5 flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-pastel flex items-center justify-center">
              <Home className="w-7 h-7 text-rose-deep" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-ink-primary">A mi domicilio</h3>
              <p className="text-sm text-ink-soft">Lo dejo en la dirección que indique</p>
            </div>
            <ArrowRight className="w-5 h-5 text-rose-deep" />
          </button>

          <button
            onClick={() => {
              setDestinationType("sucursal");
              setStep("branch");
            }}
            className="card w-full text-left hover:shadow-lift transition-all hover:-translate-y-0.5 flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-pastel flex items-center justify-center">
              <MapPin className="w-7 h-7 text-rose-deep" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-ink-primary">Lo retiro en una sucursal</h3>
              <p className="text-sm text-ink-soft">Suele ser más barato y flexible</p>
            </div>
            <ArrowRight className="w-5 h-5 text-rose-deep" />
          </button>
        </div>
      )}

      {step === "address" && destinationType === "domicilio" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setStep("method")} className="text-rose-deep">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="font-display text-2xl text-ink-primary">¿A dónde te lo mandamos?</h2>
          </div>

          <Field label="Nombre completo *" value={address.nombre_completo} onChange={(v) => setAddress({ ...address, nombre_completo: v })} placeholder="Como figura en el DNI" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="DNI *" value={address.documento} onChange={(v) => setAddress({ ...address, documento: v.replace(/\D/g, "") })} placeholder="40123456" />
            <Field label="Teléfono *" value={address.telefono} onChange={(v) => setAddress({ ...address, telefono: v })} placeholder="+5491141..." />
          </div>

          <Field
            label="Código postal * (4 dígitos)"
            value={address.codigoPostal}
            onChange={(v) => {
              const cp = v.replace(/\D/g, "").slice(0, 4);
              setAddress({ ...address, codigoPostal: cp });
              if (cp.length === 4) fetchAllQuotes(cp, "domicilio");
            }}
            placeholder="1414"
          />

          <Field label="Calle *" value={address.calle} onChange={(v) => setAddress({ ...address, calle: v })} placeholder="Av. Corrientes" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Número *" value={address.numero} onChange={(v) => setAddress({ ...address, numero: v })} placeholder="1234" />
            <Field label="Piso" value={address.piso} onChange={(v) => setAddress({ ...address, piso: v })} placeholder="3" />
            <Field label="Depto" value={address.depto} onChange={(v) => setAddress({ ...address, depto: v })} placeholder="B" />
          </div>

          <Field label="Localidad *" value={address.localidad} onChange={(v) => setAddress({ ...address, localidad: v })} placeholder="CABA" />
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Provincia *</label>
            <select
              value={address.region}
              onChange={(e) => setAddress({ ...address, region: e.target.value })}
              className="input"
            >
              {PROVINCIAS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>

          <Field label="Referencias (opcional)" value={address.referencias} onChange={(v) => setAddress({ ...address, referencias: v })} placeholder="Casa con portón verde, timbre 'Cancerianas'" />

          {/* COTIZACIÓN DUAL */}
          {address.codigoPostal.length === 4 && (
            <DualQuoteSelector
              quotes={quotes}
              selected={carrier as "andreani" | "correo_argentino"}
              busy={busy}
              extrasNote={extras.note_for_customer}
              onSelect={chooseQuote}
              onRetry={() => fetchAllQuotes(address.codigoPostal, "domicilio")}
            />
          )}

          <button
            onClick={submitAddress}
            disabled={busy || !quote}
            className="btn-primary w-full"
          >
            Continuar a confirmación <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === "custom-request" && (
        <div className="space-y-4">
          <div className="mb-2">
            <h2 className="font-display text-2xl text-ink-primary">
              {destinationType === "sucursal" ? "Tus datos para retirar 📍" : "¿A dónde te lo mandamos? 🏠"}
            </h2>
            <p className="text-sm text-ink-soft mt-1">
              Completá tus datos. Cuando los recibamos te avisamos cuánto sale tu envío para que lo pagues.
            </p>
          </div>

          {/* Toggle para cambiar domicilio/sucursal sobre la marcha */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDestinationType("domicilio")}
              className={`p-3 rounded-2xl border-2 text-sm font-semibold transition ${
                destinationType === "domicilio"
                  ? "border-rose-deep bg-rose-whisper text-rose-deep"
                  : "border-rose-pastel text-ink-soft hover:border-rose-medium/50"
              }`}
            >
              <Home className="w-4 h-4 inline mr-1" /> Envío a domicilio
            </button>
            <button
              type="button"
              onClick={() => setDestinationType("sucursal")}
              className={`p-3 rounded-2xl border-2 text-sm font-semibold transition ${
                destinationType === "sucursal"
                  ? "border-rose-deep bg-rose-whisper text-rose-deep"
                  : "border-rose-pastel text-ink-soft hover:border-rose-medium/50"
              }`}
            >
              <MapPin className="w-4 h-4 inline mr-1" /> Retiro en sucursal
            </button>
          </div>

          <Field label="Nombre completo *" value={address.nombre_completo} onChange={(v) => setAddress({ ...address, nombre_completo: v })} placeholder="Como figura en el DNI" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="DNI *" value={address.documento} onChange={(v) => setAddress({ ...address, documento: v.replace(/\D/g, "") })} placeholder="40123456" />
            <Field label="WhatsApp *" value={address.telefono} onChange={(v) => setAddress({ ...address, telefono: v })} placeholder="+5491141..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CP *" value={address.codigoPostal} onChange={(v) => setAddress({ ...address, codigoPostal: v.replace(/\D/g, "").slice(0, 4) })} placeholder="1414" />
            <Field label="Localidad *" value={address.localidad} onChange={(v) => setAddress({ ...address, localidad: v })} placeholder="CABA" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Provincia *</label>
            <select
              value={address.region}
              onChange={(e) => setAddress({ ...address, region: e.target.value })}
              className="input"
            >
              {PROVINCIAS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>

          {destinationType === "domicilio" && (
            <>
              <Field label="Calle *" value={address.calle} onChange={(v) => setAddress({ ...address, calle: v })} placeholder="Av. Corrientes" />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Número *" value={address.numero} onChange={(v) => setAddress({ ...address, numero: v })} placeholder="1234" />
                <Field label="Piso" value={address.piso} onChange={(v) => setAddress({ ...address, piso: v })} placeholder="3" />
                <Field label="Depto" value={address.depto} onChange={(v) => setAddress({ ...address, depto: v })} placeholder="B" />
              </div>
              <Field label="Referencias (opcional)" value={address.referencias} onChange={(v) => setAddress({ ...address, referencias: v })} placeholder="Casa con portón verde, timbre 'Cancerianas'" />
            </>
          )}

          {destinationType === "sucursal" && (
            <BranchPicker
              selected={selectedBranch as PickedBranch | null}
              onSelect={(b) => setSelectedBranch(b)}
            />
          )}

          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-1.5">
              Mensaje para la marca (opcional)
            </label>
            <textarea
              rows={3}
              className="input"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={
                destinationType === "sucursal"
                  ? "Ej: Prefiero retirar en la sucursal de Av. Mosconi. Cualquier cosa, me decís."
                  : "Ej: Tocá timbre 'A', soy de Mendoza centro, etc."
              }
            />
          </div>

          <button onClick={requestCustomQuote} disabled={busy} className="btn-primary w-full">
            <HandCoins className="w-5 h-5" />
            {busy ? "Enviando..." : "Enviar mis datos"}
          </button>
        </div>
      )}

      {step === "custom-waiting" && (
        <div className="card text-center py-12 bg-gradient-to-br from-rose-whisper to-rose-pastel">
          <Clock className="w-12 h-12 mx-auto text-rose-deep animate-pulse" />
          <h2 className="font-display text-2xl text-ink-primary mt-3">
            Esperando tu cotización personalizada
          </h2>
          <p className="text-ink-secondary mt-2 px-2">
            Ya recibimos tu solicitud. Te aviso por WhatsApp cuando tenga el precio. Apenas lo
            cargue, esta misma página se actualiza con el monto y el botón de pagar.
          </p>
          {shipment.custom_quote_message && (
            <div className="mt-5 mx-auto max-w-sm bg-white rounded-2xl p-4 text-left">
              <p className="text-xs uppercase font-bold text-ink-soft tracking-wider mb-1">
                Tu mensaje
              </p>
              <p className="text-sm text-ink-primary italic">"{shipment.custom_quote_message}"</p>
            </div>
          )}
        </div>
      )}

      {step === "branch" && destinationType === "sucursal" && (
        <BranchStep
          address={address}
          setAddress={setAddress}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
          quotes={quotes}
          carrier={carrier as "andreani" | "correo_argentino"}
          chooseQuote={chooseQuote}
          extras={extras}
          busy={busy}
          fetchQuote={(cp: string) => fetchAllQuotes(cp, "sucursal")}
          onBack={() => setStep("method")}
          onContinue={submitAddress}
        />
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          <h2 className="font-display text-2xl text-ink-primary text-center">¿Confirmamos?</h2>

          <div className="card bg-success/10 border border-success/30">
            <p className="text-xs uppercase font-bold text-ink-soft tracking-wider mb-2">
              {shipment.destination_type === "sucursal" ? "📍 Retiras en sucursal" : "🏠 Te lo enviamos a"}
            </p>
            {shipment.destination_type === "sucursal" ? (
              <>
                <p className="font-bold text-ink-primary">{shipment.destination_branch?.nombre}</p>
                <p className="text-sm text-ink-secondary">
                  {shipment.destination_branch?.direccion} · {shipment.destination_branch?.localidad}
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-ink-primary">{shipment.destination_address?.nombre_completo}</p>
                <p className="text-sm text-ink-secondary">
                  {shipment.destination_address?.calle} {shipment.destination_address?.numero}
                  {shipment.destination_address?.piso && `, Piso ${shipment.destination_address.piso}`}
                  {shipment.destination_address?.depto && ` Depto ${shipment.destination_address.depto}`}
                </p>
                <p className="text-sm text-ink-secondary">
                  {shipment.destination_address?.localidad}, {shipment.destination_address?.region} · CP {shipment.destination_address?.codigoPostal}
                </p>
              </>
            )}
          </div>

          <div className="card">
            <div className="flex justify-between items-center">
              <p className="text-ink-secondary">
                Total del envío
                {shipment.carrier === "personalizado" && (
                  <span className="block text-xs text-rose-deep font-bold uppercase tracking-wider mt-0.5">
                    Cotización personalizada
                  </span>
                )}
              </p>
              <p className="font-display text-3xl text-rose-deep font-bold">
                {formatPrice(Number(shipment.cost_charged))}
              </p>
            </div>
            {shipment.carrier === "personalizado" && shipment.custom_quote_message && (
              <div className="mt-3 pt-3 border-t border-rose-pastel">
                <p className="text-xs uppercase font-bold text-ink-soft tracking-wider mb-1">
                  Mensaje de la marca
                </p>
                <p className="text-sm text-ink-primary italic">
                  "{shipment.custom_quote_message}"
                </p>
              </div>
            )}
            {shipment.carrier !== "personalizado" && (
              <p className="text-xs text-ink-soft mt-2">{extras.note_for_customer}</p>
            )}
          </div>

          {/* PAGO MANUAL (carrier personalizado, transferencia o pago personalizado) */}
          {shipment.carrier === "personalizado" && paymentMethods.transfer_enabled && (
            <>
              <TransferInstructions
                orderNumber={shipment.id.slice(0, 8).toUpperCase()}
                total={Number(shipment.cost_charged)}
                alias={paymentMethods.transfer_alias ?? ""}
                cbu={paymentMethods.transfer_cbu ?? ""}
                bank={paymentMethods.transfer_bank ?? ""}
                holder={paymentMethods.transfer_holder ?? ""}
              />
              <PaymentProofUploader
                entityType="shipment"
                entityId={shipment.id}
                userId={shipment.user_id}
                reference={`ENVIO-${shipment.id.slice(0, 8).toUpperCase()}`}
                amount={Number(shipment.cost_charged)}
                whatsappNumber={brand.whatsapp}
                label="el envío"
                existingProofUrl={shipment.payment_proof_url}
                existingViaWhatsapp={shipment.payment_proof_via_whatsapp}
                currentStatus={shipment.status}
              />
            </>
          )}

          {/* PAGO POR MP (carrier andreani/correo) */}
          {shipment.carrier !== "personalizado" && (
            <button onClick={payNow} disabled={busy} className="btn-primary w-full text-lg py-4">
              <Truck className="w-5 h-5" />
              {busy ? "Iniciando pago..." : `Pagar ${formatPrice(Number(shipment.cost_charged))} con Mercado Pago`}
            </button>
          )}

          <button onClick={() => router.push(`/shipment/${shipmentId}`)} className="text-sm text-ink-soft hover:text-rose-deep mx-auto block">
            ← Cambiar dirección
          </button>
        </div>
      )}

      {step === "paying" && (
        <div className="card text-center py-12">
          <Loader2 className="w-12 h-12 mx-auto text-rose-deep animate-spin" />
          <p className="font-display text-xl text-ink-primary mt-4">Llevándote a Mercado Pago...</p>
        </div>
      )}

      {step === "done" && (
        <div className="card text-center py-10 bg-gradient-to-br from-rose-whisper to-rose-pastel">
          <CheckCircle2 className="w-16 h-16 mx-auto text-success" />
          <h2 className="font-display text-2xl text-ink-primary mt-3">¡Listo! 🌸</h2>

          {(shipment.status === "paid" || shipment.status === "label_generated") && !shipment.tracking_number && !shipment.andreani_tracking_number && (
            <p className="text-ink-secondary mt-2">
              Recibimos tu pago. Estamos preparando el paquete y te avisamos cuando lo despachemos.
            </p>
          )}

          {(shipment.tracking_number || shipment.andreani_tracking_number) && (
            <>
              <p className="text-ink-secondary mt-2">
                Tu paquete está en camino{shipment.tracking_provider ? ` con ${shipment.tracking_provider}` : shipment.andreani_tracking_number ? " con Andreani" : ""}.
              </p>
              <div className="bg-white rounded-2xl p-3 mt-4 inline-block">
                <p className="text-xs uppercase text-ink-soft tracking-wider">Tracking</p>
                <p className="font-mono font-bold text-ink-primary">
                  {shipment.tracking_number || shipment.andreani_tracking_number}
                </p>
              </div>
              {shipment.tracking_url && (
                <p className="mt-3">
                  <a href={shipment.tracking_url} target="_blank" rel="noopener" className="text-rose-deep hover:underline text-sm font-semibold">
                    Seguir el envío →
                  </a>
                </p>
              )}
              {shipment.andreani_estimated_delivery && (
                <p className="text-sm text-ink-secondary mt-3">
                  📅 Llega aprox el {new Date(shipment.andreani_estimated_delivery).toLocaleDateString("es-AR")}
                </p>
              )}
            </>
          )}

          {!shipment.tracking_number && !shipment.andreani_tracking_number && shipment.status !== "paid" && shipment.status !== "label_generated" && (
            <p className="text-ink-secondary mt-2">Estado actual: {getShipmentStatusLabel(shipment.status).label}</p>
          )}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-ink-secondary mb-1.5">{label}</label>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function BranchStep({ address, setAddress, selectedBranch, setSelectedBranch, quotes, carrier, chooseQuote, extras, busy, fetchQuote, onBack, onContinue }: any) {
  const branches = getBranchesForCP(address.codigoPostal);
  const quote = quotes?.[carrier] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={onBack} className="text-rose-deep">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-display text-2xl text-ink-primary">Buscá tu sucursal</h2>
      </div>

      <Field label="Tu CP (para mostrarte sucursales cercanas) *" value={address.codigoPostal} onChange={(v) => {
        const cp = v.replace(/\D/g, "").slice(0, 4);
        setAddress({ ...address, codigoPostal: cp });
        if (cp.length === 4) fetchQuote(cp);
      }} placeholder="1414" />

      {address.codigoPostal.length === 4 && branches.length === 0 && (
        <div className="card bg-warning/10 border border-warning/30 text-sm">
          <AlertCircle className="w-5 h-5 text-warning inline mr-2" />
          No encontramos sucursales para ese CP. Probá con otro o elegí "A domicilio".
        </div>
      )}

      {branches.length > 0 && (
        <div className="space-y-2">
          {branches.map((b) => {
            const sel = selectedBranch?.id === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b)}
                className={`card w-full text-left transition ${
                  sel ? "ring-2 ring-rose-deep bg-rose-whisper" : "hover:shadow-soft"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${sel ? "bg-rose-deep text-white" : "bg-rose-pastel"}`}>
                    📍
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-ink-primary">{b.nombre}</p>
                    <p className="text-sm text-ink-secondary">{b.direccion}</p>
                    <p className="text-xs text-ink-soft">{b.localidad}, {b.region} · CP {b.codigoPostal}</p>
                  </div>
                  {sel && <CheckCircle2 className="w-5 h-5 text-rose-deep" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold text-ink-primary mb-2">Tus datos para retirar</h3>
        <div className="space-y-3">
          <Field label="Nombre completo *" value={address.nombre_completo} onChange={(v: string) => setAddress({ ...address, nombre_completo: v })} placeholder="Como figura en el DNI" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="DNI *" value={address.documento} onChange={(v: string) => setAddress({ ...address, documento: v.replace(/\D/g, "") })} placeholder="40123456" />
            <Field label="Teléfono *" value={address.telefono} onChange={(v: string) => setAddress({ ...address, telefono: v })} placeholder="+5491141..." />
          </div>
        </div>
      </div>

      {address.codigoPostal.length === 4 && (
        <DualQuoteSelector
          quotes={quotes}
          selected={carrier}
          busy={busy}
          extrasNote={extras?.note_for_customer ?? ""}
          onSelect={chooseQuote}
          onRetry={() => fetchQuote(address.codigoPostal)}
          context="sucursal"
        />
      )}

      <button
        onClick={onContinue}
        disabled={busy || !quote || !selectedBranch || !address.nombre_completo || !address.documento}
        className="btn-primary w-full"
      >
        Continuar a confirmación <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================================
// Selector dual: muestra Andreani + Correo lado a lado y la clienta toca uno
// ============================================================
type DualQuote = { cost_quoted: number; cost_charged: number; mode: string; carrier: ShipmentCarrier };

function DualQuoteSelector({
  quotes,
  selected,
  busy,
  extrasNote,
  onSelect,
  onRetry,
  context = "domicilio",
}: {
  quotes: { andreani: DualQuote | null; correo_argentino: DualQuote | null };
  selected: "andreani" | "correo_argentino";
  busy: boolean;
  extrasNote?: string;
  onSelect: (c: "andreani" | "correo_argentino") => void;
  onRetry: () => void;
  context?: "domicilio" | "sucursal";
}) {
  const carriers: ("andreani" | "correo_argentino")[] = ["andreani", "correo_argentino"];
  const allFailed = !busy && carriers.every((c) => !quotes[c]);

  if (busy && carriers.every((c) => !quotes[c])) {
    return (
      <div className="card bg-rose-whisper/60 text-center py-6">
        <Loader2 className="w-5 h-5 inline animate-spin text-rose-deep" />
        <p className="text-sm text-ink-soft mt-2">Comparando precios con Andreani y Correo...</p>
      </div>
    );
  }

  if (allFailed) {
    return (
      <div className="card bg-warning/10 border border-warning/30 text-center py-5">
        <AlertCircle className="w-6 h-6 text-warning mx-auto mb-2" />
        <p className="text-sm text-ink-secondary">No pudimos cotizar con ningún carrier.</p>
        <button onClick={onRetry} className="btn-secondary text-sm mt-3">
          Reintentar
        </button>
      </div>
    );
  }

  // Mejor precio para destacar el ahorro
  const validPrices = carriers
    .map((c) => quotes[c])
    .filter((q): q is DualQuote => !!q)
    .map((q) => q.cost_charged);
  const minPrice = validPrices.length ? Math.min(...validPrices) : null;

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase font-bold text-ink-soft tracking-wider px-1">
        {context === "sucursal" ? "Elegí carrier (precio a sucursal)" : "Elegí cómo te lo mandamos"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {carriers.map((c) => {
          const q = quotes[c];
          const isSel = selected === c;
          const meta = {
            andreani: { icon: "🚚", subtitle: "24-72hs · más rápido" },
            correo_argentino: { icon: "📮", subtitle: "3-7 días · más económico" },
          }[c];
          const isCheapest = q && minPrice !== null && q.cost_charged === minPrice && validPrices.length > 1;

          if (!q) {
            // Tarjeta deshabilitada cuando ese carrier falló
            return (
              <div key={c} className="card bg-ink-soft/5 border border-ink-soft/10 opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-ink-soft/15 flex items-center justify-center text-xl grayscale">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink-soft">{CARRIER_LABELS[c]}</p>
                    <p className="text-[11px] text-ink-soft">No disponible para este CP</p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelect(c)}
              className={`card text-left transition relative ${
                isSel
                  ? "ring-2 ring-rose-deep bg-rose-whisper"
                  : "hover:shadow-soft hover:-translate-y-0.5"
              }`}
            >
              {isCheapest && (
                <span className="absolute -top-2 -right-2 bg-success text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-soft">
                  Más barato
                </span>
              )}
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
                    isSel ? "bg-rose-deep text-white" : "bg-rose-pastel"
                  }`}
                >
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink-primary text-sm">{CARRIER_LABELS[c]}</p>
                  <p className="text-[11px] text-ink-soft">{meta.subtitle}</p>
                  <p className="font-display text-xl text-rose-deep font-bold mt-1">
                    {formatPrice(q.cost_charged)}
                  </p>
                  {q.mode === "mock" && (
                    <p className="text-[10px] text-warning mt-0.5">⚠️ Cotización simulada</p>
                  )}
                </div>
                {isSel && <CheckCircle2 className="w-5 h-5 text-rose-deep flex-shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
      {extrasNote && <p className="text-[11px] text-ink-soft px-1 mt-1">{extrasNote}</p>}
    </div>
  );
}
