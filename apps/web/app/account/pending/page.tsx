import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bookmark, Sparkles } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { formatPrice } from "@cancerianas/shared";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

const TYPE_EMOJI: Record<string, string> = {
  capsulas: "💊",
  sobres: "✉️",
  bolsitas: "🎀",
};

export default async function MyPendingPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/account/pending");

  // Compras pendientes de pago (status pending_recovery) + datos del evento y oferta
  const { data: pendings } = await supabase
    .from("live_purchases")
    .select(
      `
      id, status, amount, created_at, admin_notes,
      live_offers(id, name, image_url, price),
      live_events(id, title, type, status, started_at, cover_image)
    `
    )
    .eq("user_id", user.id)
    .eq("status", "pending_recovery")
    .order("created_at", { ascending: false });

  // Cuál evento está active ahora?
  const { data: activeEvent } = await supabase
    .from("live_events")
    .select("id, title")
    .eq("status", "active")
    .maybeSingle();

  const list = pendings ?? [];

  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-4 py-10">
        <Link
          href="/account"
          className="inline-flex items-center gap-2 text-ink-soft hover:text-rose-deep mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a mi cuenta
        </Link>

        <h1 className="font-display text-3xl md:text-4xl text-ink-primary mb-2">
          Mis pendientes 🔖
        </h1>
        <p className="text-ink-soft mb-6">
          Cosas que ganaste o reservaste en LIVEs anteriores y todavía no completaste el pago.
        </p>

        {activeEvent && list.length > 0 && (
          <div className="card bg-gradient-to-r from-rose-deep to-rose-primary text-white mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              <div>
                <p className="font-bold">¡Hay un LIVE en vivo ahora!</p>
                <p className="text-sm text-white/90">"{activeEvent.title}"</p>
              </div>
              <Link
                href={`/live/${activeEvent.id}`}
                className="ml-auto bg-white text-rose-deep px-4 py-2 rounded-full font-bold text-sm"
              >
                Entrar
              </Link>
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-3">🌸</div>
            <p className="text-ink-secondary mb-2">No tenés pendientes 💖</p>
            <p className="text-ink-soft text-sm">
              Cuando ganes algo en un LIVE y no termines de pagar, lo vas a ver acá.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((p: any) => (
              <div key={p.id} className="card">
                <div className="flex items-start gap-3">
                  {p.live_offers?.image_url ? (
                    <img
                      src={p.live_offers.image_url}
                      alt=""
                      className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-rose-pastel flex items-center justify-center text-3xl flex-shrink-0">
                      {TYPE_EMOJI[p.live_events?.type] ?? "🌸"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bookmark className="w-3.5 h-3.5 text-rose-deep" />
                      <span className="text-xs font-bold uppercase text-rose-deep tracking-wider">
                        Guardado para vos
                      </span>
                    </div>
                    <h3 className="font-display text-xl text-ink-primary line-clamp-2">
                      {p.live_offers?.name}
                    </h3>
                    <p className="text-sm text-ink-soft">
                      Del LIVE "{p.live_events?.title}" ·{" "}
                      {new Date(p.created_at).toLocaleDateString("es-AR")}
                    </p>
                    {p.admin_notes && (
                      <p className="text-xs italic text-ink-secondary mt-2 bg-rose-whisper px-3 py-1.5 rounded-xl">
                        💬 {p.admin_notes}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      <span className="text-2xl font-bold text-rose-deep">
                        {formatPrice(Number(p.amount))}
                      </span>
                      <Link
                        href={`/live/${p.live_events?.id}?recover=${p.id}`}
                        className="btn-primary text-sm"
                      >
                        Pagar ahora →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card bg-rose-whisper/60 mt-6">
          <p className="text-sm text-ink-secondary">
            <strong>💡 Cómo funciona:</strong> cuando ganás algo en un LIVE, tenés tiempo limitado para pagar.
            Si no llegás, tu compra queda guardada acá. Te avisamos cada vez que arrancamos un LIVE nuevo
            para que la completes.
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}
