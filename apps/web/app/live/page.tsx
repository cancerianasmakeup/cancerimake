"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, Clock } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { LiveEvent } from "@cancerianas/shared";

const TYPE_INFO: Record<string, { emoji: string; name: string; tagline: string }> = {
  capsulas: { emoji: "💊", name: "Cápsulas", tagline: "Stock fijo, comprá mientras haya" },
  sobres: { emoji: "✉️", name: "Sobres", tagline: "Liberación uno a uno, ¡rápida!" },
  bolsitas: { emoji: "🎀", name: "Bolsitas", tagline: "Fila justa por orden de llegada" },
};

export default function LiveHubPage() {
  const supabase = createSupabaseBrowser();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("live_events")
        .select("*")
        .in("status", ["active", "paused", "draft"])
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setEvents((data ?? []) as LiveEvent[]);
        setLoading(false);
      }
    }
    load();

    const channel = supabase
      .channel("live-hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_events" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  return (
    <>
      <Header />
      <section className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center mb-12">
          <span className="badge-live mb-4 inline-flex">LIVE SHOPPING</span>
          <h1 className="font-display text-4xl md:text-6xl text-ink-primary mt-4">
            Las dinámicas <span className="italic text-rose-deep">en vivo</span>
          </h1>
          <p className="text-ink-secondary mt-3 max-w-xl mx-auto">
            Mientras hago el LIVE en TikTok, vos comprás acá con lugar reservado y pago seguro por Mercado Pago.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-ink-soft">Cargando...</div>
        ) : events.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-6xl mb-4">🌸</div>
            <p className="text-ink-secondary mb-2">No hay eventos LIVE en este momento.</p>
            <p className="text-ink-soft text-sm">Seguinos en TikTok para enterarte cuándo arranca el próximo.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((ev) => {
              const t = TYPE_INFO[ev.type];
              const isLive = ev.status === "active";
              return (
                <Link
                  key={ev.id}
                  href={`/live/${ev.id}`}
                  className={`block rounded-3xl p-6 md:p-8 transition-all hover:-translate-y-1 hover:shadow-lift ${
                    isLive
                      ? "bg-gradient-to-br from-rose-deep to-rose-primary text-white shadow-glow animate-soft-pulse"
                      : "bg-white shadow-soft"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-5xl md:text-6xl">{t.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {isLive ? (
                          <span className="badge-live bg-white text-rose-deep">EN VIVO</span>
                        ) : ev.status === "paused" ? (
                          <span className="bg-warning/30 text-ink-primary text-xs font-bold uppercase px-3 py-1 rounded-full">PAUSADO</span>
                        ) : (
                          <span className="bg-rose-pastel text-rose-deep text-xs font-bold uppercase px-3 py-1 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" /> PRÓXIMAMENTE
                          </span>
                        )}
                        <span className={`text-xs font-semibold ${isLive ? "text-white/80" : "text-ink-soft"}`}>
                          {t.name}
                        </span>
                      </div>
                      <h3 className={`font-display text-2xl md:text-3xl leading-tight ${isLive ? "text-white" : "text-ink-primary"}`}>
                        {ev.title}
                      </h3>
                      {ev.description && (
                        <p className={`mt-2 text-sm ${isLive ? "text-white/90" : "text-ink-secondary"}`}>
                          {ev.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className={`w-6 h-6 mt-2 ${isLive ? "text-white" : "text-rose-deep"}`} />
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
