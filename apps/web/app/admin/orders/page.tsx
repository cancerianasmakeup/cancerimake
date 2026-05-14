import Link from "next/link";
import { Eye, MessageCircle, FileCheck2 } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice } from "@cancerianas/shared";

export const dynamic = "force-dynamic";

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  pending:          { label: "Esperando pago",     color: "bg-warning/30 text-ink-primary" },
  pending_approval: { label: "Aprobar pago",       color: "bg-rose-deep text-white" },
  paid:             { label: "Pagada",             color: "bg-success/30 text-ink-primary" },
  preparing:        { label: "Preparando",         color: "bg-rose-pastel text-rose-deep" },
  shipped:          { label: "Enviada",            color: "bg-rose-medium/40 text-rose-deep" },
  delivered:        { label: "Entregada",          color: "bg-success/40 text-ink-primary" },
  cancelled:        { label: "Cancelada",          color: "bg-error/30 text-ink-primary" },
};

const TABS = [
  { key: "all",              label: "Todas" },
  { key: "pending_approval", label: "🔔 Aprobar pago" },
  { key: "pending",          label: "Esperando pago" },
  { key: "paid",             label: "Pagadas" },
  { key: "preparing",        label: "Preparando" },
  { key: "shipped",          label: "Enviadas" },
];

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab = (TABS.find(t => t.key === rawTab)?.key ?? "all") as string;

  const supabase = await createSupabaseServer();

  let query = supabase
    .from("orders")
    .select("*, profiles(first_name, last_name, full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (tab !== "all") query = query.eq("status", tab);

  const { data: orders } = await query;

  // Conteo total de pendientes para mostrar en el tab
  const { count: pendingApprovalCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_approval");

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl text-ink-primary">Órdenes</h1>
        <p className="text-ink-secondary mt-1">{orders?.length ?? 0} órdenes en esta vista</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/admin/orders" : `/admin/orders?tab=${t.key}`}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
              tab === t.key
                ? "bg-rose-deep text-white shadow-soft"
                : "bg-rose-whisper text-ink-secondary hover:bg-rose-pastel"
            }`}
          >
            {t.label}
            {t.key === "pending_approval" && (pendingApprovalCount ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white text-rose-deep text-[10px] font-bold">
                {pendingApprovalCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-rose-whisper">
            <tr className="text-left text-ink-soft uppercase text-xs">
              <th className="p-3">Nº</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Origen</th>
              <th className="p-3">Total</th>
              <th className="p-3">Comprobante</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Fecha</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o: any) => {
              const fullName = [o.profiles?.first_name, o.profiles?.last_name].filter(Boolean).join(" ")
                || o.profiles?.full_name || "—";
              return (
                <tr key={o.id} className={`border-t border-rose-pastel hover:bg-rose-whisper/50 ${o.status === "pending_approval" ? "bg-rose-deep/5" : ""}`}>
                  <td className="p-3 font-mono font-semibold text-ink-primary">{o.order_number}</td>
                  <td className="p-3">
                    <div className="font-semibold">{fullName}</div>
                    <div className="text-xs text-ink-soft">{o.profiles?.email}</div>
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      o.source === "live" ? "bg-rose-deep text-white" : "bg-rose-pastel text-rose-deep"
                    }`}>
                      {o.source === "live" ? "🌸 LIVE" : "Tienda"}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-rose-deep">{formatPrice(o.total)}</td>
                  <td className="p-3">
                    {o.payment_proof_url && (
                      <span className="inline-flex items-center gap-1 text-xs text-success" title="Comprobante subido">
                        <FileCheck2 className="w-4 h-4" /> Imagen
                      </span>
                    )}
                    {!o.payment_proof_url && o.payment_proof_via_whatsapp && (
                      <span className="inline-flex items-center gap-1 text-xs text-success" title="Por WhatsApp">
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </span>
                    )}
                    {!o.payment_proof_url && !o.payment_proof_via_whatsapp && (
                      <span className="text-xs text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap ${STATUS_INFO[o.status]?.color ?? "bg-rose-pastel"}`}>
                      {STATUS_INFO[o.status]?.label ?? o.status}
                    </span>
                  </td>
                  <td className="p-3 text-ink-soft text-xs">
                    {new Date(o.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/orders/${o.id}`} className="inline-flex p-2 hover:bg-rose-pastel rounded-full">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={8} className="text-center py-16 text-ink-soft">
                  Sin órdenes en esta vista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
