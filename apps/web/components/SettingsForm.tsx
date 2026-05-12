"use client";

import { useState } from "react";
import { Save, Truck, Settings as SettingsIcon, AlertCircle, CheckCircle2, CreditCard, Building2 } from "lucide-react";
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
    custom_label: "EnvÃ­o personalizado",
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
    if (err?.error) {
      toast.error("Error: " + err.error.message);
    } else {
      toast.success("ConfiguraciÃ³n guardada ðŸŒ¸");
    }
  }

  const isMock = andreaniStatus.mode === "mock";

  return (
    <div className="space-y-6">

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MÃ‰TODOS DE PAGO
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="card space-y-5">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-rose-deep" />
          <h2 className="font-display text-xl text-ink-primary">MÃ©todos de pago</h2>
        </div>

        {/* Transferencia directa */}
        <div className={`rounded-2xl border-2 p-4 space-y-4 transition ${payments.transfer_enabled ? "border-success/40 bg-success/5" : "border-rose-pastel"}`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 accent-rose-deep"
              checked={!!payments.transfer_enabled}
              onChange={(e) => up(setPayments, "transfer_enabled", e.target.checked)}
            />
            <div>
              <p className="font-semibold text-ink-primary">Transferencia directa / CBU / Alias</p>
              <p className="text-xs text-ink-soft">El cliente te transfiere y vos confirmÃ¡s el pago desde el panel de Ã³rdenes.</p>
            </div>
          </label>

          {payments.transfer_enabled && (
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <Field label="Alias *" value={payments.transfer_alias} onChange={(v) => up(setPayments, "transfer_alias", v)} placeholder="cancerianas.mp" />
              <Field label="CBU (opcional)" value={payments.transfer_cbu} onChange={(v) => up(setPayments, "transfer_cbu", v)} placeholder="0000003100..." />
              <Field label="Banco" value={payments.transfer_bank} onChange={(v) => up(setPayments, "transfer_bank", v)} placeholder="Mercado Pago / Brubank / etc." />
              <Field label="Titular de la cuenta" value={payments.transfer_holder} onChange={(v) => up(setPayments, "transfer_holder", v)} placeholder="MarÃ­a GarcÃ­a" />
            </div>
          )}
        </div>

        {/* Mercado Pago */}
        <div className={`rounded-2xl border-2 p-4 space-y-4 transition ${payments.mercadopago_enabled ? "border-success/40 bg-success/5" : "border-rose-pastel"}`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 accent-rose-deep"
              checked={!!payments.mercadopago_enabled}
              onChange={(e) => up(setPayments, "mercadopago_enabled", e.target.checked)}
            />
            <div>
              <p className="font-semibold text-ink-primary">Mercado Pago</p>
              <p className="text-xs text-ink-soft">Checkout externo de MP. NecesitÃ¡s las credenciales de tu cuenta de MP.</p>
            </div>
          </label>

          {payments.mercadopago_enabled && (
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <Field label="Access Token" value={payments.mercadopago_access_token} onChange={(v) => up(setPayments, "mercadopago_access_token", v)} placeholder="APP_USR-..." />
              <Field label="Public Key" value={payments.mercadopago_public_key} onChange={(v) => up(setPayments, "mercadopago_public_key", v)} placeholder="APP_USR-..." />
            </div>
          )}
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MÃ‰TODOS DE ENVÃO
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-rose-deep" />
          <h2 className="font-display text-xl text-ink-primary">MÃ©todos de envÃ­o</h2>
        </div>

        {[
          { key: "andreani_enabled", label: "Andreani", desc: "EnvÃ­o a domicilio o sucursal. Requiere convenio con Andreani." },
          { key: "correo_argentino_enabled", label: "Correo Argentino", desc: "EnvÃ­o por Correo Argentino." },
        ].map(({ key, label, desc }) => (
          <label key={key} className={`flex items-center gap-3 cursor-pointer rounded-2xl border-2 p-4 transition ${(shipping as any)[key] ? "border-success/40 bg-success/5" : "border-rose-pastel"}`}>
            <input
              type="checkbox"
              className="w-5 h-5 accent-rose-deep"
              checked={!!(shipping as any)[key]}
              onChange={(e) => up(setShipping, key, e.target.checked)}
            />
            <div>
              <p className="font-semibold text-ink-primary">{label}</p>
              <p className="text-xs text-ink-soft">{desc}</p>
            </div>
          </label>
        ))}

        {/* EnvÃ­o personalizado */}
        <div className={`rounded-2xl border-2 p-4 space-y-3 transition ${shipping.custom_enabled ? "border-success/40 bg-success/5" : "border-rose-pastel"}`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 accent-rose-deep"
              checked={!!shipping.custom_enabled}
              onChange={(e) => up(setShipping, "custom_enabled", e.target.checked)}
            />
            <div>
              <p className="font-semibold text-ink-primary">EnvÃ­o personalizado / precio fijo</p>
              <p className="text-xs text-ink-soft">MostrÃ¡s una opciÃ³n con nombre y precio que vos definÃ­s.</p>
            </div>
          </label>
          {shipping.custom_enabled && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nombre de la opciÃ³n" value={shipping.custom_label} onChange={(v) => up(setShipping, "custom_label", v)} placeholder="Moto mensajerÃ­a CABA" />
              <Field label="Precio ($)" type="number" value={shipping.custom_price?.toString() ?? "0"} onChange={(v) => up(setShipping, "custom_price", Number(v))} placeholder="3500" />
            </div>
          )}
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          ANDREANI STATUS
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className={`card ${isMock ? "border-2 border-warning/40 bg-warning/5" : "border-2 border-success/40 bg-success/5"}`}>
        <div className="flex items-start gap-3">
          {isMock ? <AlertCircle className="w-6 h-6 text-warning flex-shrink-0" /> : <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />}
          <div className="flex-1">
            <h2 className="font-display text-xl text-ink-primary">
              Andreani: <span className={isMock ? "text-warning" : "text-success"}>modo {andreaniStatus.mode}</span>
            </h2>
            {isMock ? (
              <>
                <p className="text-sm text-ink-secondary mt-1">EstÃ¡s operando con datos simulados. Los envÃ­os NO se generan en Andreani realmente. Cuando tengas las credenciales del convenio, configuralas en las variables de entorno:</p>
                <ul className="text-xs text-ink-soft mt-2 space-y-0.5 font-mono">
                  <li>Â· ANDREANI_USER, ANDREANI_PASS</li>
                  <li>Â· ANDREANI_CONTRATO_DOMICILIO, ANDREANI_CONTRATO_SUCURSAL</li>
                  <li>Â· ANDREANI_CODIGO_CLIENTE</li>
                  <li>Â· ANDREANI_MODE = sandbox | production</li>
                </ul>
              </>
            ) : (
              <p className="text-sm text-ink-secondary mt-1">Conectado a Andreani {andreaniStatus.mode === "production" ? "PRODUCCIÃ“N" : "Sandbox QA"}.</p>
            )}
          </div>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          DIRECCIÃ“N DE ORIGEN
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-rose-deep" />
          <h2 className="font-display text-xl text-ink-primary">DirecciÃ³n de origen (despacho)</h2>
        </div>
        <p className="text-sm text-ink-soft mb-4">Desde dÃ³nde despachÃ¡s. Va impresa en cada etiqueta de envÃ­o.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="RazÃ³n social *" value={origin.razon_social} onChange={(v) => up(setOrigin, "razon_social", v)} />
          <Field label="Nombre comercial" value={origin.nombre_comercial} onChange={(v) => up(setOrigin, "nombre_comercial", v)} />
          <Field label="CUIT (sin guiones) *" value={origin.cuit} onChange={(v) => up(setOrigin, "cuit", v)} placeholder="30123456789" />
          <Field label="Email *" value={origin.email} onChange={(v) => up(setOrigin, "email", v)} placeholder="cancerianas.kids@gmail.com" />
          <Field label="TelÃ©fono" value={origin.telefono} onChange={(v) => up(setOrigin, "telefono", v)} placeholder="+54911..." />
          <div />
          <Field label="Calle *" value={origin.calle} onChange={(v) => up(setOrigin, "calle", v)} />
          <Field label="NÃºmero *" value={origin.numero} onChange={(v) => up(setOrigin, "numero", v)} />
          <Field label="Piso" value={origin.piso} onChange={(v) => up(setOrigin, "piso", v)} />
          <Field label="Depto" value={origin.depto} onChange={(v) => up(setOrigin, "depto", v)} />
          <Field label="Localidad *" value={origin.localidad} onChange={(v) => up(setOrigin, "localidad", v)} />
          <Field label="Provincia *" value={origin.region} onChange={(v) => up(setOrigin, "region", v)} />
          <Field label="CÃ³digo postal *" value={origin.codigo_postal} onChange={(v) => up(setOrigin, "codigo_postal", v)} placeholder="1744" />
        </div>
      </div>

      {/* EXTRAS DE ENVÃO */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <SettingsIcon className="w-5 h-5 text-rose-deep" />
          <h2 className="font-display text-xl text-ink-primary">Recargos sobre el envÃ­o</h2>
        </div>
        <p className="text-sm text-ink-soft mb-4">Para cubrir embalaje, costos operativos, etc.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Recargo (%)" type="number" value={extras.recargo_porcentaje?.toString() ?? "0"} onChange={(v) => up(setExtras, "recargo_porcentaje", Number(v) || 0)} placeholder="0" />
          <Field label="Fee fijo ($)" type="number" value={extras.fee_fijo?.toString() ?? "0"} onChange={(v) => up(setExtras, "fee_fijo", Number(v) || 0)} placeholder="0" />
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Texto que ve la clienta antes de pagar</label>
            <input className="input" value={extras.note_for_customer ?? ""} onChange={(e) => up(setExtras, "note_for_customer", e.target.value)} placeholder="Te llega con Andreani en 24-72hs según zona." />
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary">
        <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar configuración"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-ink-secondary mb-1.5">{label}</label>
      <input className="input" type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
