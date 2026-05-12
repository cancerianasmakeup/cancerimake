import Link from "next/link";
import { Plus, Sparkles, Search } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice } from "@cancerianas/shared";
import type { LiveEventStats } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

const TYPE_EMOJI: Record<string, string> = {
  capsulas: "💊",
  sobres: "✉️",
  bolsitas: "🎀",
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-ink-soft/20 text-ink-soft" },
  active: { label: "EN VIVO", color: "bg-rose-deep text-white animate-soft-pulse" },
  paused: { label: "Pausado", color: "bg-warning/30 text-ink-primary" },
  finished: { label: "Finalizado", color: "bg-success/30 text-ink-primary" },
};

export default async function AdminLive({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; from?: string; to?: string; q?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const supabase = await createSupabaseServer();

  let query = supabase.from("live_event_stats").select("*").order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to + "T23:59:59");
  if (params.q) query = query.ilike("title", `%${params.q}%`);

  const { data: events } = await query;
  const list = (events as LiveEventStats[]) ?? [];

  // Totales agregados
  const totalRevenue = list.reduce((s, e) => s + Number(e.revenue), 0);
  const totalPaid = list.reduce((s, e) => s + e.paid_count, 0);
  const totalPending = list.reduce((s, e) => s + e.pending_count, 0);

  const STATUS_FILTERS = [
    { value: "all", label: "Todos" },
    { value: "active", label: "En vivo" },
    { value: "draft", label: "Borrador" },
    { value: "finished", label: "Finalizados" },
    { value: "paused", label: "Pausados" },
  ];

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Eventos LIVE</h1>
          <p className="text-ink-secondary mt-1">{list.length} eventos · historial completo</p>
        </div>
        <Link href="/admin/live/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo
        </Link>
      </div>

      {/* TOTALES (siempre que haya filtro aplicado o varios eventos) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="card text-center p-4">
          <div className="text-[10px] uppercase text-ink-soft tracking-wider">Recaudación total</div>
          <div className="font-display text-2xl text-rose-deep font-bold mt-1">
            {formatPrice(totalRevenue)}
          </div>
        </div>
        <div className="card text-center p-4">
          <div className="text-[10px] uppercase text-ink-soft tracking-wider">Compras pagadas</div>
          <div className="font-display text-2xl text-ink-primary mt-1">{totalPaid}</div>
        </div>
        <div className="card text-center p-4 bg-rose-deep/5">
          <div className="text-[10px] uppercase text-ink-soft tracking-wider">Pendientes guardados</div>
          <div className="font-display text-2xl text-rose-deep mt-1">{totalPending}</div>
        </div>
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
              placeholder="Buscar por título..."
              className="input pl-10"
            />
          </div>
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="input w-auto text-sm"
            title="Desde"
          />
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="input w-auto text-sm"
            title="Hasta"
          />
          <select name="status" defaultValue={params.status ?? "all"} className="input w-auto text-sm">
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary text-sm">
            Filtrar
          </button>
          {(params.q || params.from || params.to || params.status) && (
            <Link href="/admin/live" className="text-sm text-ink-soft hover:text-rose-deep">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {/* LISTA */}
      {list.length === 0 ? (
        <div className="card text-center py-16">
          <Sparkles className="w-12 h-12 mx-auto text-rose-deep mb-3" />
          <p className="text-ink-secondary mb-4">No hay eventos con esos filtros.</p>
          <Link href="/admin/live/new" className="btn-primary inline-flex">
            Crear el primero
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((ev) => {
            const badge = STATUS_BADGE[ev.status];
            return (
              <Link
                key={ev.id}
                href={`/admin/live/${ev.id}`}
                className="card flex items-center gap-4 hover:shadow-lift transition-all hover:-translate-y-0.5"
              >
                <div className="text-4xl">{TYPE_EMOJI[ev.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-ink-soft">{ev.type}</span>
                    {ev.pending_count > 0 && (
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-rose-deep text-white">
                        🔖 {ev.pending_count} pend
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-lg text-ink-primary line-clamp-1">{ev.title}</h3>
                  <p className="text-xs text-ink-soft mt-0.5">
                    {ev.started_at
                      ? `📅 ${new Date(ev.started_at).toLocaleString("es-AR")}`
                      : `Creado ${new Date(ev.created_at).toLocaleDateString("es-AR")}`}
                  </p>
                </div>
                <div className="hidden sm:block text-right">
                  <p className="font-bold text-rose-deep">{formatPrice(Number(ev.revenue))}</p>
                  <p className="text-xs text-ink-soft">
                    {ev.paid_count} pagadas · {ev.paid_buyers} clientas
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
