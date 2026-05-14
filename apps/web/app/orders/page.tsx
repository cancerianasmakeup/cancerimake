import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { formatPrice } from "@cancerianas/shared";
import { getOrderStatusLabel } from "@/lib/order-status";

export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/orders");

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(description, quantity, image_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl md:text-4xl text-ink-primary mb-6">Mis compras</h1>

        {!orders || orders.length === 0 ? (
          <div className="card text-center py-16">
            <ShoppingBag className="w-12 h-12 mx-auto text-rose-deep mb-3" />
            <p className="text-ink-secondary mb-4">Todavía no tenés compras 🌸</p>
            <Link href="/" className="btn-primary">Ir a la tienda</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o: any) => {
              const status = getOrderStatusLabel(o.status);
              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="card flex gap-4 hover:shadow-lift transition-all hover:-translate-y-0.5"
                >
                  <div className="flex -space-x-2">
                    {o.order_items.slice(0, 3).map((it: any, i: number) => (
                      <div key={i} className="w-14 h-14 rounded-2xl bg-rose-pastel border-2 border-cream overflow-hidden">
                        {it.image_url ? <img src={it.image_url} alt="" className="w-full h-full object-cover" /> : <div className="text-xl flex items-center justify-center w-full h-full">🌸</div>}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-ink-soft">{o.order_number}</span>
                      {o.source === "live" && <span className="badge-live text-[10px] py-0.5">LIVE</span>}
                    </div>
                    <p className="font-display text-lg text-ink-primary line-clamp-1">
                      {o.order_items[0]?.description}
                      {o.order_items.length > 1 && ` y ${o.order_items.length - 1} más`}
                    </p>
                    <p className="text-xs text-ink-soft">{new Date(o.created_at).toLocaleDateString("es-AR")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-rose-deep">{formatPrice(o.total)}</p>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mt-1 ${status.badge}`}>
                      {status.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <Footer />
    </>
  );
}
