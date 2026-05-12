"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Sparkles,
  Lock,
  Unlock,
  ShoppingBag,
  Clock,
  StickyNote,
  Search,
  Save,
  Bookmark,
  X as XIcon,
  CheckCircle2,
  PackagePlus,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { formatPrice, offerAvailable } from "@cancerianas/shared";
import type { LiveEvent, LiveOffer, LivePurchase, LivePurchaseStatus } from "@cancerianas/shared";

type PurchaseRow = LivePurchase & {
  profiles?: { full_name: string | null; email: string; phone: string | null };
  live_offers?: { name: string };
  attended_at?: string | null;
  attended_by?: string | null;
};

const STATUS_META: Record<LivePurchaseStatus, { label: string; color: string; emoji: string }> = {
  paid: { label: "Pagada", color: "bg-success/30 text-ink-primary", emoji: "✅" },
  paying: { label: "Pagando", color: "bg-warning/40 text-ink-primary animate-pulse", emoji: "💳" },
  queued: { label: "En fila", color: "bg-rose-medium/40 text-ink-primary", emoji: "🕐" },
  expired: { label: "Expirada", color: "bg-ink-soft/20 text-ink-soft", emoji: "⌛" },
  cancelled: { label: "Cancelada", color: "bg-ink-soft/15 text-ink-soft", emoji: "❌" },
  pending_recovery: { label: "Guardada", color: "bg-rose-deep text-white", emoji: "🔖" },
};

type Tab = "control" | "purchases" | "pending" | "notes";

