import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Bookmark, ShoppingBag, Truck } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/account");

  const [{ data: profile }, { count: pendingCount }, { count: shipmentActionCount }, { count: shipmentCount }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("live_purchases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending_recovery"),
    supabase
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["pending_address", "pending_payment"]),
    supabase
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  return (
    <>
      <Header />
      <section className="max-w-2xl mx-auto px-4 py-10">
        <div className="card mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-rose-pastel flex items-center justify-center text-2xl">
              🌸
            </div>
            <div>
              <h1 className="font-display text-2xl">{profile?.full_name || "Hola!"}</h1>
              <p className="text-ink-soft text-sm">{profile?.email}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {(shipmentActionCount ?? 0) > 0 && (
            <Link
              href="/account/shipments"
              className="card flex items-center gap-3 hover:shadow-lift transition bg-gradient-to-r from-rose-deep to-rose-primary text-white"
            >
              <Truck className="w-5 h-5" />
              <div className="flex-1">
                <span className="font-bold">Tenés un envío esperando 📦</span>
                <p className="text-xs text-white/90">
                  Completá tus datos para que te lo mandemos
                </p>
              </div>
              <span className="bg-white text-rose-deep font-bold px-2.5 py-1 rounded-full text-sm">
                {shipmentActionCount}
              </span>
            </Link>
          )}

          {(pendingCount ?? 0) > 0 && (
            <Link
              href="/account/pending"
              className="card flex items-center gap-3 hover:shadow-lift transition bg-gradient-to-r from-rose-deep to-rose-primary text-white"
            >
              <Bookmark className="w-5 h-5" />
              <div className="flex-1">
                <span className="font-bold">Mis pendientes</span>
                <p className="text-xs text-white/90">
                  Tenés {pendingCount} compra{pendingCount === 1 ? "" : "s"} esperándote para completar
                </p>
              </div>
              <span className="bg-white text-rose-deep font-bold px-2.5 py-1 rounded-full text-sm">
                {pendingCount}
              </span>
            </Link>
          )}

          <Link
            href="/account/lives"
            className="card flex items-center gap-3 hover:shadow-lift transition"
          >
            <Sparkles className="w-5 h-5 text-rose-deep" />
            <span className="flex-1">Mis LIVEs (historial)</span>
          </Link>

          <Link
            href="/orders"
            className="card flex items-center gap-3 hover:shadow-lift transition"
          >
            <ShoppingBag className="w-5 h-5 text-rose-deep" />
            <span>Mis compras</span>
          </Link>

          {(shipmentCount ?? 0) > 0 && (
            <Link
              href="/account/shipments"
              className="card flex items-center gap-3 hover:shadow-lift transition"
            >
              <Truck className="w-5 h-5 text-rose-deep" />
              <span className="flex-1">Mis envíos</span>
              <span className="text-xs text-ink-soft">{shipmentCount}</span>
            </Link>
          )}

          {profile?.role === "admin" && (
            <Link
              href="/admin"
              className="card flex items-center gap-3 hover:shadow-lift transition bg-gradient-to-r from-rose-deep to-rose-primary text-white"
            >
              <span>🌸 Panel de admin</span>
            </Link>
          )}
          <LogoutButton />
        </div>
      </section>
      <Footer />
    </>
  );
}
