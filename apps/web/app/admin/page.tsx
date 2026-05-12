import Link from "next/link";
import { TrendingUp, ShoppingCart, Package, Sparkles, Plus } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const supabase = await createSupabaseServer();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { data: todayOrders },
    { data: pendingOrders },
    { count: productCount },
    { data: activeLive },
  ] = await Promise.all([
    supabase.from("orders").select("total").eq("status", "paid").gte("paid_at", today.toISOString()),
    supabase.from("orders").select("*").eq("status", "paid").is("shipped_at", null).limit(50),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("live_events").select("*").eq("status", "active").limit(1),
  ]);

  const todayRevenue = (todayOrders ?? []).reduce((sum, o: any) => sum + Number(o.total), 0);

  return {
    todayRevenue,
    todayCount: todayOrders?.length ?? 0,
    pendingShipping: pendingOrders?.length ?? 0,
    activeProducts: productCount ?? 0,
    activeLive: activeLive?.[0],
  };
}

export default async function AdminDashboard() {
  const data = await getDashboardData();

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Hola 🌸</h1>
        <p className="text-ink-secondary mt-1">Esto es lo que está pasando hoy.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Ventas hoy"
          value={formatPrice(data.todayRevenue)}
          sub={`${data.todayCount} órdenes`}
        />
        <KpiCard
          icon={<ShoppingCart className="w-5 h-5" />}
          label="Por enviar"
          value={String(data.pendingShipping)}
          sub="órdenes pendientes"
        />
        <KpiCard
          icon={<Package className="w-5 h-5" />}
          label="Productos activos"
          value={String(data.activeProducts)}
          sub="en catálogo"
        />
        <KpiCard
          icon={<Sparkles className="w-5 h-5" />}
          label="LIVE"
          value={data.activeLive ? "EN VIVO" : "—"}
          sub={data.activeLive ? data.activeLive.title : "sin eventos activos"}
          highlight={!!data.activeLive}
        />
      </div>

      {/* Acciones rápidas */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/admin/products/new"
          className="card hover:shadow-lift transition-all hover:-translate-y-1 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-pastel flex items-center justify-center text-rose-deep">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display text-lg text-ink-primary">Agregar producto</h3>
            <p className="text-sm text-ink-soft">Crear un producto nuevo en el catálogo</p>
          </div>
        </Link>

        <Link
          href="/admin/live/new"
          className="card hover:shadow-lift transition-all hover:-translate-y-1 flex items-center gap-4 bg-gradient-to-br from-rose-deep to-rose-primary text-white"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display text-lg">Crear evento LIVE</h3>
            <p className="text-sm text-white/80">Cápsulas, sobres o bolsitas</p>
          </div>
        </Link>
      </div>

      <div className="card">
        <h2 className="font-display text-xl text-ink-primary mb-4">Tips rápidos</h2>
        <ul className="space-y-2 text-ink-secondary text-sm">
          <li>🌸 Antes de cada LIVE, creá el evento desde "LIVE → Crear" y dejalo en "draft" hasta arrancar.</li>
          <li>💗 Cuando arranque la transmisión en TikTok, cambiá el estado del evento a "active".</li>
          <li>✨ Para Sobres, vas liberando uno por uno mientras hablás de cada uno en el LIVE.</li>
          <li>🎀 Para Bolsitas, abrí la fila cuando estés lista para que se sumen.</li>
        </ul>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card ${highlight ? "bg-gradient-to-br from-rose-deep to-rose-primary text-white" : ""}`}>
      <div className={`flex items-center gap-2 mb-2 ${highlight ? "text-white/90" : "text-rose-deep"}`}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`font-display text-2xl ${highlight ? "text-white" : "text-ink-primary"}`}>{value}</div>
      <div className={`text-xs mt-1 ${highlight ? "text-white/80" : "text-ink-soft"}`}>{sub}</div>
    </div>
  );
}
