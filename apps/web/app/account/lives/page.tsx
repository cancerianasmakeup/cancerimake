import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
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

export default async function MyLivesPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=/account/lives");

  // Lives en los que participé (group by event_id, computar stats por usuario)
  const { data: rows } = await supabase
    .from("live_purchases")
    .select(
      `
      id, status, amount, created_at, paid_at,
      live_offers(name),
      live_events(id, title, type, status, started_at, finished_at, cover_image)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Agrupar por evento
  const byEvent = new Map<string, any>();
  (rows ?? []).forEach((r: any) => {
    const ev = r.live_events;
    if (!ev) return;
    if (!byEvent.has(ev.id)) {
      byEvent.set(ev.id, {
        event: ev,
        purchases: [],
        paidCount: 0,
        paidAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      });
    }
    const g = byEvent.get(ev.id)!;
    g.purchases.push(r);
    if (r.status === "paid") {
      g.paidCount++;
      g.paidAmount += Number(r.amount);
    }
    if (r.status === "pending_recovery") {
      g.pendingCount++;
      g.pendingAmount += Number(r.amount);
    }
  });

  const groups = Array.from(byEvent.values()).sort(
    (a, b) =>
      new Date(b.event.started_at || b.event.created_at).getTime() -
      new Date(a.event.started_at || a.event.created_at).getTime()
  );

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

        <h1 className="font-display text-3xl md:text-4xl text-ink-primary mb-2">Mis LIVEs</h1>
        <p className="text-ink-soft mb-6">Historial de eventos en los que participaste.</p>

        {groups.length === 0 ? (
          <div className="card text-center py-16">
            <Sparkles className="w-12 h-12 mx-auto text-rose-deep mb-3" />
            <p className="text-ink-secondary mb-2">Todavía no participaste de ningún LIVE.</p>
            <Link href="/live" className="text-rose-deep font-semibold">
              Ver próximos eventos →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(({ event, purchases, paidCount, paidAmount, pendingCount, pendingAmount }) => (
              <div key={event.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{TYPE_EMOJI[event.type]}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg text-ink-primary line-clamp-1">{event.title}</h3>
                    <p className="text-xs text-ink-soft">
                      {event.started_at
                        ? new Date(event.started_at).toLocaleString("es-AR")
                        : "Sin fecha"}{" "}
                      · {event.status}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="rounded-2xl bg-success/15 p-3 text-center">
                    <div className="text-xs uppercase text-ink-soft tracking-wider">Compraste</div>
                    <div className="font-bold text-ink-primary">
                      {paidCount} · {formatPrice(paidAmount)}
                    </div>
                  </div>
                  <div className={`rounded-2xl p-3 text-center ${pendingCount > 0 ? "bg-rose-deep/15" : "bg-ink-soft/10"}`}>
                    <div className="text-xs uppercase text-ink-soft tracking-wider">Pendientes</div>
                    <div className={`font-bold ${pendingCount > 0 ? "text-rose-deep" : "text-ink-soft"}`}>
                      {pendingCount > 0 ? `${pendingCount} · ${formatPrice(pendingAmount)}` : "—"}
                    </div>
                  </div>
                </div>

                <details className="mt-3">
                  <summary className="text-sm text-rose-deep font-semibold cursor-pointer">
                    Ver todos mis intentos ({purchases.length})
                  </summary>
                  <div className="space-y-1.5 mt-2 pl-1">
                    {purchases.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-rose-pastel/50">
                        <div>
                          <span className="font-semibold">{p.live_offers?.name}</span>
                          <span className="text-ink-soft text-xs ml-2">
                            {p.status === "paid"
                              ? "✅ pagada"
                              : p.status === "pending_recovery"
                              ? "🔖 guardada"
                              : p.status === "expired"
                              ? "⌛ expiró"
                              : p.status}
                          </span>
                        </div>
                        <span className="text-ink-secondary">{formatPrice(Number(p.amount))}</span>
                      </div>
                    ))}
                  </div>
                </details>

                {pendingCount > 0 && (
                  <Link
                    href="/account/pending"
                    className="btn-primary w-full mt-3 text-sm"
                  >
                    Completar mis pendientes →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </>
  );
}
