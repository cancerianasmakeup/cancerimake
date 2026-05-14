import Link from "next/link";
import { Plus, Truck, Package, Search, PackagePlus, ArrowRight, HandCoins } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice, CARRIER_LABELS, type ShipmentCarrier } from "@cancerianas/shared";
import type { Shipment } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; color: string; emoji: string }> = {
  pending_address:      { label: "Esperando dirección",        color: "bg-warning/30 text-ink-primary", emoji: "📝" },
  pending_custom_quote: { label: "Cotizar personalizado",      color: "bg-rose-deep text-white animate-soft-pulse", emoji: "🤝" },
  pending_quote:        { label: "Cotizar personalizado",      color: "bg-rose-deep text-white animate-soft-pulse", emoji: "🤝" },
  pending_payment:      { label: "Esperando pago",             color: "bg-warning/40 text-ink-primary", emoji: "⏳" },
  pending_approval:     { label: "Aprobar comprobante",        color: "bg-rose-deep text-white animate-soft-pulse", emoji: "🔔" },
  paid:                 { label: "Pagado",                     color: "bg-success/40 text-ink-primary animate-soft-pulse", emoji: "💚" },
  label_generated:      { label: "Etiqueta lista",             color: "bg-rose-deep text-white", emoji: "🏷️" },
  dispatched:           { label: "Despachado",                 color: "bg-rose-medium text-ink-primary", emoji: "📦" },
  in_transit:           { label: "En tránsito",                color: "bg-rose-pastel text-ink-primary", emoji: "🚚" },
  out_for_delivery:     { label: "En reparto",                 color: "bg-rose-pastel text-ink-primary", emoji: "🚪" },
  delivered:            { label: "Entregado",                  color: "bg-success/30 text-ink-primary", emoji: "✅" },
  returned:             { label: "Devuelto",                   color: "bg-error/20 text-ink-primary", emoji: "↩️" },
  failed:               { label: "Falló",                      color: "bg-error/30 text-ink-primary", emoji: "⚠️" },
  cancelled:            { label: "Cancelado",                  color: "bg-ink-soft/15 text-ink-soft", emoji: "❌" },
};

