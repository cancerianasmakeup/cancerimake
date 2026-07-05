"use client";

import { useState, useMemo } from "react";
import {
  Save, Truck, AlertCircle, CheckCircle2, CreditCard, Building2, MapPin,
  Sparkles as BrandIcon, BarChart3, Search, PaintBucket, Power, Percent,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { DEFAULT_QUEUE, type QueueSettings } from "@/lib/site-settings-types";

type TabKey =
  | "brand"
  | "payments"
  | "shipping"
  | "address"
  | "appearance"
  | "analytics"
  | "seo"
  | "queue"
  | "operation";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "brand",       label: "Marca y contacto",   icon: BrandIcon },
  { key: "payments",    label: "Métodos de pago",    icon: CreditCard },
  { key: "shipping",    label: "Envíos",             icon: Truck },
  { key: "address",     label: "Dirección de origen",icon: MapPin },
  { key: "appearance",  label: "Apariencia",         icon: PaintBucket },
  { key: "analytics",   label: "Analytics",          icon: BarChart3 },
  { key: "seo",         label: "SEO",                icon: Search },
  { key: "queue",       label: "Cola virtual",       icon: Users },
  { key: "operation",   label: "Operación / tienda", icon: Power },
];

export default function SettingsForm({ initial }: { initial: Record<string, any> }) {
  const supabase = createSupabaseBrowser();

  // Un state por cada key de site_settings que editamos.
  const [brand,       setBrand]       = useState(initial.brand_info       ?? {});
  const [payments,    setPayments]    = useState(initial.payment_methods  ?? {});
  const [shipping,    setShipping]    = useState(initial.shipping_methods ?? {});
  const [origin,      setOrigin]      = useState(initial.shipping_origin  ?? {});
  const [extras,      setExtras]      = useState(initial.shipping_extras  ?? {});
  const [appearance,  setAppearance]  = useState(initial.appearance       ?? {});
  const [analytics,   setAnalytics]   = useState(initial.analytics        ?? {});
  const [seo,         setSeo]         = useState(initial.seo              ?? {});
  const [maintenance, setMaintenance] = useState(initial.maintenance      ?? {});
  const [queue,       setQueue]       = useState<QueueSettings>({ ...DEFAULT_QUEUE, ...(initial.queue ?? {}) });
  const [andreaniStatus] = useState(initial.andreani_status ?? { mode: "mock" });

  const [tab, setTab] = useState<TabKey>("brand");
  const [saving, setSaving] = useState(false);
  // Track de cambios sin guardar para mostrar un dot en cada tab.
  const initialSnapshot = useMemo(() => JSON.stringify(initial), []); // eslint-disable-line react-hooks/exhaustive-deps
  const currentSnapshot = JSON.stringify({
    brand_info: brand, payment_methods: payments, shipping_methods: shipping,
    shipping_origin: origin, shipping_extras: extras, appearance, analytics,
    seo, maintenance, queue,
  });
  const dirty = useMemo(() => {
    // Comparación grosera key por key — si cambia algún campo, hay cambios.
    return Object.entries({
      brand_info: brand, payment_methods: payments, shipping_methods: shipping,
      shipping_origin: origin, shipping_extras: extras, appearance, analytics,
      seo, maintenance, queue,
    }).some(([k, v]) => JSON.stringify((initial as any)[k] ?? {}) !== JSON.stringify(v));
  }, [currentSnapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  function up<T>(setter: React.Dispatch<React.SetStateAction<T>>, key: string, val: any) {
    setter((prev: any) => ({ ...prev, [key]: val }) as T);
  }

  async function save() {
    setSaving(true);
    const rows = [
      { key: "brand_info",       value: brand },
      { key: "payment_methods",  value: payments },
      { key: "shipping_methods", value: shipping },
      { key: "shipping_origin",  value: origin },
      { key: "shipping_extras",  value: extras },
      { key: "appearance",       value: appearance },
      { key: "analytics",        value: analytics },
      { key: "seo",              value: seo },
      { key: "maintenance",      value: maintenance },
      { key: "queue",            value: queue },
    ];
    const { error } = await supabase
      .from("site_settings")
      .upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error("No se pudo guardar: " + error.message);
    else toast.success("Configuración guardada 🌸");
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6">
      {/* SIDEBAR DE TABS */}
      <nav className="md:sticky md:top-4 self-start">
        <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-4 px-4 md:m-0 md:p-0">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`w-full whitespace-nowrap md:whitespace-normal flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition ${
                    active ? "bg-rose-deep text-white shadow-soft"
                           : "text-ink-secondary hover:bg-rose-whisper hover:text-rose-deep"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{t.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* CONTENIDO */}
      <div className="space-y-5 pb-32 min-w-0">
        {tab === "brand"      && <TabBrand       brand={brand}        set={(k,v)=>up(setBrand,k,v)} />}
        {tab === "payments"   && <TabPayments    payments={payments}  set={(k,v)=>up(setPayments,k,v)} />}
        {tab === "shipping"   && <TabShipping    shipping={shipping}  extras={extras}
                                                 setShipping={(k,v)=>up(setShipping,k,v)}
                                                 setExtras={(k,v)=>up(setExtras,k,v)}
                                                 andreaniMode={andreaniStatus.mode} />}
        {tab === "address"    && <TabAddress     origin={origin}      set={(k,v)=>up(setOrigin,k,v)} />}
        {tab === "appearance" && <TabAppearance  appearance={appearance} set={(k,v)=>up(setAppearance,k,v)} />}
        {tab === "analytics"  && <TabAnalytics   analytics={analytics} set={(k,v)=>up(setAnalytics,k,v)} />}
        {tab === "seo"        && <TabSeo         seo={seo}            set={(k,v)=>up(setSeo,k,v)} />}
        {tab === "queue"      && <TabQueue       queue={queue}        set={(k,v)=>up(setQueue,k,v)} />}
        {tab === "operation"  && <TabOperation   maintenance={maintenance} set={(k,v)=>up(setMaintenance,k,v)} />}
      </div>

      {/* SAVE BAR STICKY */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur border-t border-rose-pastel px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <p className="text-xs text-ink-soft">
            {dirty ? "Hay cambios sin guardar" : "Todo al día"}
          </p>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB: MARCA Y CONTACTO
// ============================================================
function TabBrand({ brand, set }: { brand: any; set: (k: string, v: any) => void }) {
  return (
    <Card title="Marca" icon={<BrandIcon className="w-4 h-4" />}>
      <p className="text-xs text-ink-soft -mt-1 mb-3">Estos datos aparecen en el Header, Footer y página de login.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nombre de la tienda" value={brand.name} onChange={(v) => set("name", v)} placeholder="Cancerianas" />
        <Field label="Tagline / lema" value={brand.tagline} onChange={(v) => set("tagline", v)} placeholder="Para mujeres libres" />
        <Field label="Logo URL" value={brand.logo_url} onChange={(v) => set("logo_url", v)} placeholder="https://..." wide />
      </div>

      <Divider title="Contacto" />
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Email de contacto" value={brand.contact_email} onChange={(v) => set("contact_email", v)} placeholder="hola@cancerianas.com.ar" />
        <Field label="WhatsApp (solo números, con +)" value={brand.whatsapp} onChange={(v) => set("whatsapp", v)} placeholder="+5491100000000" />
        <Field label="Mensaje predeterminado WhatsApp" value={brand.whatsapp_default_message} onChange={(v) => set("whatsapp_default_message", v)} placeholder="¡Hola! Tengo una consulta..." wide />
      </div>

      <Divider title="Redes sociales" />
      <Toggle
        label="Mostrar Instagram en el footer"
        desc="Y agregar icono clickeable."
        checked={!!brand.show_instagram}
        onChange={(v) => set("show_instagram", v)}
      >
        <Field label="URL de Instagram" value={brand.instagram_url} onChange={(v) => set("instagram_url", v)} placeholder="https://instagram.com/cancerianas" wide />
      </Toggle>

      <Toggle
        label="Mostrar TikTok en el footer"
        desc=""
        checked={!!brand.show_tiktok}
        onChange={(v) => set("show_tiktok", v)}
      >
        <Field label="URL de TikTok" value={brand.tiktok_url} onChange={(v) => set("tiktok_url", v)} placeholder="https://tiktok.com/@cancerianas" wide />
      </Toggle>

      <Toggle
        label="Botón flotante de WhatsApp"
        desc="Aparece abajo a la derecha en toda la tienda."
        checked={!!brand.show_whatsapp_floating}
        onChange={(v) => set("show_whatsapp_floating", v)}
      />
    </Card>
  );
}

// ============================================================
// TAB: MÉTODOS DE PAGO
// ============================================================
function TabPayments({ payments, set }: { payments: any; set: (k: string, v: any) => void }) {
  return (
    <Card title="Métodos de pago" icon={<CreditCard className="w-4 h-4" />}>
      <Toggle
        label="Transferencia / CBU / Alias"
        desc="El cliente transfiere y vos confirmás manualmente desde Órdenes."
        checked={!!payments.transfer_enabled}
        onChange={(v) => set("transfer_enabled", v)}
      >
        <div className="grid sm:grid-cols-2 gap-2.5">
          <Field label="Alias *" value={payments.transfer_alias} onChange={(v) => set("transfer_alias", v)} placeholder="cancerianas.mp" />
          <Field label="CBU (opcional)" value={payments.transfer_cbu} onChange={(v) => set("transfer_cbu", v)} placeholder="0000003100..." />
          <Field label="Banco" value={payments.transfer_bank} onChange={(v) => set("transfer_bank", v)} placeholder="Mercado Pago" />
          <Field label="Titular" value={payments.transfer_holder} onChange={(v) => set("transfer_holder", v)} placeholder="María García" />
          <Field
            label="Descuento por transferencia (%)"
            type="number"
            value={(payments.transfer_discount_pct ?? 0).toString()}
            onChange={(v) => set("transfer_discount_pct", Number(v) || 0)}
            placeholder="0"
            hint="Se aplica al total. Ej: 10 = 10% off al elegir transferencia."
          />
        </div>
      </Toggle>

      <Toggle
        label="Mercado Pago"
        desc="Checkout externo de MP. Necesitás credenciales de tu cuenta."
        checked={!!payments.mercadopago_enabled}
        onChange={(v) => set("mercadopago_enabled", v)}
      >
        <div className="grid sm:grid-cols-2 gap-2.5">
          <Field label="Access Token" value={payments.mercadopago_access_token} onChange={(v) => set("mercadopago_access_token", v)} placeholder="APP_USR-..." />
          <Field label="Public Key" value={payments.mercadopago_public_key} onChange={(v) => set("mercadopago_public_key", v)} placeholder="APP_USR-..." />
          <Field
            label="Texto de cuotas a mostrar"
            value={payments.mercadopago_installments_text}
            onChange={(v) => set("mercadopago_installments_text", v)}
            placeholder="Hasta 12 cuotas sin interés"
            hint="Aparece en el botón de Mercado Pago del checkout."
            wide
          />
        </div>
      </Toggle>
    </Card>
  );
}

// ============================================================
// TAB: ENVÍOS
// ============================================================
function TabShipping({
  shipping, extras, setShipping, setExtras, andreaniMode,
}: {
  shipping: any; extras: any;
  setShipping: (k: string, v: any) => void;
  setExtras: (k: string, v: any) => void;
  andreaniMode: string;
}) {
  const isMock = andreaniMode === "mock";
  return (
    <>
      <Card title="Métodos de envío" icon={<Truck className="w-4 h-4" />}>
        <Toggle
          label="Andreani"
          desc="Domicilio o sucursal. Requiere convenio con Andreani."
          checked={!!shipping.andreani_enabled}
          onChange={(v) => setShipping("andreani_enabled", v)}
        />
        <Toggle
          label="Correo Argentino"
          desc="Envío por Correo Argentino."
          checked={!!shipping.correo_argentino_enabled}
          onChange={(v) => setShipping("correo_argentino_enabled", v)}
        />
        <Toggle
          label="Envío personalizado / precio fijo"
          desc="Una opción con nombre y precio que vos definís."
          checked={!!shipping.custom_enabled}
          onChange={(v) => setShipping("custom_enabled", v)}
        >
          <div className="grid sm:grid-cols-2 gap-2.5">
            <Field label="Nombre" value={shipping.custom_label} onChange={(v) => setShipping("custom_label", v)} placeholder="Moto mensajería CABA" />
            <Field label="Precio ($)" type="number" value={(shipping.custom_price ?? 0).toString()} onChange={(v) => setShipping("custom_price", Number(v))} placeholder="3500" />
          </div>
        </Toggle>
      </Card>

      <Card title="Envío gratis y recargos" icon={<Percent className="w-4 h-4" />}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Envío gratis a partir de ($)"
            type="number"
            value={(extras.free_shipping_threshold ?? 0).toString()}
            onChange={(v) => setExtras("free_shipping_threshold", Number(v) || 0)}
            placeholder="0"
            hint="0 = desactivado. Si el subtotal supera este monto, el envío se muestra como gratis al cliente."
          />
          <Field
            label="Recargo sobre envío (%)"
            type="number"
            value={(extras.recargo_porcentaje ?? 0).toString()}
            onChange={(v) => setExtras("recargo_porcentaje", Number(v) || 0)}
            placeholder="0"
          />
          <Field
            label="Fee fijo sobre envío ($)"
            type="number"
            value={(extras.fee_fijo ?? 0).toString()}
            onChange={(v) => setExtras("fee_fijo", Number(v) || 0)}
            placeholder="0"
          />
          <Field
            label="Texto que ve la clienta antes de pagar"
            value={extras.note_for_customer}
            onChange={(v) => setExtras("note_for_customer", v)}
            placeholder="Te llega con Andreani en 24-72hs según zona."
            wide
          />
        </div>
      </Card>

      <Card
        title={`Andreani: modo ${andreaniMode}`}
        icon={isMock ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
        variant={isMock ? "warning" : "success"}
      >
        {isMock ? (
          <>
            <p className="text-xs text-ink-secondary">Datos simulados. Los envíos NO se generan realmente. Configurá las variables de entorno cuando tengas convenio:</p>
            <ul className="text-[11px] text-ink-soft mt-2 space-y-0.5 font-mono">
              <li>· ANDREANI_USER, ANDREANI_PASS</li>
              <li>· ANDREANI_CONTRATO_DOMICILIO, ANDREANI_CONTRATO_SUCURSAL</li>
              <li>· ANDREANI_CODIGO_CLIENTE</li>
              <li>· ANDREANI_MODE = sandbox | production</li>
            </ul>
          </>
        ) : (
          <p className="text-xs text-ink-secondary">Conectado a Andreani {andreaniMode === "production" ? "PRODUCCIÓN" : "Sandbox QA"}.</p>
        )}
      </Card>
    </>
  );
}

// ============================================================
// TAB: DIRECCIÓN DE ORIGEN
// ============================================================
function TabAddress({ origin, set }: { origin: any; set: (k: string, v: any) => void }) {
  return (
    <Card title="Dirección de origen (despacho)" icon={<Building2 className="w-4 h-4" />}>
      <p className="text-xs text-ink-soft -mt-1 mb-3">Va impresa en cada etiqueta de envío.</p>
      <div className="grid sm:grid-cols-2 gap-2.5">
        <Field label="Razón social *"      value={origin.razon_social}     onChange={(v) => set("razon_social", v)} />
        <Field label="Nombre comercial"    value={origin.nombre_comercial} onChange={(v) => set("nombre_comercial", v)} />
        <Field label="CUIT (sin guiones) *"value={origin.cuit}             onChange={(v) => set("cuit", v)} placeholder="30123456789" />
        <Field label="Email *"             value={origin.email}            onChange={(v) => set("email", v)} placeholder="cancerianas.kids@gmail.com" />
        <Field label="Teléfono"            value={origin.telefono}         onChange={(v) => set("telefono", v)} placeholder="+54911..." />
        <div />
        <Field label="Calle *"             value={origin.calle}            onChange={(v) => set("calle", v)} />
        <Field label="Número *"            value={origin.numero}           onChange={(v) => set("numero", v)} />
        <Field label="Piso"                value={origin.piso}             onChange={(v) => set("piso", v)} />
        <Field label="Depto"               value={origin.depto}            onChange={(v) => set("depto", v)} />
        <Field label="Localidad *"         value={origin.localidad}        onChange={(v) => set("localidad", v)} />
        <Field label="Provincia *"         value={origin.region}           onChange={(v) => set("region", v)} />
        <Field label="Código postal *"     value={origin.codigo_postal}    onChange={(v) => set("codigo_postal", v)} placeholder="1744" />
      </div>
    </Card>
  );
}

// ============================================================
// TAB: APARIENCIA
// ============================================================
function TabAppearance({ appearance, set }: { appearance: any; set: (k: string, v: any) => void }) {
  return (
    <>
      <Card title="Color principal" icon={<PaintBucket className="w-4 h-4" />}>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={appearance.primary_color ?? "#D44E7C"}
            onChange={(e) => set("primary_color", e.target.value)}
            className="h-12 w-16 rounded-xl border border-rose-pastel cursor-pointer"
          />
          <Field
            label=""
            value={appearance.primary_color}
            onChange={(v) => set("primary_color", v)}
            placeholder="#D44E7C"
          />
        </div>
        <p className="text-xs text-ink-soft mt-2">Por ahora aplica como CSS variable --color-brand-primary. Lo podés usar en estilos custom.</p>
      </Card>

      <Card title="Anuncio en la barra superior" icon={<Sparkles className="w-4 h-4" />}>
        <Toggle
          label="Mostrar banner de anuncio"
          desc="Aparece arriba de todo, abajo del banner de LIVE si hay LIVE."
          checked={!!appearance.show_announcement_bar}
          onChange={(v) => set("show_announcement_bar", v)}
        >
          <div className="space-y-2.5">
            <Field
              label="Texto"
              value={appearance.announcement_text}
              onChange={(v) => set("announcement_text", v)}
              placeholder="ENVÍO GRATIS en compras +$30.000 🌸"
            />
            <Field
              label="Link (opcional)"
              value={appearance.announcement_link}
              onChange={(v) => set("announcement_link", v)}
              placeholder="/shop"
              hint="Dejá vacío para que sea sólo texto."
            />
          </div>
        </Toggle>
      </Card>
    </>
  );
}

// ============================================================
// TAB: ANALYTICS
// ============================================================
function TabAnalytics({ analytics, set }: { analytics: any; set: (k: string, v: any) => void }) {
  return (
    <Card title="Pixeles y métricas" icon={<BarChart3 className="w-4 h-4" />}>
      <p className="text-xs text-ink-soft -mt-1 mb-3">Si dejás vacío un campo, ese pixel no se inyecta.</p>
      <div className="space-y-3">
        <Field
          label="Google Analytics 4 (ID)"
          value={analytics.ga4_id}
          onChange={(v) => set("ga4_id", v)}
          placeholder="G-XXXXXXXXXX"
          hint="Lo sacás de tu propiedad GA4. Empieza con G-."
        />
        <Field
          label="Facebook Pixel ID"
          value={analytics.fb_pixel_id}
          onChange={(v) => set("fb_pixel_id", v)}
          placeholder="000000000000000"
        />
        <Field
          label="TikTok Pixel ID"
          value={analytics.tiktok_pixel_id}
          onChange={(v) => set("tiktok_pixel_id", v)}
          placeholder="CXXXXXXXXXXXXXXXXXXX"
        />
      </div>
    </Card>
  );
}

// ============================================================
// TAB: SEO
// ============================================================
function TabSeo({ seo, set }: { seo: any; set: (k: string, v: any) => void }) {
  return (
    <Card title="SEO y compartir en redes" icon={<Search className="w-4 h-4" />}>
      <p className="text-xs text-ink-soft -mt-1 mb-3">Estos campos sobrescriben el título y descripción del sitio. Si los dejás vacíos se usan los defaults.</p>
      <div className="space-y-3">
        <Field
          label="Meta title (60 chars máx)"
          value={seo.meta_title}
          onChange={(v) => set("meta_title", v)}
          placeholder="Cancerianas — Para mujeres libres"
        />
        <Field
          label="Meta description (160 chars máx)"
          value={seo.meta_description}
          onChange={(v) => set("meta_description", v)}
          placeholder="Drops, LIVE shopping y oportunidades..."
        />
        <Field
          label="OG Image URL (1200x630)"
          value={seo.og_image_url}
          onChange={(v) => set("og_image_url", v)}
          placeholder="https://..."
          hint="Imagen que se muestra al compartir el sitio en redes."
        />
        <Field
          label="Keywords (separadas por coma)"
          value={seo.keywords}
          onChange={(v) => set("keywords", v)}
          placeholder="cancerianas, tienda, ofertas, live shopping"
        />
      </div>
    </Card>
  );
}

// ============================================================
// TAB: OPERACIÓN
// ============================================================
function TabOperation({ maintenance, set }: { maintenance: any; set: (k: string, v: any) => void }) {
  return (
    <Card title="Estado de la tienda" icon={<Power className="w-4 h-4" />}>
      <Toggle
        label="Modo mantenimiento"
        desc="Cuando está activo, los clientes ven un mensaje y no pueden navegar la tienda."
        checked={!!maintenance.enabled}
        onChange={(v) => set("enabled", v)}
      >
        <div className="space-y-2.5">
          <Field
            label="Mensaje a mostrar"
            value={maintenance.message}
            onChange={(v) => set("message", v)}
            placeholder="Volvemos en un toque 🌸..."
            wide
          />
          <Toggle
            label="Permitir admins durante mantenimiento"
            desc="Si está prendido, vos seguís pudiendo navegar la tienda."
            checked={!!maintenance.allow_admins}
            onChange={(v) => set("allow_admins", v)}
          />
        </div>
      </Toggle>

      <p className="text-xs text-ink-soft mt-4">
        ¿Querés gestionar el horario de apertura por drops? Andá a <a href="/admin/store" className="text-rose-deep font-semibold hover:underline">/admin/store</a> — eso es independiente del modo mantenimiento.
      </p>
    </Card>
  );
}

// ============================================================
// TAB: COLA VIRTUAL
// ============================================================
function TabQueue({
  queue,
  set,
}: {
  queue: QueueSettings;
  set: (k: string, v: any) => void;
}) {
  const scope: QueueSettings["scope"] = queue.scope ?? [];
  function toggleScope(key: QueueSettings["scope"][number]) {
    const next = scope.includes(key) ? scope.filter((s) => s !== key) : [...scope, key];
    set("scope", next);
  }

  return (
    <>
      <Card title="Cola virtual / urgencia" icon={<Users className="w-4 h-4" />}>
        <p className="text-xs text-ink-soft -mt-1 mb-3">
          Mostrá un popup tipo "estás en la cola" con un cangrejito 🦀 corriendo, cuando hay mucha gente en el shop. Sirve para generar urgencia en drops.
        </p>

        <Toggle
          label="Activar cola virtual"
          desc="Cuando llega al umbral, los clientes ven el popup una vez por sesión."
          checked={!!queue.enabled}
          onChange={(v) => set("enabled", v)}
        >
          <div className="space-y-4 pt-2">
            <Divider title="Umbral y números" />
            <div className="grid sm:grid-cols-2 gap-3">
              <NumberField
                label="Viewers concurrentes para gatillar"
                value={queue.threshold}
                min={2}
                onChange={(v) => set("threshold", v)}
                help="Cantidad mínima de personas viendo el shop al mismo tiempo (real-time) para activar el popup."
              />
              <NumberField
                label="Multiplicador"
                value={queue.multiplier}
                min={1}
                step={0.5}
                onChange={(v) => set("multiplier", v)}
                help='Multiplica los viewers reales para mostrar el número "gente adelante". 1 = honesto, 5 = inflado.'
              />
              <NumberField
                label="Piso mínimo (offset)"
                value={queue.min_offset}
                min={0}
                onChange={(v) => set("min_offset", v)}
                help="Si viewers × multiplicador queda bajo, se usa este número como mínimo (ej: 40 ⇒ nunca arranca con menos de 40)."
              />
              <NumberField
                label="Duración de la cola (segundos)"
                value={queue.duration_sec}
                min={30}
                onChange={(v) => set("duration_sec", v)}
                help="Cuánto dura el popup desde que aparece hasta que se cierra solo. Recomendado: 180-300s."
              />
            </div>

            <Divider title="Páginas donde se dispara" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["shop", "category", "product", "checkout"] as const).map((s) => {
                const active = scope.includes(s);
                const labels: Record<typeof s, string> = {
                  shop: "Tienda",
                  category: "Categorías",
                  product: "Producto",
                  checkout: "Checkout",
                };
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleScope(s)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${
                      active
                        ? "bg-rose-deep text-white border-rose-deep"
                        : "bg-white text-ink-secondary border-rose-pastel hover:bg-rose-whisper"
                    }`}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-soft">
              Marcá las páginas donde querés que se dispare. El popup aparece <strong>una sola vez por sesión</strong> de navegación.
            </p>
          </div>
        </Toggle>
      </Card>

      <Card title="⚠️ Advertencia legal y de marca" icon={<AlertCircle className="w-4 h-4" />} variant="warning">
        <p className="text-xs text-ink-soft leading-relaxed">
          Inflar el número de gente comprando puede caer bajo <strong>"publicidad engañosa"</strong> en la Ley de Defensa del Consumidor (24.240) en Argentina. Si una clienta saca una captura comparando con la realidad y lo publica en redes, el daño a la marca puede ser fuerte.
        </p>
        <p className="text-xs text-ink-soft leading-relaxed mt-2">
          <strong>Recomendación:</strong> mantené el <em>multiplicador en 1-2</em> en el día a día (honesto + algo de buffer) y subilo solo durante drops grandes donde realmente hay tráfico alto. Eso te da el efecto urgencia sin mentir a fondo.
        </p>
      </Card>
    </>
  );
}

// ============================================================
// COMPONENTES PRIMITIVOS
// ============================================================

function Card({
  title, icon, children, variant = "default",
}: {
  title: string; icon?: React.ReactNode; children: React.ReactNode;
  variant?: "default" | "success" | "warning";
}) {
  const variantCls =
    variant === "success" ? "border-success/40 bg-success/5"
    : variant === "warning" ? "border-warning/40 bg-warning/5"
    : "";
  return (
    <section className={`card !p-5 space-y-3 ${variantCls}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon && (
          <span className={`w-7 h-7 rounded-full flex items-center justify-center ${
            variant === "warning" ? "bg-warning/20 text-warning" :
            variant === "success" ? "bg-success/20 text-success" :
            "bg-rose-whisper text-rose-deep"
          }`}>{icon}</span>
        )}
        <h2 className="font-display text-base text-ink-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <span className="text-[11px] uppercase tracking-widest font-semibold text-ink-soft">{title}</span>
      <div className="flex-1 h-px bg-rose-pastel" />
    </div>
  );
}

/**
 * Toggle compacto: TODA la card es un button. Clickear cualquier parte de
 * la cabecera dispara onChange. Cuando está abierto y hay children, ellos
 * NO toggle (van adentro de un div hermano fuera del button).
 */
function Toggle({
  label, desc, checked, onChange, children,
}: {
  label: string; desc?: string; checked: boolean;
  onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-3 transition-colors ${
      checked ? "border-success/40 bg-success/5" : "border-rose-pastel"
    }`}>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer select-none"
        aria-pressed={checked}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-primary leading-tight">{label}</p>
          {desc && <p className="text-[11px] text-ink-soft leading-snug mt-0.5">{desc}</p>}
        </div>
        <SwitchVisual checked={checked} />
      </button>
      {checked && children && (
        <div className="mt-3 pt-3 border-t border-rose-pastel/60">{children}</div>
      )}
    </div>
  );
}

function SwitchVisual({ checked }: { checked: boolean }) {
  return (
    <span
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
        checked ? "bg-success" : "bg-rose-pastel"
      }`}
    >
      <span
        className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </span>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", hint, wide,
}: {
  label: string; value: any; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string; wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      {label && <label className="block text-xs font-semibold text-ink-secondary mb-1">{label}</label>}
      <input
        className="input !h-10 !text-sm w-full"
        type={type}
        value={value ?? ""}
        onFocus={type === "number" ? (e) => e.target.select() : undefined}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="text-[10px] text-ink-soft mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

function NumberField({
  label, value, onChange, min, step = 1, help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink-secondary mb-1">{label}</label>
      <input
        className="input !h-10 !text-sm w-full"
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
      {help && <p className="text-[10px] text-ink-soft mt-1 leading-snug">{help}</p>}
    </div>
  );
}

// Re-import del icono "Sparkles" para el anuncio. Está en lucide-react.
function Sparkles({ className }: { className?: string }) {
  // Usamos el mismo nombre que ya importamos arriba con alias BrandIcon, pero
  // necesitamos uno propio para esta sección sin colisionar.
  return <BrandIcon className={className} />;
}
