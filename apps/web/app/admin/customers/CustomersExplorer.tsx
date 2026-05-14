"use client";

import { useMemo, useState } from "react";
import {
  Mail, Phone, Download, Users, UserPlus, Bell, Search, X,
  Crown, Repeat, Sparkles, Moon,
} from "lucide-react";

export type CustomerRow = {
  source: "account" | "subscriber" | "both";
  id: string;
  email: string;
  name: string;
  phone: string;
  created_at: string;
  origin: string | null;
  orders_count: number;
  paid_count: number;
  total_spent: number;
  last_order_at: string | null;
};

type TabKey = "accounts" | "subscribers" | "all";
type SortKey = "newest" | "oldest" | "spent_desc" | "orders_desc" | "last_order_desc" | "name_asc";
type TagKey = "all" | "vip" | "recurrente" | "nueva" | "inactiva" | "sin_compras";

// Umbral $ para badge VIP. Si total_spent >= este monto, o si paid_count >= 3, es VIP.
const VIP_THRESHOLD = 30000;
const RECURRENTE_MIN_ORDERS = 2;
const NEW_DAYS = 30;
const INACTIVE_DAYS = 90;

type Tag = { key: TagKey; label: string; icon: React.ComponentType<{ className?: string }>; cls: string };

const TAG_DEFS: Record<Exclude<TagKey, "all">, Tag> = {
  vip:         { key: "vip",         label: "VIP",         icon: Crown,    cls: "bg-rose-deep/15 text-rose-deep border-rose-deep/30" },
  recurrente:  { key: "recurrente",  label: "Recurrente",  icon: Repeat,   cls: "bg-success/15 text-success border-success/30" },
  nueva:       { key: "nueva",       label: "Nueva",       icon: Sparkles, cls: "bg-warning/15 text-warning border-warning/30" },
  inactiva:    { key: "inactiva",    label: "Inactiva",    icon: Moon,     cls: "bg-ink-primary/10 text-ink-secondary border-ink-primary/20" },
  sin_compras: { key: "sin_compras", label: "Sin compras", icon: Bell,     cls: "bg-rose-whisper text-ink-soft border-rose-pastel" },
};

function classifyCustomer(r: CustomerRow, now: Date): TagKey {
  if (r.paid_count === 0) return "sin_compras";
  if (r.paid_count >= 3 || r.total_spent >= VIP_THRESHOLD) return "vip";

  const last = r.last_order_at ? new Date(r.last_order_at) : null;
  const daysSinceLast = last ? (now.getTime() - last.getTime()) / 86400000 : Infinity;

  if (daysSinceLast > INACTIVE_DAYS) return "inactiva";
  if (r.paid_count >= RECURRENTE_MIN_ORDERS) return "recurrente";
  if (daysSinceLast <= NEW_DAYS) return "nueva";
  return "recurrente"; // tiene 1 pago, no es nueva ni inactiva
}

function formatPrice(n: number): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

