import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Truck, Package } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice } from "@cancerianas/shared";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; color: string; emoji: string; cta?: string }> = {
  pending_address: { label: "Completá tu dirección", color: "bg-rose-deep text-white", emoji: "📝", cta: "Completar" },
  pending_payment: { label: "Falta pagar", color: "bg-warning/40 text-ink-primary", emoji: "⏳", cta: "Pagar ahora" },
  paid: { label: "Pagado · preparando", color: "bg-success/40 text-ink-primary", emoji: "💚" },
  label_generated: { label: "Listo para despachar", color: "bg-rose-pastel text-ink-primary", emoji: "🏷️" },
  dispatched: { label: "Despachado", color: "bg-rose-medium text-ink-primary", emoji: "📦" },
  in_transit: { label: "En camino", color: "bg-rose-pastel text-ink-primary", emoji: "🚚" },
  out_for_delivery: { label: "Hoy llega", color: "bg-rose-deep text-white animate-soft-pulse", emoji: "🚪" },
  delivered: { label: "Entregado", color: "bg-success/30 text-ink-primary", emoji: "✅" },
  returned: { label: "Devuelto", color: "bg-error/20 text-ink-primary", emoji: "↩️" },
  failed: { label: "Falló entrega", color: "bg-error/30 text-ink-primary", emoji: "⚠️" },
  cancelled: { label: "Cancelado", color: "bg-ink-soft/15 text-ink-soft", emoji: "❌" },
};

export default async function MyShipmentsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/account/shipments");

  const { data: shipments } = await supabase
    .from("shipments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const list = shipments ?? [];
  const pending = list.filter((s: any) => s.status === "pending_address" || s.status === "pending_payment");
  const active = list.filter((s: any) => !["pending_address", "pending_payment", "delivered", "cancelled", "returned", "failed"].includes(s.status));
  const finished = list.filter((s: any) => ["delivered", "cancelled", "returned", "failed"].includes(s.status));

  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/account" className="inline-flex items-center gap-2 text-ink-soft hover:text-rose-deep mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Mi cuenta
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-ink-primary mb-2">Mis envíos 📦</h1>

        {list.length === 0 ? (
          <div className="card text-center py-16 mt-6">
            <Truck className="w-12 h-12 mx-auto text-ink-soft mb-3" />
            <p className="text-ink-secondary">Todavía no tenés envíos.</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && <Section title="Acción requerida 🔔" items={pending} highlight />}
            {active.length > 0 && <Section title="En proceso" items={active} />}
            {finished.length > 0 && <Section title="Historial" items={finished} muted />}
          </>
        )}
      </section>
      <Footer />
    </>
  );
}

function Section({ title, items, highlight, muted }: { title: string; items: any[]; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="mt-6">
      <h2 className={`text-sm uppercase font-bold tracking-wider mb-3 ${highlight ? "text-rose-deep" : muted ? "text-ink-soft" : "text-ink-secondary"}`}>
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((s) => {
          const meta = STATUS_META[s.status] ?? { label: s.status, color: "bg-ink-soft/15 text-ink-soft", emoji: "•" };
          return (
            <Link key={s.id} href={`/shipment/${s.id}`} className="card flex items-center gap-3 hover:shadow-lift transition-all hover:-translate-y-0.5">
              <div className={`w-12 h-12 rounded-2xl bg-rose-pastel flex items-center justify-center text-2xl flex-shrink-0`}>
                {meta.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink-primary line-clamp-1">{s.description}</p>
                <p className="text-xs text-ink-soft">
                  {(s.weight_grams / 1000).toFixed(2)}kg · {new Date(s.created_at).toLocaleDateString("es-AR")}
                </p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${meta.color}`}>
                  {meta.label}
                </span>
              </div>
              {s.cost_charged && (
                <div className="text-right">
                  <p className="font-bold text-rose-deep">{formatPrice(Number(s.cost_charged))}</p>
                  {meta.cta && <p className="text-xs text-rose-deep font-semibold">{meta.cta} →</p>}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
