"use client";

import { useState } from "react";
import { Save, Truck, Settings as SettingsIcon, AlertCircle, CheckCircle2, CreditCard, Building2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function SettingsForm({ initial }: { initial: Record<string, any> }) {
  const supabase = createSupabaseBrowser();
  const [origin, setOrigin] = useState(initial.shipping_origin ?? {});
  const [extras, setExtras] = useState(initial.shipping_extras ?? {});
  const [andreaniStatus] = useState(initial.andreani_status ?? { mode: "mock" });
  const [payments, setPayments] = useState(initial.payment_methods ?? {
    mercadopago_enabled: false,
    mercadopago_access_token: "",
    mercadopago_public_key: "",
    transfer_enabled: true,
    transfer_alias: "",
    transfer_bank: "",
    transfer_cbu: "",
    transfer_holder: "",
  });
  const [shipping, setShipping] = useState(initial.shipping_methods ?? {
    andreani_enabled: true,
    correo_argentino_enabled: false,
    custom_enabled: false,
    custom_label: "Envío personalizado",
    custom_price: 0,
  });
  const [saving, setSaving] = useState(false);

  function up<T>(setter: React.Dispatch<React.SetStateAction<T>>, key: string, val: any) {
    setter((prev: any) => ({ ...prev, [key]: val }) as T);
  }

  async function save() {
    setSaving(true);
    const updates = [
      supabase.from("site_settings").upsert({ key: "shipping_origin", value: origin }),
      supabase.from("site_settings").upsert({ key: "shipping_extras", value: extras }),
      supabase.from("site_settings").upsert({ key: "payment_methods", value: payments }),
      supabase.from("site_settings").upsert({ key: "shipping_methods", value: shipping }),
    ];
    const results = await Promise.all(updates);
    setSaving(false);
    const err = results.find((r) => r.error);
    if (err?.error) toast.error("Error: " + err.error.message);
    else toast.success("Configuración guardada 🌸");
  }

  const isMock = andreaniStatus.mode === "mock";

  return (
    <div className="space-y-5">
      {/* MÉTODOS DE PAGO */}
      <section className="card !p-5 space-y-3">
        <SectionTitle icon={<CreditCard className="w-4 h-4" />} title="Métodos de pago" />

        <Toggle
          label="Transferencia / CBU / Alias"
          desc="El cliente te transfiere y confirmás el pago desde Órdenes."
          checked={!!payments.transfer_enabled}
          onChange={(v) => up(setPayments, "transfer_enabled", v)}
        >
          <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
            <Field label="Alias *" value={payments.transfer_alias} onChange={(v) => up(setPayments, "transfer_alias", v)} placeholder="cancerianas.mp" />
            <Field label="CBU (opcional)" value={payments.transfer_cbu} onChange={(v) => up(setPayments, "transfer_cbu", v)} placeholder="0000003100..." />
            <Field label="Banco" value={payments.transfer_bank} onChange={(v) => up(setPayments, "transfer_bank", v)} placeholder="Mercado Pago / Brubank / etc." />
            <Field label="Titular" value={payments.transfer_holder} onChange={(v) => up(setPayments, "transfer_holder", v)} placeholder="María García" />
          </div>
        </Toggle>

        <Toggle
          label="Mercado Pago"
          desc="Checkout externo de MP. Necesitás las credenciales de tu cuenta."
          checked={!!payments.mercadopago_enabled}
          onChange={(v) => up(setPayments, "mercadopago_enabled", v)}
        >
          <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
            <Field label="Access Token" value={payments.mercadopago_access_token} onChange={(v) => up(setPayments, "mercadopago_access_token", v)} placeholder="APP_USR-..." />
            <Field label="Public Key" value={payments.mercadopago_public_key} onChange={(v) => up(setPayments, "mercadopago_public_key", v)} placeholder="APP_USR-..." />
          </div>
        </Toggle>
      </section>

      {/* MÉTODOS DE ENVÍO */}
      <section className="card !p-5 space-y-3">
        <SectionTitle icon={<Truck className="w-4 h-4" />} title="Métodos de envío" />

        <Toggle
          label="Andreani"
          desc="Domicilio o sucursal. Requiere convenio con Andreani."
          checked={!!shipping.andreani_enabled}
          onChange={(v) => up(setShipping, "andreani_enabled", v)}
        />

        <Toggle
          label="Correo Argentino"
          desc="Envío por Correo Argentino."
          checked={!!shipping.correo_argentino_enabled}
          onChange={(v) => up(setShipping, "correo_argentino_enabled", v)}
        />

        <Toggle
          label="Envío personalizado / precio fijo"
          desc="Una opción con nombre y precio que vos definís."
          checked={!!shipping.custom_enabled}
          onChange={(v) => up(setShipping, "custom_enabled", v)}
        >
          <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
            <Field label="Nombre" value={shipping.custom_label} onChange={(v) => up(setShipping, "custom_label", v)} placeholder="Moto mensajería CABA" />
            <Field label="Precio ($)" type="number" value={shipping.custom_price?.toString() ?? "0"} onChange={(v) => up(setShipping, "custom_price", Number(v))} placeholder="3500" />
          </div>
        </Toggle>
      </section>

      {/* ANDREANI STATUS */}
      <section className={`card !p-4 border-2 ${isMock ? "border-warning/40 bg-warning/5" : "border-success/40 bg-success/5"}`}>
        <div className="flex items-start gap-3">
          {isMock ? <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-primary">
              Andreani: <span className={isMock ? "text-warning" : "text-success"}>modo {andreaniStatus.mode}</span>
            </p>
            {isMock ? (
              <>
                <p className="text-xs text-ink-secondary mt-1">Datos simulados. Los envíos NO se generan realmente. Configurá las variables de entorno cuando tengas convenio:</p>
                <ul className="text-[11px] text-ink-soft mt-1.5 space-y-0.5 font-mono">
                  <li>· ANDREANI_USER, ANDREANI_PASS</li>
                  <li>· ANDREANI_CONTRATO_DOMICILIO, ANDREANI_CONTRATO_SUCURSAL</li>
                  <li>· ANDREANI_CODIGO_CLIENTE</li>
                  <li>· ANDREANI_MODE = sandbox | production</li>
                </ul>
              </>
            ) : (
              <p className="text-xs text-ink-secondary mt-1">Conectado a Andreani {andreaniStatus.mode === "production" ? "PRODUCCIÓN" : "Sandbox QA"}.</p>
            )}
          </div>
        </div>
      </section>

      {/* DIRECCIÓN DE ORIGEN */}
      <section className="card !p-5">
        <SectionTitle icon={<MapPin className="w-4 h-4" />} title="Dirección de origen (despacho)" />
        <p className="text-xs text-ink-soft -mt-1 mb-3">Va impresa en cada etiqueta de envío.</p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <Field label="Razón social *" value={origin.razon_social} onChange={(v) => up(setOrigin, "razon_social", v)} />
          <Field label="Nombre comercial" value={origin.nombre_comercial} onChange={(v) => up(setOrigin, "nombre_comercial", v)} />
          <Field label="CUIT (sin guiones) *" value={origin.cuit} onChange={(v) => up(setOrigin, "cuit", v)} placeholder="30123456789" />
          <Field label="Email *" value={origin.email} onChange={(v) => up(setOrigin, "email", v)} placeholder="cancerianas.kids@gmail.com" />
          <Field label="Teléfono" value={origin.telefono} onChange={(v) => up(setOrigin, "telefono", v)} placeholder="+54911..." />
          <div />
          <Field label="Calle *" value={origin.calle} onChange={(v) => up(setOrigin, "calle", v)} />
          <Field label="Número *" value={origin.numero} onChange={(v) => up(setOrigin, "numero", v)} />
          <Field label="Piso" value={origin.piso} onChange={(v) => up(setOrigin, "piso", v)} />
          <Field label="Depto" value={origin.depto} onChange={(v) => up(setOrigin, "depto", v)} />
          <Field label="Localidad *" value={origin.localidad} onChange={(v) => up(setOrigin, "localidad", v)} />
          <Field label="Provincia *" value={origin.region} onChange={(v) => up(setOrigin, "region", v)} />
          <Field label="Código postal *" value={origin.codigo_postal} onChange={(v) => up(setOrigin, "codigo_postal", v)} placeholder="1744" />
        </div>
      </section>

      {/* RECARGOS */}
      <section className="card !p-5">
        <SectionTitle icon={<SettingsIcon className="w-4 h-4" />} title="Recargos sobre el envío" />
        <p className="text-xs text-ink-soft -mt-1 mb-3">Para cubrir embalaje, costos operativos, etc.</p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <Field label="Recargo (%)" type="number" value={extras.recargo_porcentaje?.toString() ?? "0"} onChange={(v) => up(setExtras, "recargo_porcentaje", Number(v) || 0)} placeholder="0" />
          <Field label="Fee fijo ($)" type="number" value={extras.fee_fijo?.toString() ?? "0"} onChange={(v) => up(setExtras, "fee_fijo", Number(v) || 0)} placeholder="0" />
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Texto que ve la clienta antes de pagar</label>
            <input className="input !h-10 !text-sm" value={extras.note_for_customer ?? ""} onChange={(e) => up(setExtras, "note_for_customer", e.target.value)} placeholder="Te llega con Andreani en 24-72hs según zona." />
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end pt-2">
        <button onClick={save} disabled={saving} className="btn-primary shadow-lg">
          <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="w-7 h-7 rounded-full bg-rose-whisper text-rose-deep flex items-center justify-center">{icon}</span>
      <h2 className="font-display text-base text-ink-primary">{title}</h2>
    </div>
  );
}

/**
 * Toggle compacto con switch a la derecha (touch-friendly) y contenido
 * condicional debajo cuando está activo. Toda la tarjeta es clickeable.
 */
function Toggle({
  label,
  desc,
  checked,
  onChange,
  children,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        checked ? "border-success/40 bg-success/5" : "border-rose-pastel hover:border-rose-medium/40"
      }`}
    >
      <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-primary leading-tight">{label}</p>
          <p className="text-[11px] text-ink-soft leading-snug mt-0.5">{desc}</p>
        </div>
        <Switch checked={checked} onChange={onChange} />
      </label>
      {checked && children && <div className="mt-3 pt-3 border-t border-rose-pastel/60">{children}</div>}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rose-deep/30 ${
        checked ? "bg-success" : "bg-rose-pastel"
      }`}
    >
      <span
        className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink-secondary mb-1">{label}</label>
      <input
        className="input !h-10 !text-sm"
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