export default function CustomersExplorer({
  accountsRows,
  subscriberRows,
}: {
  accountsRows: CustomerRow[];
  subscriberRows: CustomerRow[];
}) {
  const now = useMemo(() => new Date(), []);

  // ── Estado UI ─────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabKey>("accounts");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<TagKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState("");

  // ── Vista base por tab ────────────────────────────────────────────
  const baseRows: CustomerRow[] = useMemo(() => {
    if (tab === "accounts") return accountsRows;
    if (tab === "subscribers") return subscriberRows;
    // "all": cuentas + suscriptoras-sin-cuenta (deduplicado por email)
    return [
      ...accountsRows,
      ...subscriberRows.filter(r => r.source === "subscriber"),
    ];
  }, [tab, accountsRows, subscriberRows]);

  // ── Stats globales (no se afectan por filtros) ────────────────────
  const stats = useMemo(() => {
    const profileEmails = new Set(accountsRows.map(r => r.email.toLowerCase().trim()));
    const onlySubs = subscriberRows.filter(r => {
      const e = r.email.toLowerCase().trim();
      return !e || !profileEmails.has(e);
    });
    const totalSpent = accountsRows.reduce((s, r) => s + r.total_spent, 0);
    const buyers = accountsRows.filter(r => r.paid_count > 0).length;
    return {
      accounts: accountsRows.length,
      subscribers: subscriberRows.length,
      onlySubscribers: onlySubs.length,
      total: accountsRows.length + onlySubs.length,
      buyers,
      totalSpent,
    };
  }, [accountsRows, subscriberRows]);

  // ── Counts por badge (sobre la vista actual del tab, sin filtros) ─
  const tagCounts = useMemo(() => {
    const c: Record<TagKey, number> = { all: 0, vip: 0, recurrente: 0, nueva: 0, inactiva: 0, sin_compras: 0 };
    for (const r of baseRows) {
      const t = classifyCustomer(r, now);
      c[t] += 1;
      c.all += 1;
    }
    return c;
  }, [baseRows, now]);

  // ── Aplicar filtros + sort ────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTime = from ? new Date(from).getTime() : -Infinity;
    const toTime = to ? new Date(to + "T23:59:59").getTime() : Infinity;

    let rows = baseRows.filter(r => {
      if (q) {
        const hay = `${r.name} ${r.email} ${r.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const t = new Date(r.created_at).getTime();
      if (t < fromTime || t > toTime) return false;
      if (tagFilter !== "all" && classifyCustomer(r, now) !== tagFilter) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "newest":         return b.created_at.localeCompare(a.created_at);
        case "oldest":         return a.created_at.localeCompare(b.created_at);
        case "spent_desc":     return b.total_spent - a.total_spent;
        case "orders_desc":    return b.paid_count - a.paid_count;
        case "last_order_desc": return (b.last_order_at ?? "").localeCompare(a.last_order_at ?? "");
        case "name_asc":       return (a.name || a.email).localeCompare(b.name || b.email);
      }
    });
    return rows;
  }, [baseRows, query, from, to, tagFilter, sort, now]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl">
      <div className="mb-5">
        <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Clientas y contactos</h1>
        <p className="text-ink-secondary mt-1">Tu base completa: con cuenta + suscriptas al aviso.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-5">
        <StatCard label="Con cuenta"     value={stats.accounts}        icon={<UserPlus className="w-4 h-4" />} color="success" />
        <StatCard label="Sólo suscritas" value={stats.onlySubscribers} icon={<Bell className="w-4 h-4" />}     color="warning" hint="Sin cuenta todavía" />
        <StatCard label="Total único"    value={stats.total}           icon={<Users className="w-4 h-4" />}    color="rose"    hint="Sin duplicados" />
        <StatCard label="Compradoras"    value={stats.buyers}          icon={<Crown className="w-4 h-4" />}    color="ink"     hint="Con ≥1 orden paga" />
        <StatCard label="Facturado total" value={formatPrice(stats.totalSpent)} icon={<Sparkles className="w-4 h-4" />} color="success" hint="Órdenes pagas" />
      </div>

      {/* Tabs principales */}
      <div className="flex flex-wrap gap-2 mb-3">
        <TabBtn active={tab === "accounts"}    onClick={() => { setTab("accounts");    setTagFilter("all"); }} label={`Con cuenta (${stats.accounts})`} />
        <TabBtn active={tab === "subscribers"} onClick={() => { setTab("subscribers"); setTagFilter("all"); }} label={`Suscriptas al aviso (${stats.subscribers})`} />
        <TabBtn active={tab === "all"}         onClick={() => { setTab("all");         setTagFilter("all"); }} label={`Todas combinadas (${stats.total})`} />
      </div>

      {/* Filtros */}
      <div className="card !p-3 mb-3 space-y-3">
        <div className="grid sm:grid-cols-[1fr_180px_180px_200px] gap-2 items-end">
          {/* Búsqueda */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-ink-soft mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre, email o WhatsApp..."
                className="input !h-10 !text-sm pl-9 w-full"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-rose-deep p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-ink-soft mb-1">Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input !h-10 !text-sm w-full" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-ink-soft mb-1">Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input !h-10 !text-sm w-full" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-ink-soft mb-1">Ordenar por</label>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input !h-10 !text-sm w-full">
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguas</option>
              <option value="spent_desc">Más gastaron</option>
              <option value="orders_desc">Más órdenes</option>
              <option value="last_order_desc">Última compra</option>
              <option value="name_asc">Nombre (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Tag filters — sólo tienen sentido en tabs que contienen cuentas */}
        {tab !== "subscribers" && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-rose-pastel/60">
            <ChipFilter active={tagFilter === "all"}        onClick={() => setTagFilter("all")}        label={`Todas (${tagCounts.all})`} />
            <ChipFilter active={tagFilter === "vip"}        onClick={() => setTagFilter("vip")}        label={`👑 VIP (${tagCounts.vip})`} />
            <ChipFilter active={tagFilter === "recurrente"} onClick={() => setTagFilter("recurrente")} label={`🔁 Recurrentes (${tagCounts.recurrente})`} />
            <ChipFilter active={tagFilter === "nueva"}      onClick={() => setTagFilter("nueva")}      label={`✨ Nuevas (${tagCounts.nueva})`} />
            <ChipFilter active={tagFilter === "inactiva"}   onClick={() => setTagFilter("inactiva")}   label={`💤 Inactivas (${tagCounts.inactiva})`} />
            <ChipFilter active={tagFilter === "sin_compras"} onClick={() => setTagFilter("sin_compras")} label={`Sin compras (${tagCounts.sin_compras})`} />
          </div>
        )}

        {/* Mostrar / limpiar */}
        <div className="flex items-center justify-between text-xs text-ink-soft pt-1 border-t border-rose-pastel/60">
          <span>{filteredRows.length} de {baseRows.length} mostradas</span>
          <div className="flex items-center gap-2">
            {(query || from || to || tagFilter !== "all") && (
              <button
                onClick={() => { setQuery(""); setFrom(""); setTo(""); setTagFilter("all"); }}
                className="text-rose-deep hover:underline font-semibold"
              >
                Limpiar filtros
              </button>
            )}
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(filteredRows, now))}`}
              download={`contactos-${tab}-${new Date().toISOString().slice(0, 10)}.csv`}
              className="inline-flex items-center gap-1 text-rose-deep hover:underline font-semibold"
            >
              <Download className="w-3 h-3" /> Exportar CSV
            </a>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-rose-whisper">
            <tr className="text-left text-ink-soft uppercase text-[10px] tracking-wider">
              <th className="p-3">Cliente</th>
              <th className="p-3">Contacto</th>
              <th className="p-3">Tag</th>
              <th className="p-3 text-right">Órdenes</th>
              <th className="p-3 text-right">Gastado</th>
              <th className="p-3">Última compra</th>
              <th className="p-3">Registrada</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(r => {
              const tag = classifyCustomer(r, now);
              const def = TAG_DEFS[tag as Exclude<TagKey, "all">];
              const Icon = def.icon;
              return (
                <tr key={`${r.source}-${r.id}`} className="border-t border-rose-pastel hover:bg-rose-whisper/30">
                  <td className="p-3 min-w-[180px]">
                    <p className="font-semibold text-ink-primary leading-tight">{r.name || "—"}</p>
                    <p className="text-[10px] text-ink-soft uppercase tracking-wider mt-0.5">
                      {r.source === "account" ? "Con cuenta" :
                       r.source === "both"    ? "Cuenta + aviso" :
                                                "Sólo suscrita"}
                    </p>
                  </td>
                  <td className="p-3 space-y-0.5">
                    {r.email && (
                      <a href={`mailto:${r.email}`} className="block text-xs text-ink-secondary hover:text-rose-deep inline-flex items-center gap-1">
                        <Mail className="w-3 h-3 text-ink-soft" />
                        {r.email}
                      </a>
                    )}
                    {r.phone && (
                      <a href={`https://wa.me/${onlyDigits(r.phone)}`} target="_blank" rel="noopener" className="block text-xs text-ink-secondary hover:text-success inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-ink-soft" />
                        {r.phone}
                      </a>
                    )}
                    {!r.email && !r.phone && <span className="text-ink-soft text-xs">—</span>}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${def.cls}`}>
                      <Icon className="w-3 h-3" />
                      {def.label}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-mono text-ink-primary">{r.paid_count}</span>
                    {r.orders_count > r.paid_count && (
                      <span className="text-[10px] text-ink-soft block">(+{r.orders_count - r.paid_count} sin pagar)</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-rose-deep whitespace-nowrap">
                    {r.total_spent > 0 ? formatPrice(r.total_spent) : <span className="text-ink-soft font-normal">—</span>}
                  </td>
                  <td className="p-3 text-xs text-ink-soft whitespace-nowrap">
                    {r.last_order_at
                      ? new Date(r.last_order_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" })
                      : "—"}
                  </td>
                  <td className="p-3 text-xs text-ink-soft whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" })}
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-16 text-ink-soft">
                  {baseRows.length === 0
                    ? "Sin contactos en esta vista todavía."
                    : "Ningún contacto coincide con los filtros actuales."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-soft mt-4 leading-relaxed">
        💡 <strong>Tags automáticos:</strong> <b>VIP</b> son las que pagaron 3+ órdenes o gastaron {formatPrice(VIP_THRESHOLD)}+ ·
        <b> Recurrentes</b> tienen 2+ pagas · <b>Nuevas</b> compraron en los últimos {NEW_DAYS} días ·
        <b> Inactivas</b> no compran hace más de {INACTIVE_DAYS} días.
      </p>
    </div>
  );
}

function StatCard({
  label, value, icon, color, hint,
}: {
  label: string; value: number | string; icon: React.ReactNode;
  color: "success" | "warning" | "rose" | "ink"; hint?: string;
}) {
  const colorCls =
    color === "success" ? "bg-success/10 text-success border-success/30" :
    color === "warning" ? "bg-warning/10 text-warning border-warning/30" :
    color === "rose"    ? "bg-rose-whisper text-rose-deep border-rose-pastel" :
                          "bg-ink-primary/5 text-ink-primary border-ink-primary/20";
  return (
    <div className={`rounded-2xl border p-3 ${colorCls}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold opacity-80">
        {icon}
        {label}
      </div>
      <p className="font-display text-xl md:text-2xl font-bold mt-1 leading-tight truncate">{value}</p>
      {hint && <p className="text-[10px] opacity-70 mt-0.5">{hint}</p>}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
        active ? "bg-rose-deep text-white shadow-soft" : "bg-rose-whisper text-ink-secondary hover:bg-rose-pastel"
      }`}
    >
      {label}
    </button>
  );
}

function ChipFilter({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
        active
          ? "bg-rose-deep text-white"
          : "bg-rose-whisper text-ink-soft hover:bg-rose-pastel hover:text-rose-deep"
      }`}
    >
      {label}
    </button>
  );
}

function toCsv(rows: CustomerRow[], now: Date): string {
  const head = "tipo,tag,nombre,email,whatsapp,ordenes_pagas,total_gastado,ultima_compra,fecha_registro";
  const body = rows.map(r => {
    const tag = TAG_DEFS[classifyCustomer(r, now) as Exclude<TagKey, "all">].label;
    return [r.source, tag, r.name, r.email, r.phone, r.paid_count, r.total_spent, r.last_order_at ?? "", r.created_at]
      .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",");
  }).join("\n");
  return `${head}\n${body}`;
}