export default function AdminLiveControl({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createSupabaseBrowser();
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("control");

  useEffect(() => {
    params.then((p) => setEventId(p.id));
  }, [params]);

  const loadAll = useCallback(async () => {
    if (!eventId) return;
    const [{ data: ev }, { data: offs }, { data: purs }] = await Promise.all([
      supabase.from("live_events").select("*").eq("id", eventId).single(),
      supabase.from("live_offers").select("*").eq("event_id", eventId).order("display_order"),
      supabase
        .from("live_purchases")
        .select("*, profiles(full_name, email, phone), live_offers(name), attended_at, attended_by")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false }),
    ]);
    setEvent(ev as LiveEvent);
    setOffers((offs ?? []) as LiveOffer[]);
    setPurchases((purs ?? []) as PurchaseRow[]);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-default tab depending on event status
  useEffect(() => {
    if (event?.status === "finished") setTab("purchases");
  }, [event?.status]);

  // Realtime
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`admin-live-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_events", filter: `id=eq.${eventId}` }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_offers", filter: `event_id=eq.${eventId}` }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_purchases", filter: `event_id=eq.${eventId}` }, (payload) => {
        loadAll();
        if (payload.eventType === "INSERT") {
          toast.success("¡Nueva participante! 🌸", { duration: 2000 });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, loadAll]);

  async function changeStatus(status: string) {
    if (!eventId) return;
    const updates: any = { status };
    if (status === "active" && !event?.started_at) updates.started_at = new Date().toISOString();
    if (status === "finished") updates.finished_at = new Date().toISOString();
    const { error } = await supabase.from("live_events").update(updates).eq("id", eventId);
    if (error) toast.error(error.message);
    else toast.success(`Evento: ${status}`);
  }

  async function toggleQueue() {
    if (!eventId || !event) return;
    await supabase.from("live_events").update({ queue_open: !event.queue_open }).eq("id", eventId);
    toast.success(event.queue_open ? "Fila cerrada" : "Fila abierta");
  }

  async function releaseSobre(offerId: string) {
    const { data } = await supabase.rpc("release_next_sobre", { p_offer_id: offerId });
    if (data) toast.success("Sobre liberado 🌸");
    else toast.error("Ya no quedan sobres para liberar");
  }

  async function markPending(purchaseId: string, note?: string) {
    const { error } = await supabase.rpc("mark_pending_recovery", {
      p_purchase_id: purchaseId,
      p_note: note ?? null,
    });
    if (error) toast.error(error.message);
    else toast.success("Compra guardada como pendiente 🔖");
  }

  async function markAttended(purchaseId: string, userName?: string) {
    const { data, error } = await supabase.rpc("mark_purchase_attended", {
      p_purchase_id: purchaseId,
      p_note: null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `📦 Paquete pendiente generado para ${userName ?? "la clienta"}. Va a la cola de envíos.`,
      { duration: 4000 }
    );
    return data as string | null;
  }

  async function discardPending(purchaseId: string) {
    const { error } = await supabase.rpc("discard_pending_recovery", {
      p_purchase_id: purchaseId,
    });
    if (error) toast.error(error.message);
    else toast.success("Pendiente descartada");
  }

  async function bulkSavePending() {
    if (!eventId) return;
    if (!confirm("¿Guardar TODAS las compras expiradas/canceladas como pendientes? Las clientas serán notificadas en el próximo LIVE.")) return;
    const { data, error } = await supabase.rpc("bulk_save_event_pending", { p_event_id: eventId });
    if (error) toast.error(error.message);
    else toast.success(`${data ?? 0} compra(s) guardadas como pendientes`);
  }

  if (loading || !event) {
    return <div className="text-center py-20 text-ink-soft">Cargando panel LIVE...</div>;
  }

  const isActive = event.status === "active";
  const isFinished = event.status === "finished";

  // Stats
  const paidPurchases = purchases.filter((p) => p.status === "paid");
  const pendingPurchases = purchases.filter((p) => p.status === "pending_recovery");
  const abandonedPurchases = purchases.filter(
    (p) => p.status === "expired" || p.status === "cancelled"
  );
  const totalRevenue = paidPurchases.reduce((s, p) => s + Number(p.amount), 0);
  const pendingRevenue = pendingPurchases.reduce((s, p) => s + Number(p.amount), 0);

  const TABS: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: "control", label: "Control", icon: Sparkles },
    { id: "purchases", label: "Compras", icon: ShoppingBag, count: purchases.length },
    { id: "pending", label: "Pendientes", icon: Clock, count: pendingPurchases.length },
    { id: "notes", label: "Notas", icon: StickyNote },
  ];

  return (
    <div className="max-w-7xl">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <Link href="/admin/live" className="p-2 hover:bg-rose-pastel rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl md:text-3xl text-ink-primary line-clamp-1">{event.title}</h1>
          <p className="text-sm text-ink-soft">
            {event.type} · creado {new Date(event.created_at).toLocaleDateString("es-AR")}
            {event.started_at && ` · arrancó ${new Date(event.started_at).toLocaleString("es-AR")}`}
            {event.finished_at && ` · finalizó ${new Date(event.finished_at).toLocaleString("es-AR")}`}
          </p>
        </div>
        <span
          className={`px-4 py-2 rounded-full font-bold uppercase text-xs ${
            isActive
              ? "bg-rose-deep text-white animate-soft-pulse"
              : event.status === "paused"
              ? "bg-warning/30 text-ink-primary"
              : isFinished
              ? "bg-success/30 text-ink-primary"
              : "bg-ink-soft/20 text-ink-soft"
          }`}
        >
          {event.status}
        </span>
      </div>

      {/* STATS row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card text-center p-4">
          <div className="text-[10px] uppercase text-ink-soft tracking-wider">Recaudado</div>
          <div className="font-display text-2xl text-rose-deep font-bold mt-1">{formatPrice(totalRevenue)}</div>
          <div className="text-xs text-ink-soft mt-0.5">{paidPurchases.length} pagadas</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-[10px] uppercase text-ink-soft tracking-wider">Compradoras únicas</div>
          <div className="font-display text-2xl text-ink-primary mt-1">
            {new Set(paidPurchases.map((p) => p.user_id)).size}
          </div>
        </div>
        <div className="card text-center p-4 bg-rose-deep/5">
          <div className="text-[10px] uppercase text-ink-soft tracking-wider">Pendientes</div>
          <div className="font-display text-2xl text-rose-deep mt-1">{pendingPurchases.length}</div>
          <div className="text-xs text-ink-soft mt-0.5">{formatPrice(pendingRevenue)}</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-[10px] uppercase text-ink-soft tracking-wider">Abandonadas</div>
          <div className="font-display text-2xl text-ink-soft mt-1">{abandonedPurchases.length}</div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 border-b border-rose-pastel">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-2xl font-semibold whitespace-nowrap transition border-b-2 ${
                active
                  ? "bg-rose-pastel/50 text-rose-deep border-rose-deep"
                  : "text-ink-soft hover:text-rose-deep border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-rose-deep text-white" : "bg-rose-pastel text-rose-deep"}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {tab === "control" && (
        <ControlTab
          event={event}
          offers={offers}
          purchases={purchases}
          isActive={isActive}
          isFinished={isFinished}
          changeStatus={changeStatus}
          toggleQueue={toggleQueue}
          releaseSobre={releaseSobre}
        />
      )}
      {tab === "purchases" && (
        <PurchasesTab
          purchases={purchases}
          onMarkPending={markPending}
          onDiscardPending={discardPending}
          onMarkAttended={markAttended}
        />
      )}
      {tab === "pending" && (
        <PendingTab
          purchases={pendingPurchases}
          abandonedCount={abandonedPurchases.length}
          onBulkSave={bulkSavePending}
          onDiscard={discardPending}
          isFinished={isFinished}
        />
      )}
      {tab === "notes" && <NotesTab event={event} onSaved={loadAll} />}
    </div>
  );
}

// ============================================================
// CONTROL TAB
// ============================================================
function ControlTab({ event, offers, purchases, isActive, isFinished, changeStatus, toggleQueue, releaseSobre }: any) {
  return (
    <>
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {event.status === "draft" && (
            <button onClick={() => changeStatus("active")} className="btn-primary">
              <Play className="w-4 h-4" /> ARRANCAR LIVE
            </button>
          )}
          {event.status === "active" && (
            <>
              <button onClick={() => changeStatus("paused")} className="btn-secondary">
                <Pause className="w-4 h-4" /> Pausar
              </button>
              <button
                onClick={() => {
                  if (confirm("¿Finalizar el evento? Esta acción no se puede deshacer.")) changeStatus("finished");
                }}
                className="btn-secondary text-error"
              >
                <Square className="w-4 h-4" /> Finalizar
              </button>
            </>
          )}
          {event.status === "paused" && (
            <button onClick={() => changeStatus("active")} className="btn-primary">
              <Play className="w-4 h-4" /> Reanudar
            </button>
          )}
          {event.type === "bolsitas" && isActive && (
            <button onClick={toggleQueue} className={event.queue_open ? "btn-secondary" : "btn-primary"}>
              {event.queue_open ? (
                <>
                  <Lock className="w-4 h-4" /> Cerrar fila
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" /> Abrir fila
                </>
              )}
            </button>
          )}
          {isFinished && (
            <p className="text-sm text-ink-soft italic">
              Evento finalizado · revisá las compras y pendientes en las otras pestañas
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl mb-3">{event.type === "sobres" ? "Sobres" : "Ofertas"}</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {offers.map((o: LiveOffer) => {
            const available = offerAvailable(o, event);
            return (
              <div key={o.id} className="card">
                <div className="flex items-start gap-3">
                  {o.image_url ? (
                    <img src={o.image_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-rose-pastel flex items-center justify-center text-3xl">
                      {event.type === "sobres" ? "✉️" : event.type === "bolsitas" ? "🎀" : "💊"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg line-clamp-1">{o.name}</h3>
                    <p className="font-bold text-rose-deep">{formatPrice(o.price)}</p>
                    <div className="text-xs text-ink-soft mt-1">
                      {o.sold_count} vendidos · {o.reserved_count} en proceso
                      {event.type === "sobres"
                        ? ` · ${o.released_count}/${o.total_stock} liberados`
                        : ` · ${available}/${o.total_stock} disponibles`}
                    </div>
                  </div>
                </div>

                {event.type === "sobres" && isActive && (
                  <button
                    onClick={() => releaseSobre(o.id)}
                    disabled={o.released_count >= o.total_stock}
                    className="btn-primary w-full mt-3"
                  >
                    <Sparkles className="w-4 h-4" /> Liberar siguiente sobre
                    <span className="text-xs opacity-80">
                      ({o.released_count}/{o.total_stock})
                    </span>
                  </button>
                )}

                <div className="mt-3 h-2 bg-rose-pastel rounded-full overflow-hidden">
                  <div className="h-full bg-rose-deep transition-all" style={{ width: `${(o.sold_count / o.total_stock) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============================================================
// PURCHASES TAB (full filterable history)
// ============================================================
function PurchasesTab({ purchases, onMarkPending, onDiscardPending, onMarkAttended }: any) {
  const [filterStatus, setFilterStatus] = useState<LivePurchaseStatus | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return purchases.filter((p: PurchaseRow) => {
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (p.profiles?.full_name || p.profiles?.email || "").toLowerCase();
        const offer = (p.live_offers?.name || "").toLowerCase();
        if (!name.includes(q) && !offer.includes(q)) return false;
      }
      return true;
    });
  }, [purchases, filterStatus, search]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: purchases.length };
    purchases.forEach((p: PurchaseRow) => (c[p.status] = (c[p.status] ?? 0) + 1));
    return c;
  }, [purchases]);

  function exportCSV() {
    const rows = [
      ["Cliente", "Email", "Teléfono", "Oferta", "Monto", "Estado", "Creada", "Pagada"],
      ...filtered.map((p: PurchaseRow) => [
        p.profiles?.full_name || "",
        p.profiles?.email || "",
        p.profiles?.phone || "",
        p.live_offers?.name || "",
        Number(p.amount).toString(),
        p.status,
        new Date(p.created_at).toLocaleString("es-AR"),
        p.paid_at ? new Date(p.paid_at).toLocaleString("es-AR") : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compras-live-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Filtros */}
      <div className="card mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              placeholder="Buscar por cliente o oferta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <button onClick={exportCSV} className="btn-secondary text-sm">
            ⬇ CSV
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {(["all", "paid", "paying", "queued", "pending_recovery", "expired", "cancelled"] as const).map((s) => {
            const meta = s === "all" ? null : STATUS_META[s];
            const active = filterStatus === s;
            const count = statusCounts[s] ?? 0;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
                  active ? "bg-rose-deep text-white" : "bg-rose-whisper text-ink-secondary hover:bg-rose-pastel"
                }`}
              >
                {meta ? `${meta.emoji} ${meta.label}` : "Todas"} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-rose-whisper">
            <tr className="text-left text-ink-soft uppercase text-[10px]">
              <th className="p-3">Cliente</th>
              <th className="p-3">Oferta</th>
              <th className="p-3">Monto</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Cuándo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-ink-soft">
                  No hay compras con esos filtros
                </td>
              </tr>
            ) : (
              filtered.map((p: PurchaseRow) => {
                const meta = STATUS_META[p.status];
                return (
                  <tr key={p.id} className="border-t border-rose-pastel hover:bg-rose-whisper/40">
                    <td className="p-3">
                      <div className="font-semibold text-ink-primary line-clamp-1">
                        {p.profiles?.full_name || "—"}
                      </div>
                      <div className="text-xs text-ink-soft line-clamp-1">{p.profiles?.email}</div>
                      {p.profiles?.phone && <div className="text-xs text-ink-soft">{p.profiles.phone}</div>}
                    </td>
                    <td className="p-3 text-ink-secondary">{p.live_offers?.name ?? "—"}</td>
                    <td className="p-3 font-bold text-ink-primary">{formatPrice(Number(p.amount))}</td>
                    <td className="p-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${meta.color}`}>
                        {meta.emoji} {meta.label}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-ink-soft">
                      <div>{new Date(p.created_at).toLocaleString("es-AR")}</div>
                      {p.paid_at && (
                        <div className="text-success">
                          ✓ {new Date(p.paid_at).toLocaleString("es-AR")}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {(p.status === "paid" || p.status === "pending_recovery") &&
                          (p.attended_at ? (
                            <span
                              className="text-[11px] px-2 py-1 rounded-full bg-success/30 text-ink-primary inline-flex items-center gap-1"
                              title={`Atendida el ${new Date(p.attended_at).toLocaleString("es-AR")}`}
                            >
                              <CheckCircle2 className="w-3 h-3" /> Atendida
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                onMarkAttended(p.id, p.profiles?.full_name || p.profiles?.email)
                              }
                              className="text-xs px-2.5 py-1 rounded-full bg-rose-deep text-white font-semibold inline-flex items-center gap-1 hover:bg-rose-deep/90"
                              title="Mercadería separada · genera paquete pendiente automáticamente"
                            >
                              <PackagePlus className="w-3 h-3" /> Marcar atendida
                            </button>
                          ))}
                        {(p.status === "expired" || p.status === "cancelled") && (
                          <button
                            onClick={() => onMarkPending(p.id)}
                            className="text-xs px-2.5 py-1 rounded-full bg-rose-pastel hover:bg-rose-medium font-semibold text-rose-deep inline-flex items-center gap-1"
                            title="Guardar para que la clienta la complete después"
                          >
                            <Bookmark className="w-3 h-3" /> Guardar
                          </button>
                        )}
                        {p.status === "pending_recovery" && (
                          <button
                            onClick={() => onDiscardPending(p.id)}
                            className="text-xs px-2.5 py-1 rounded-full bg-ink-soft/15 hover:bg-error/20 text-ink-soft hover:text-error inline-flex items-center gap-1"
                            title="Descartar"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================================
// PENDING TAB
// ============================================================
function PendingTab({ purchases, abandonedCount, onBulkSave, onDiscard, isFinished }: any) {
  return (
    <>
      {abandonedCount > 0 && isFinished && (
        <div className="card bg-rose-whisper border border-rose-medium/40 mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display text-lg text-rose-deep">
              Hay {abandonedCount} compra{abandonedCount === 1 ? "" : "s"} sin completar
            </h3>
            <p className="text-sm text-ink-secondary">
              Guardalas como pendientes y las clientas serán notificadas en el próximo LIVE para que las completen.
            </p>
          </div>
          <button onClick={onBulkSave} className="btn-primary">
            <Save className="w-4 h-4" /> Guardar todas como pendientes
          </button>
        </div>
      )}

      {purchases.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">🌷</div>
          <p className="text-ink-secondary font-semibold">No hay pendientes guardados</p>
          <p className="text-ink-soft text-sm mt-1">
            Cuando una clienta gana algo y no termina de pagar, podés "guardarlo" desde la pestaña de Compras
            (estados Expirada o Cancelada).
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="card bg-rose-deep text-white">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm">
                <strong>{purchases.length}</strong> clienta{purchases.length === 1 ? "" : "s"} con compras pendientes.
                Cuando arranques el próximo LIVE, recibirán una notificación automática para completar el pago.
              </p>
            </div>
          </div>

          {purchases.map((p: PurchaseRow) => (
            <div key={p.id} className="card flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-full bg-rose-deep text-white flex items-center justify-center text-xl flex-shrink-0">
                🔖
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg text-ink-primary">
                  {p.profiles?.full_name || p.profiles?.email}
                </h3>
                <p className="text-sm text-ink-secondary">
                  Quiere: <strong>{p.live_offers?.name}</strong> · {formatPrice(Number(p.amount))}
                </p>
                <p className="text-xs text-ink-soft mt-1">
                  📧 {p.profiles?.email}
                  {p.profiles?.phone && ` · 📱 ${p.profiles.phone}`}
                </p>
                {p.admin_notes && (
                  <p className="text-xs italic text-ink-secondary mt-2 bg-rose-whisper/60 px-3 py-1.5 rounded-xl">
                    📝 {p.admin_notes}
                  </p>
                )}
                <p className="text-xs text-ink-soft mt-2">
                  {p.recovery_notified_at
                    ? `✓ Notificada el ${new Date(p.recovery_notified_at).toLocaleString("es-AR")}`
                    : "⏳ Pendiente de notificar"}
                </p>
              </div>
              <button
                onClick={() => onDiscard(p.id)}
                className="text-xs px-3 py-2 rounded-full text-error hover:bg-error/10 inline-flex items-center gap-1"
              >
                <XIcon className="w-3 h-3" /> Descartar
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ============================================================
// NOTES TAB
// ============================================================
function NotesTab({ event, onSaved }: { event: LiveEvent; onSaved: () => void }) {
  const supabase = createSupabaseBrowser();
  const [notes, setNotes] = useState(event.notes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("live_events").update({ notes }).eq("id", event.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Notas guardadas");
      onSaved();
    }
  }

  return (
    <div className="card max-w-3xl">
      <h2 className="font-display text-xl text-ink-primary mb-1">Notas privadas del evento</h2>
      <p className="text-sm text-ink-soft mb-4">
        Para uso interno. No las ven las clientas. Útiles para recordatorios, observaciones sobre cómo fue
        el LIVE, qué pedís cambiar la próxima, etc.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="input min-h-[280px] font-mono text-sm"
        placeholder="Ej: Sofi avisó que se le cortó internet justo cuando ganó la cápsula 2. Hablar mañana.&#10;&#10;Mariana compró 3 sobres pero pagó solo 2, falta el #4."
      />
      <button onClick={save} disabled={saving} className="btn-primary mt-3">
        <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar notas"}
      </button>
    </div>
  );
}
