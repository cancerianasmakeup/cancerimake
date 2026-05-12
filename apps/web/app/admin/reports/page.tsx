import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

export default async function AdminReports() {
  const supabase = await createSupabaseServer();

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [{ data: m7 }, { data: m30 }, { data: mMonth }, { data: bySource }] = await Promise.all([
    supabase.from("orders").select("total").eq("status", "paid").gte("paid_at", start7d.toISOString()),
    supabase.from("orders").select("total").eq("status", "paid").gte("paid_at", start30d.toISOString()),
    supabase.from("orders").select("total").eq("status", "paid").gte("paid_at", startMonth.toISOString()),
    supabase.from("orders").select("source, total").eq("status", "paid").gte("paid_at", start30d.toISOString()),
  ]);

  const sum7 = (m7 ?? []).reduce((s, o: any) => s + Number(o.total), 0);
  const sum30 = (m30 ?? []).reduce((s, o: any) => s + Number(o.total), 0);
  const sumMonth = (mMonth ?? []).reduce((s, o: any) => s + Number(o.total), 0);

  const liveRevenue = (bySource ?? []).filter((o: any) => o.source === "live").reduce((s, o: any) => s + Number(o.total), 0);
  const catalogRevenue = (bySource ?? []).filter((o: any) => o.source === "catalog").reduce((s, o: any) => s + Number(o.total), 0);

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Reportes</h1>
        <p className="text-ink-secondary mt-1">Vista general de las ventas</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <p className="text-xs uppercase text-ink-soft mb-1">Últimos 7 días</p>
          <p className="font-display text-3xl font-bold text-rose-deep">{formatPrice(sum7)}</p>
          <p className="text-xs text-ink-soft mt-1">{m7?.length ?? 0} órdenes</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-ink-soft mb-1">Últimos 30 días</p>
          <p className="font-display text-3xl font-bold text-rose-deep">{formatPrice(sum30)}</p>
          <p className="text-xs text-ink-soft mt-1">{m30?.length ?? 0} órdenes</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-ink-soft mb-1">Este mes</p>
          <p className="font-display text-3xl font-bold text-rose-deep">{formatPrice(sumMonth)}</p>
          <p className="text-xs text-ink-soft mt-1">{mMonth?.length ?? 0} órdenes</p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-xl mb-4">Por canal (últimos 30 días)</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1 text-sm">
              <span className="font-semibold">🌸 LIVE</span>
              <span className="font-bold text-rose-deep">{formatPrice(liveRevenue)}</span>
            </div>
            <div className="h-3 bg-rose-pastel rounded-full overflow-hidden">
              <div className="h-full bg-rose-deep" style={{ width: `${sum30 ? (liveRevenue / sum30) * 100 : 0}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1 text-sm">
              <span className="font-semibold">🛍️ Tienda</span>
              <span className="font-bold text-rose-deep">{formatPrice(catalogRevenue)}</span>
            </div>
            <div className="h-3 bg-rose-pastel rounded-full overflow-hidden">
              <div className="h-full bg-rose-primary" style={{ width: `${sum30 ? (catalogRevenue / sum30) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
