"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Save,
  Plus,
  Trash2,
  Power,
  Calendar,
  Clock,
  MessageCircle,
  Sparkles,
  Users,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  getStoreStatus,
  getCountdown,
  makeDropId,
  type StoreStatusConfig,
  type StoreDrop,
  type StoreForceState,
} from "@cancerianas/shared";

export default function StoreStatusForm({
  initial,
  subscribersCount,
}: {
  initial: StoreStatusConfig;
  subscribersCount: number;
}) {
  const supabase = createSupabaseBrowser();
  const [config, setConfig] = useState<StoreStatusConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  // Tick para que el preview de estado se actualice cada segundo
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const status = useMemo(() => getStoreStatus(config, now), [config, now]);

  function patch(p: Partial<StoreStatusConfig>) {
    setConfig((c) => ({ ...c, ...p }));
  }

  function addDrop() {
    // Default: próximo viernes 20:00 → 23:00
    const start = new Date();
    const daysUntilFriday = (5 - start.getDay() + 7) % 7 || 7;
    start.setDate(start.getDate() + daysUntilFriday);
    start.setHours(20, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 0, 0, 0);
    const newDrop: StoreDrop = {
      id: makeDropId(),
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      label: "Drop de oportunidades",
    };
    patch({ drops: [...config.drops, newDrop] });
  }

  function updateDrop(id: string, p: Partial<StoreDrop>) {
    patch({ drops: config.drops.map((d) => (d.id === id ? { ...d, ...p } : d)) });
  }

  function removeDrop(id: string) {
    patch({ drops: config.drops.filter((d) => d.id !== id) });
  }

  async function save() {
    // Validación: ends_at > starts_at
    for (const d of config.drops) {
      if (new Date(d.ends_at) <= new Date(d.starts_at)) {
        toast.error(`El drop "${d.label || "sin nombre"}" cierra antes de abrir.`);
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "store_status", value: config });
    setSaving(false);
    if (error) toast.error("Error: " + error.message);
    else toast.success("Tienda actualizada 🌸");
  }

  const cd = getCountdown(status.isOpen ? status.closesAt : status.opensAt, now);

  return (
    <div className="space-y-6">
      {/* Estado en vivo */}
      <div
        className={`card border-2 ${
          status.isOpen ? "border-success/50 bg-success/5" : "border-warning/50 bg-warning/5"
        }`}
      >
        <div className="flex items-start gap-4">
          {status.isOpen ? (
            <Unlock className="w-7 h-7 text-success flex-shrink-0 mt-1" />
          ) : (
            <Lock className="w-7 h-7 text-warning flex-shrink-0 mt-1" />
          )}
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider font-semibold text-ink-soft">
              Estado actual
            </div>
            <h2 className="font-display text-2xl text-ink-primary mt-0.5">
              {status.isOpen ? "Tienda ABIERTA" : "Tienda CERRADA"}
            </h2>
            <p className="text-sm text-ink-secondary mt-1">
              {status.reason === "force_open" && "Override manual: abierta a la fuerza."}
              {status.reason === "force_closed" && "Override manual: cerrada a la fuerza."}
              {status.reason === "in_drop" &&
                `Drop activo: ${status.activeDrop?.label || "sin nombre"}.`}
              {status.reason === "between_drops" &&
                `Próximo drop: ${status.nextDrop?.label || "sin nombre"}.`}
              {status.reason === "no_drop" && "No hay drops programados."}
            </p>
            {!cd.expired && (status.closesAt || status.opensAt) && (
              <div className="mt-4 inline-flex items-center gap-3 bg-white px-4 py-3 rounded-2xl">
                <Clock className="w-4 h-4 text-rose-deep" />
                <span className="text-sm text-ink-soft">
                  {status.isOpen ? "Cierra en" : "Abre en"}
                </span>
                <span className="font-mono font-bold text-ink-primary text-lg tabular-nums">
                  {cd.days > 0 && `${cd.days}d `}
                  {String(cd.hours).padStart(2, "0")}:
                  {String(cd.minutes).padStart(2, "0")}:
                  {String(cd.seconds).padStart(2, "0")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suscriptoras */}
      <div className="card flex items-center gap-4 bg-rose-pastel/30">
        <div className="w-12 h-12 rounded-2xl bg-rose-deep/10 flex items-center justify-center">
          <Users className="w-6 h-6 text-rose-deep" />
        </div>
        <div className="flex-1">
          <div className="font-display text-xl text-ink-primary">
            {subscribersCount} {subscribersCount === 1 ? "persona suscripta" : "personas suscriptas"}
          </div>
          <p className="text-sm text-ink-soft">
            Dejaron mail/whatsapp para que les avises del próximo drop.
          </p>
        </div>
        <a
          href="/admin/store/subscribers"
          className="text-sm font-semibold text-rose-deep hover:underline"
        >
          Ver lista →
        </a>
      </div>

      {/* Override manual */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <Power className="w-5 h-5 text-rose-deep" />
          <h2 className="font-display text-xl text-ink-primary">Control manual</h2>
        </div>
        <p className="text-sm text-ink-soft mb-4">
          Sobrescribe los drops temporalmente. Útil para abrir de improviso después de un live, o
          cerrar de urgencia.
        </p>

        <div className="grid sm:grid-cols-3 gap-2 mb-4">
          {(["auto", "open", "closed"] as StoreForceState[]).map((s) => {
            const label =
              s === "auto" ? "Automático (drops)" : s === "open" ? "Forzar abierta" : "Forzar cerrada";
            const active = config.force_state === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => patch({ force_state: s })}
                className={`py-3 px-4 rounded-2xl border-2 font-semibold transition ${
                  active
                    ? s === "open"
                      ? "border-success bg-success/10 text-success"
                      : s === "closed"
                      ? "border-warning bg-warning/10 text-warning"
                      : "border-rose-deep bg-rose-pastel text-rose-deep"
                    : "border-rose-pastel bg-white text-ink-secondary hover:border-rose-medium"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {config.force_state !== "auto" && (
          <div>
            <label className="block text-sm font-semibold text-ink-secondary mb-1.5">
              {config.force_state === "open" ? "Mantener abierta hasta" : "Mantener cerrada hasta"}{" "}
              <span className="font-normal text-ink-soft">(opcional — vacío = sin límite)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                className="input flex-1"
                value={toLocalInput(config.force_until)}
                onChange={(e) =>
                  patch({ force_until: e.target.value ? fromLocalInput(e.target.value) : null })
                }
              />
              {config.force_until && (
                <button
                  type="button"
                  onClick={() => patch({ force_until: null })}
                  className="px-3 rounded-2xl border border-rose-pastel hover:bg-rose-pastel/40 text-sm"
                >
                  Sin límite
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Drops */}
      <div className="card">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-rose-deep" />
              <h2 className="font-display text-xl text-ink-primary">Drops programados</h2>
            </div>
            <p className="text-sm text-ink-soft mt-1">
              Cada drop es una ventana donde la tienda abre automáticamente. Cuando llega la fecha,
              la tienda se abre sola; cuando termina, se cierra sola.
            </p>
          </div>
          <button type="button" onClick={addDrop} className="btn-primary text-sm whitespace-nowrap">
            <Plus className="w-4 h-4" /> Nuevo drop
          </button>
        </div>

        {config.drops.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-rose-pastel rounded-2xl">
            <div className="text-4xl mb-2">📅</div>
            <p className="text-ink-soft text-sm">
              Todavía no programaste ningún drop. Tocá <strong>Nuevo drop</strong> para crear el
              primero.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...config.drops]
              .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
              .map((drop) => (
                <DropEditor
                  key={drop.id}
                  drop={drop}
                  now={now}
                  onChange={(p) => updateDrop(drop.id, p)}
                  onRemove={() => removeDrop(drop.id)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Mensajes */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="w-5 h-5 text-rose-deep" />
          <h2 className="font-display text-xl text-ink-primary">Mensajes y links</h2>
        </div>
        <p className="text-sm text-ink-soft mb-4">
          Lo que ven las clientas en la landing cuando la tienda está cerrada y en el banner cuando
          está abierta.
        </p>

        <div className="space-y-4">
          <Field
            label="Título cuando está cerrada"
            value={config.closed_title}
            onChange={(v) => patch({ closed_title: v })}
            placeholder="Volvemos pronto"
          />
          <Field
            label="Mensaje principal cuando está cerrada"
            value={config.closed_message}
            onChange={(v) => patch({ closed_message: v })}
            placeholder="Cerramos para preparar el próximo drop con ofertas exclusivas."
            multiline
          />
          <Field
            label="Subtítulo / CTA"
            value={config.closed_subtitle}
            onChange={(v) => patch({ closed_subtitle: v })}
            placeholder="Te avisamos cuando abrimos. Mientras tanto seguinos en TikTok."
            multiline
          />
          <Field
            label="Banner cuando está abierta"
            value={config.open_banner_text}
            onChange={(v) => patch({ open_banner_text: v })}
            placeholder="⚡ TIENDA ABIERTA · ofertas exclusivas por tiempo limitado"
          />

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-rose-pastel">
            <Field
              label="Link a TikTok"
              value={config.tiktok_url}
              onChange={(v) => patch({ tiktok_url: v })}
              placeholder="https://www.tiktok.com/@cancerianas"
            />
            <Field
              label="Link a Instagram (opcional)"
              value={config.instagram_url}
              onChange={(v) => patch({ instagram_url: v })}
              placeholder="https://www.instagram.com/cancerianas"
            />
          </div>
        </div>
      </div>

      {/* Aviso si no hay drops y tampoco override */}
      {config.drops.length === 0 && config.force_state === "auto" && (
        <div className="card border border-warning/40 bg-warning/5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong className="text-ink-primary">La tienda está cerrada permanentemente.</strong>
            <p className="text-ink-secondary mt-0.5">
              No hay drops programados ni override manual. Las clientas verán el countdown sin fecha
              y solo el CTA de TikTok.
            </p>
          </div>
        </div>
      )}

      {status.isOpen && config.force_state === "auto" && config.drops.length > 0 && (
        <div className="card border border-success/40 bg-success/5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong className="text-ink-primary">Todo en orden.</strong>
            <p className="text-ink-secondary mt-0.5">
              La tienda está abierta dentro del drop programado. Las clientas pueden comprar con
              normalidad.
            </p>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 md:mx-0 px-4 py-4 bg-cream/95 backdrop-blur border-t border-rose-pastel md:rounded-2xl md:border md:shadow-lift md:bg-white">
        <button onClick={save} disabled={saving} className="btn-primary w-full md:w-auto">
          <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

function DropEditor({
  drop,
  now,
  onChange,
  onRemove,
}: {
  drop: StoreDrop;
  now: Date;
  onChange: (p: Partial<StoreDrop>) => void;
  onRemove: () => void;
}) {
  const supabase = createSupabaseBrowser();
  const [notifying, setNotifying] = useState(false);

  async function notifySubscribers() {
    if (
      !window.confirm(
        `¿Mandar el aviso de apertura de "${drop.label || "este drop"}" a las suscriptas que aún no recibieron notificación?`
      )
    )
      return;
    setNotifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-drop-open", {
        body: { dropId: drop.id },
      });
      if (error) throw error;
      const sent = data?.notified ?? 0;
      const errors = data?.errors ?? 0;
      if (sent === 0 && errors === 0) {
        toast.success("Listo, pero ya estaban todas notificadas o no hay suscriptas todavía.");
      } else if (errors > 0) {
        toast.warning(`Enviadas ${sent}, fallaron ${errors}. Revisá los logs.`);
      } else {
        toast.success(`✨ Avisamos a ${sent} ${sent === 1 ? "persona" : "personas"}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Error invocando la función");
    } finally {
      setNotifying(false);
    }
  }
  const startMs = new Date(drop.starts_at).getTime();
  const endMs = new Date(drop.ends_at).getTime();
  const nowMs = now.getTime();
  const state =
    nowMs < startMs ? "scheduled" : nowMs <= endMs ? "active" : "expired";
  const stateBadge = {
    scheduled: { label: "Programado", color: "bg-rose-pastel text-rose-deep" },
    active: { label: "ACTIVO AHORA", color: "bg-success/15 text-success" },
    expired: { label: "Finalizado", color: "bg-ink-soft/15 text-ink-soft" },
  }[state];

  return (
    <div
      className={`rounded-2xl border-2 p-4 transition ${
        state === "active" ? "border-success bg-success/5" : "border-rose-pastel bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <input
            value={drop.label ?? ""}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Nombre del drop"
            className="font-display text-lg text-ink-primary bg-transparent border-0 p-0 w-full focus:outline-none focus:ring-0"
          />
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${stateBadge.color}`}
          >
            {stateBadge.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-2 rounded-full hover:bg-error/10 text-error"
          aria-label="Eliminar drop"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1">
            Abre
          </label>
          <input
            type="datetime-local"
            className="input"
            value={toLocalInput(drop.starts_at)}
            onChange={(e) => onChange({ starts_at: fromLocalInput(e.target.value) })}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1">
            Cierra
          </label>
          <input
            type="datetime-local"
            className="input"
            value={toLocalInput(drop.ends_at)}
            onChange={(e) => onChange({ ends_at: fromLocalInput(e.target.value) })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {QUICK_DURATIONS.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => {
              const start = new Date(drop.starts_at);
              const end = new Date(start.getTime() + q.ms);
              onChange({ ends_at: end.toISOString() });
            }}
            className="text-xs px-3 py-1.5 rounded-full bg-rose-pastel/60 hover:bg-rose-pastel text-rose-deep font-medium"
          >
            +{q.label}
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-rose-pastel/60 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-ink-soft">
          Mandá el aviso a las suscriptas. Idempotente: cada subscriber recibe una sola vez por
          drop.
        </p>
        <button
          type="button"
          onClick={notifySubscribers}
          disabled={notifying || state === "expired"}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-deep text-white text-xs font-bold hover:bg-rose-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          {notifying ? "Enviando..." : "Notificar suscriptas"}
        </button>
      </div>
    </div>
  );
}

const QUICK_DURATIONS = [
  { label: "1h", ms: 1 * 3600_000 },
  { label: "3h", ms: 3 * 3600_000 },
  { label: "6h", ms: 6 * 3600_000 },
  { label: "24h", ms: 24 * 3600_000 },
  { label: "3 días", ms: 3 * 86400_000 },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // datetime-local espera "YYYY-MM-DDTHH:mm" en hora local
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  // El input devuelve hora local; lo convierto a ISO UTC preservando el momento
  const d = new Date(local);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-ink-secondary mb-1.5">{label}</label>
      {multiline ? (
        <textarea
          rows={2}
          className="input"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="input"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