export default async function AdminShipmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; q?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const supabase = await createSupabaseServer();

  // Conteo de paquetes pendientes para el banner
  const { count: pendingPkgsCount } = await supabase
    .from("pending_packages")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // Conteo de shipments esperando cotización personalizada
  const { count: customQuotePendingCount } = await supabase
    .from("shipments")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_custom_quote");

  let query = supabase
    .from("shipments")
    .select("*, profiles!user_id(full_name, email, phone)")
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data: shipments } = await query;
  const list = (shipments as any[]) ?? [];

  // Filtro client-side por search en nombre/email
  const filtered = params.q
    ? list.filter((s) =>
        (s.profiles?.full_name + " " + s.profiles?.email + " " + s.description)
          .toLowerCase()
          .includes(params.q!.toLowerCase())
      )
    : list;

  const stats = {
    pending: list.filter((s) => s.status === "pending_address" || s.status === "pending_payment").length,
    paidWaiting: list.filter((s) => s.status === "paid").length,
    inTransit: list.filter((s) =>
      ["dispatched", "in_transit", "out_for_delivery", "label_generated"].includes(s.status)
    ).length,
    delivered: list.filter((s) => s.status === "delivered").length,
  };

  const STATUS_FILTERS = [
    "all",
    "pending_address",
    "pending_custom_quote",
    "pending_payment",
    "paid",
    "label_generated",
    "dispatched",
    "in_transit",
    "delivered",
  ];

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Envíos</h1>
          <p className="text-ink-secondary mt-1">{list.length} envíos en total</p>
        </div>
        <Link href="/admin/shipments/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo envío
        </Link>
      </div>

      {/* CUSTOM QUOTE PENDING banner */}
      {customQuotePendingCount && customQuotePendingCount > 0 ? (
        <Link
          href="/admin/shipments?status=pending_custom_quote"
          className="card mb-4 flex items-center gap-4 hover:shadow-lift transition border-l-4 border-rose-deep bg-gradient-to-r from-rose-pastel via-rose-whisper to-white"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-deep text-white flex items-center justify-center text-2xl flex-shrink-0">
            🤝
          </div>
          <div className="flex-1">
            <p className="font-display text-lg text-ink-primary">
              <strong>{customQuotePendingCount}</strong> cliente{customQuotePendingCount === 1 ? "" : "s"} esperando cotización personalizada
            </p>
            <p className="text-sm text-ink-soft">
              Pidieron un envío fuera de Andreani/Correo. Cargales el precio cuando lo acuerden.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-rose-deep flex-shrink-0" />
        </Link>
      ) : null}

      {/* PENDING PACKAGES banner */}
      {pendingPkgsCount && pendingPkgsCount > 0 ? (
        <Link
          href="/admin/shipments/pending"
          className="card mb-4 flex items-center gap-4 hover:shadow-lift transition border-l-4 border-rose-deep bg-rose-whisper/60"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-deep text-white flex items-center justify-center text-2xl flex-shrink-0">
            📦
          </div>
          <div className="flex-1">
            <p className="font-display text-lg text-ink-primary">
              Tenés <strong>{pendingPkgsCount}</strong> paquete{pendingPkgsCount === 1 ? "" : "s"} esperando despacho
            </p>
            <p className="text-sm text-ink-soft">
              Mercadería separada en dinámicas que todavía no consolidaste en envío.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-rose-deep flex-shrink-0" />
        </Link>
      ) : null}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Esperando clienta" value={stats.pending} icon="📝" />
        <StatCard label="Listos p/ etiquetar" value={stats.paidWaiting} icon="💚" highlight />
        <StatCard label="En tránsito" value={stats.inTransit} icon="🚚" />
        <StatCard label="Entregados" value={stats.delivered} icon="✅" />
      </div>

      {/* FILTROS */}
      <form className="card p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar por clienta o descripción..."
              className="input pl-10"
            />
          </div>
          <select name="status" defaultValue={params.status ?? "all"} className="input w-auto text-sm">
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Todos" : STATUS_META[s]?.label ?? s}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary text-sm">
            Filtrar
          </button>
        </div>
      </form>

      {/* TABLE */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-rose-whisper">
            <tr className="text-left text-ink-soft uppercase text-[10px]">
              <th className="p-3">Estado</th>
              <th className="p-3">Clienta</th>
              <th className="p-3">Descripción</th>
              <th className="p-3">Peso</th>
              <th className="p-3">Costo</th>
              <th className="p-3">Tracking</th>
              <th className="p-3">Creado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <Truck className="w-10 h-10 mx-auto text-ink-soft mb-2" />
                  <p className="text-ink-soft mb-3">
                    {list.length === 0 ? "Todavía no creaste ningún envío" : "No hay envíos con esos filtros"}
                  </p>
                  {list.length === 0 && (
                    <Link href="/admin/shipments/new" className="text-rose-deep font-semibold">
                      Crear el primero →
                    </Link>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const meta = STATUS_META[s.status] ?? { label: s.status, color: "bg-ink-soft/20 text-ink-soft", emoji: "•" };
                return (
                  <tr key={s.id} className="border-t border-rose-pastel hover:bg-rose-whisper/40">
                    <td className="p-3">
                      <Link href={`/admin/shipments/${s.id}`} className="block">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${meta.color}`}>
                          {meta.emoji} {meta.label}
                        </span>
                      </Link>
                    </td>
                    <td className="p-3">
                      <Link href={`/admin/shipments/${s.id}`} className="block">
                        <div className="font-semibold text-ink-primary line-clamp-1">
                          {s.profiles?.full_name || "—"}
                        </div>
                        <div className="text-xs text-ink-soft line-clamp-1">{s.profiles?.email}</div>
                      </Link>
                    </td>
                    <td className="p-3 text-ink-secondary">
                      <Link href={`/admin/shipments/${s.id}`} className="line-clamp-2 max-w-[260px]">
                        {s.description}
                      </Link>
                    </td>
                    <td className="p-3 text-ink-secondary">{(s.weight_grams / 1000).toFixed(2)}kg</td>
                    <td className="p-3 font-bold text-rose-deep">
                      {s.cost_charged ? formatPrice(Number(s.cost_charged)) : "—"}
                    </td>
                    <td className="p-3 font-mono text-xs text-ink-soft">
                      <div>{s.carrier_tracking_number ?? s.andreani_tracking_number ?? "—"}</div>
                      <div className="text-[10px] uppercase text-ink-soft mt-0.5">
                        {CARRIER_LABELS[(s.carrier as ShipmentCarrier) ?? "andreani"]}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-ink-soft">
                      {new Date(s.created_at).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: string; highlight?: boolean }) {
  return (
    <div className={`card text-center p-4 ${highlight && value > 0 ? "ring-2 ring-rose-deep" : ""}`}>
      <div className="text-2xl">{icon}</div>
      <div className="text-[10px] uppercase text-ink-soft tracking-wider mt-1">{label}</div>
      <div className={`font-display text-2xl mt-0.5 ${highlight && value > 0 ? "text-rose-deep" : "text-ink-primary"}`}>
        {value}
      </div>
    </div>
  );
}
