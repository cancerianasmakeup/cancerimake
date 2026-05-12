import Link from "next/link";
import { Eye } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-warning/30 text-ink-primary" },
  paid: { label: "Pagada", color: "bg-success/30 text-ink-primary" },
  preparing: { label: "Preparando", color: "bg-rose-pastel text-rose-deep" },
  shipped: { label: "Enviada", color: "bg-rose-medium/40 text-rose-deep" },
  delivered: { label: "Entregada", color: "bg-success/40 text-ink-primary" },
  cancelled: { label: "Cancelada", color: "bg-error/30 text-ink-primary" },
};

export default async function AdminOrders() {
  const supabase = await createSupabaseServer();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Órdenes</h1>
        <p className="text-ink-secondary mt-1">{orders?.length ?? 0} órdenes recientes</p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-rose-whisper">
            <tr className="text-left text-ink-soft uppercase text-xs">
              <th className="p-4">Nº</th>
              <th className="p-4">Cliente</th>
              <th className="p-4">Origen</th>
              <th className="p-4">Total</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Fecha</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o: any) => (
              <tr key={o.id} className="border-t border-rose-pastel hover:bg-rose-whisper/50">
                <td className="p-4 font-mono font-semibold text-ink-primary">{o.order_number}</td>
                <td className="p-4">
                  <div className="font-semibold">{o.profiles?.full_name || "—"}</div>
                  <div className="text-xs text-ink-soft">{o.profiles?.email}</div>
                </td>
                <td className="p-4">
                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
                    o.source === "live" ? "bg-rose-deep text-white" : "bg-rose-pastel text-rose-deep"
                  }`}>
                    {o.source === "live" ? "🌸 LIVE" : "Tienda"}
                  </span>
                </td>
                <td className="p-4 font-bold text-rose-deep">{formatPrice(o.total)}</td>
                <td className="p-4">
                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${STATUS_INFO[o.status]?.color}`}>
                    {STATUS_INFO[o.status]?.label}
                  </span>
                </td>
                <td className="p-4 text-ink-soft text-xs">
                  {new Date(o.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="p-4 text-right">
                  <Link href={`/admin/orders/${o.id}`} className="inline-flex p-2 hover:bg-rose-pastel rounded-full">
                    <Eye className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={7} className="text-center py-16 text-ink-soft">
                  Todavía no hay órdenes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
