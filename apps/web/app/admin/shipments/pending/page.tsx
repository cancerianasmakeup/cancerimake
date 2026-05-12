import Link from "next/link";
import { ArrowLeft, Package, Sparkles } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

type Row = {
  user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  pending_count: number;
  pending_total: number;
  oldest_at: string;
  newest_at: string;
  package_ids: string[];
};

export default async function PendingShipmentsPage() {
  const supabase = await createSupabaseServer();
  const { data: rows } = await supabase
    .from("pending_packages_by_customer")
    .select("*")
    .order("oldest_at", { ascending: true });

  const list = (rows ?? []) as Row[];
  const totalPackages = list.reduce((s, r) => s + r.pending_count, 0);
  const totalValue = list.reduce((s, r) => s + Number(r.pending_total ?? 0), 0);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <Link href="/admin/shipments" className="p-2 hover:bg-rose-pastel rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-3xl md:text-4xl text-ink-primary">
            Paquetes pendientes 📦
          </h1>
          <p className="text-ink-secondary mt-1">
            Mercadería separada en dinámicas, agrupada por clienta. Consolidá uno o más paquetes
            en un envío cuando quieras despacharlos.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="card text-center p-4">
          <div className="text-[10px] uppercase text-ink-soft tracking-wider">Clientas</div>
          <div className="font-display text-2xl text-ink-primary mt-1">{list.length}</div>
        </div>
        <div className="card text-center p-4 bg-rose-deep/5">
          <div className="text-[10px] uppercase text-ink-soft tracking-wider">Paquetes</div>
          <div className="font-display text-2xl text-rose-deep mt-1">{totalPackages}</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-[10px] uppercase text-ink-soft tracking-wider">Valor total</div>
          <div className="font-display text-2xl text-ink-primary mt-1">{formatPrice(totalValue)}</div>
        </div>
      </div>

      {/* Lista */}
      {list.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">🌷</div>
          <p className="text-ink-secondary font-semibold">No hay paquetes pendientes</p>
          <p className="text-ink-soft text-sm mt-1 max-w-md mx-auto">
            Cuando marqués una compra como <strong>"Atendida"</strong> en una dinámica activa,
            aparecerá acá esperando que armes el envío.
          </p>
          <Link href="/admin/live" className="btn-primary mt-4 inline-flex">
            <Sparkles className="w-4 h-4" /> Ir a LIVES
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const ageDays =
              Math.floor(
                (Date.now() - new Date(r.oldest_at).getTime()) / (1000 * 60 * 60 * 24)
              );
            const stale = ageDays >= 3;
            return (
              <div
                key={r.user_id}
                className={`card flex items-start gap-4 flex-wrap ${
                  stale ? "border-warning/40 bg-warning/5" : ""
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-rose-pastel flex items-center justify-center text-2xl flex-shrink-0">
                  🌸
                </div>
                <div className="flex-1 min-w-[220px]">
                  <h3 className="font-display text-lg text-ink-primary line-clamp-1">
                    {r.full_name || "Sin nombre"}
                  </h3>
                  <p className="text-xs text-ink-soft">
                    {r.email}
                    {r.phone && ` · ${r.phone}`}
                  </p>
                  <p className="text-sm text-ink-secondary mt-1">
                    📦 <strong>{r.pending_count}</strong> paquete{r.pending_count === 1 ? "" : "s"} ·{" "}
                    {formatPrice(Number(r.pending_total ?? 0))} en mercadería
                  </p>
                  <p className="text-xs text-ink-soft mt-1">
                    Más viejo: {new Date(r.oldest_at).toLocaleDateString("es-AR")}
                    {stale && ` · ⚠️ ${ageDays} días esperando`}
                  </p>
                </div>
                <div className="flex flex-col gap-2 items-stretch">
                  <Link
                    href={`/admin/shipments/new?customer=${r.user_id}`}
                    className="btn-primary inline-flex"
                  >
                    <Package className="w-4 h-4" /> Armar envío
                  </Link>
                  <Link
                    href={`/admin/customers/${r.user_id}`}
                    className="text-xs text-ink-soft hover:text-rose-deep text-center"
                  >
                    Ver historial
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
