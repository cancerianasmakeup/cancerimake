import Link from "next/link";
import { Mail, Phone, Download, Users, UserPlus, Bell } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type TabKey = "accounts" | "subscribers" | "all";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
};

type Subscriber = {
  id: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  created_at: string;
};

type Row = {
  source: "account" | "subscriber" | "both";
  email: string;
  name: string;
  phone: string;
  created_at: string;
  origin?: string | null;
};

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = (["accounts", "subscribers", "all"].includes(rawTab ?? "")
    ? (rawTab as TabKey)
    : "accounts");

  const supabase = await createSupabaseServer();
  const [{ data: profilesData }, { data: subsData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, first_name, last_name, phone, created_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false }),
    supabase
      .from("store_subscribers")
      .select("id, email, phone, source, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const profiles: Profile[] = profilesData ?? [];
  const subscribers: Subscriber[] = subsData ?? [];

  // Combinar para la vista "Todas". Match por email normalizado.
  const profileEmails = new Set(profiles.map(p => (p.email ?? "").toLowerCase().trim()));
  const onlySubscribers = subscribers.filter(s => {
    const e = (s.email ?? "").toLowerCase().trim();
    return !e || !profileEmails.has(e);
  });

  const accountsRows: Row[] = profiles.map(p => ({
    source: "account",
    email: p.email,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || "—",
    phone: p.phone || "",
    created_at: p.created_at,
  }));

  const subscriberRows: Row[] = subscribers.map(s => ({
    source: profileEmails.has((s.email ?? "").toLowerCase().trim()) ? "both" : "subscriber",
    email: s.email || "",
    name: "—",
    phone: s.phone || "",
    created_at: s.created_at,
    origin: s.source,
  }));

  // Vista "Todas": cuentas + suscriptoras-sin-cuenta (mergeadas para no duplicar)
  const allRows: Row[] = [
    ...accountsRows,
    ...subscriberRows.filter(r => r.source === "subscriber"),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const stats = {
    accounts: profiles.length,
    subscribers: subscribers.length,
    onlySubscribers: onlySubscribers.length,
    total: profiles.length + onlySubscribers.length,
  };

  const visibleRows: Row[] =
    tab === "accounts"    ? accountsRows
    : tab === "subscribers" ? subscriberRows
                            : allRows;

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Clientas y contactos</h1>
        <p className="text-ink-secondary mt-1">Tu base de personas que pasaron por la tienda.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Con cuenta"
          value={stats.accounts}
          icon={<UserPlus className="w-4 h-4" />}
          color="success"
          hint="Crearon usuario"
        />
        <StatCard
          label="Sólo suscritas"
          value={stats.onlySubscribers}
          icon={<Bell className="w-4 h-4" />}
          color="warning"
          hint="Sin cuenta todavía"
        />
        <StatCard
          label="Total único"
          value={stats.total}
          icon={<Users className="w-4 h-4" />}
          color="rose"
          hint="Sin duplicados"
        />
        <StatCard
          label="Suscripciones totales"
          value={stats.subscribers}
          icon={<Bell className="w-4 h-4" />}
          color="ink"
          hint="Incluye repetidos"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <TabLink href="/admin/customers?tab=accounts"    active={tab === "accounts"}    label={`Con cuenta (${stats.accounts})`} />
        <TabLink href="/admin/customers?tab=subscribers" active={tab === "subscribers"} label={`Suscriptas al aviso (${stats.subscribers})`} />
        <TabLink href="/admin/customers?tab=all"         active={tab === "all"}         label={`Todas combinadas (${stats.total})`} />
      </div>

      {/* Export CSV */}
      {visibleRows.length > 0 && (
        <div className="flex justify-end mb-3">
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(visibleRows))}`}
            download={`contactos-${tab}-${new Date().toISOString().slice(0, 10)}.csv`}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </a>
        </div>
      )}

      {/* Tabla */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-rose-whisper">
            <tr className="text-left text-ink-soft uppercase text-xs">
              <th className="p-3">Tipo</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Email</th>
              <th className="p-3">WhatsApp</th>
              <th className="p-3">Origen</th>
              <th className="p-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => (
              <tr key={`${r.email}-${i}`} className="border-t border-rose-pastel hover:bg-rose-whisper/50">
                <td className="p-3"><SourceBadge source={r.source} /></td>
                <td className="p-3 font-semibold text-ink-primary">{r.name}</td>
                <td className="p-3">
                  {r.email ? (
                    <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-ink-secondary hover:text-rose-deep">
                      <Mail className="w-3.5 h-3.5 text-ink-soft" />
                      {r.email}
                    </a>
                  ) : <span className="text-ink-soft">—</span>}
                </td>
                <td className="p-3">
                  {r.phone ? (
                    <a href={`https://wa.me/${onlyDigits(r.phone)}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-ink-secondary hover:text-success">
                      <Phone className="w-3.5 h-3.5 text-ink-soft" />
                      {r.phone}
                    </a>
                  ) : <span className="text-ink-soft">—</span>}
                </td>
                <td className="p-3 text-ink-soft text-xs">{r.origin ?? "—"}</td>
                <td className="p-3 text-ink-soft text-xs whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" })}
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-16 text-ink-soft">
                {tab === "accounts" ? "Todavía no hay clientas registradas." :
                 tab === "subscribers" ? "Nadie se anotó al aviso todavía." :
                 "Sin contactos por ahora."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-soft mt-4">
        💡 Las suscriptas dejaron su contacto al ver la tienda cerrada (con un drop por venir). Las clientas crearon cuenta para comprar.
        Las que aparecen como <SourceBadge source="both" /> son las dos cosas. La vista <strong>Todas combinadas</strong> deduplica por email.
      </p>
    </div>
  );
}

function StatCard({
  label, value, icon, color, hint,
}: {
  label: string; value: number; icon: React.ReactNode;
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
      <p className="font-display text-2xl font-bold mt-1">{value}</p>
      {hint && <p className="text-[10px] opacity-70 mt-0.5">{hint}</p>}
    </div>
  );
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
        active ? "bg-rose-deep text-white shadow-soft" : "bg-rose-whisper text-ink-secondary hover:bg-rose-pastel"
      }`}
    >
      {label}
    </Link>
  );
}

function SourceBadge({ source }: { source: Row["source"] }) {
  const map = {
    account:    { label: "Con cuenta",  cls: "bg-success/15 text-success" },
    subscriber: { label: "Suscrita",    cls: "bg-warning/15 text-warning" },
    both:       { label: "Cuenta+aviso",cls: "bg-rose-deep/10 text-rose-deep" },
  };
  const cfg = map[source];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function toCsv(rows: Row[]): string {
  const head = "tipo,nombre,email,whatsapp,origen,fecha";
  const body = rows.map(r =>
    [r.source, r.name, r.email, r.phone, r.origin ?? "", r.created_at]
      .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");
  return `${head}\n${body}`;
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}
