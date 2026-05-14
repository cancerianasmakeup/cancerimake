"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Users, ShoppingBag, Clock, AlertCircle, LogIn } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { formatPrice, offerAvailable } from "@cancerianas/shared";
import type { LiveEvent, LiveOffer, LivePurchase } from "@cancerianas/shared";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LivePurchaseFlow from "@/components/LivePurchaseFlow";
import LoginModal from "@/components/LoginModal";

const TYPE_INFO: Record<string, { emoji: string; name: string }> = {
  capsulas: { emoji: "💊", name: "Cápsulas" },
  sobres: { emoji: "✉️", name: "Sobres" },
  bolsitas: { emoji: "🎀", name: "Bolsitas" },
};

export default function LiveEventPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [user, setUser] = useState<any>(null);
  const [activePurchase, setActivePurchase] = useState<LivePurchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  // Guardamos la oferta que la clienta quería comprar antes de loguearse, para
  // disparar la compra automáticamente después del login.
  const pendingOfferRef = useRef<LiveOffer | null>(null);

  useEffect(() => {
    params.then(p => setEventId(p.id));
  }, [params]);

  // Suscripción al estado de auth para que el label del botón se actualice
  // automáticamente al loguearse (incluido el caso del modal).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Cargar evento + ofertas + compra activa
  const loadAll = useCallback(async () => {
    if (!eventId) return;
    const { data: ev } = await supabase
      .from("live_events").select("*").eq("id", eventId).single();
    setEvent(ev as LiveEvent);

    const { data: offs } = await supabase
      .from("live_offers").select("*")
      .eq("event_id", eventId)
      .order("display_order");
    setOffers((offs ?? []) as LiveOffer[]);

    if (user) {
      const { data: purchase } = await supabase
        .from("live_purchases")
        .select("*, live_offers(*)")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .in("status", ["queued", "paying"])
        .maybeSingle();
      setActivePurchase(purchase as LivePurchase);
    }

    setLoading(false);
  }, [eventId, user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime: estado del evento, ofertas y mi compra
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`live-event-${eventId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "live_events", filter: `id=eq.${eventId}` },
        () => loadAll())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "live_offers", filter: `event_id=eq.${eventId}` },
        () => loadAll())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "live_purchases", filter: `event_id=eq.${eventId}` },
        (payload) => {
          loadAll();
          // Si pasó al estado paying, notificar
          if (user && (payload.new as any)?.user_id === user.id && (payload.new as any)?.status === "paying") {
            toast.success("¡Es tu turno! Tenés 3 minutos para pagar 🌸");
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, user, loadAll]);

  async function handleBuy(offer: LiveOffer) {
    if (!user) {
      pendingOfferRef.current = offer;
      setLoginOpen(true);
      return;
    }
    if (!event || event.status !== "active") {
      toast.error("Este evento no está activo");
      return;
    }

    setBuying(offer.id);
    try {
      const { data, error } = await supabase.rpc("buy_live_offer", {
        p_event_id: eventId,
        p_offer_id: offer.id,
        p_user_id: user.id,
      });

      if (error) throw error;
      const result = data as any;

      if (!result.success) {
        const messages: Record<string, string> = {
          event_not_active: "El evento no está activo",
          offer_inactive: "Esta oferta ya no está disponible",
          sold_out: "¡Se agotó! 🌸",
          queue_closed: "La fila aún no abrió",
          already_in_queue: "Ya estás participando en esta oferta",
        };
        toast.error(messages[result.error] || "No se pudo procesar");
        return;
      }

      if (result.status === "paying") {
        toast.success("¡Lugar reservado! Tenés 3 minutos para pagar 🌸");
      } else if (result.status === "queued") {
        toast.success(`Estás en la fila, posición ${result.position}`);
      }
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBuying(null);
    }
  }

  if (loading || !event) {
    return (
      <>
        <Header />
        <div className="text-center py-32 text-ink-soft">Cargando evento...</div>
        <Footer />
      </>
    );
  }

  const t = TYPE_INFO[event.type];
  const isActive = event.status === "active";
  const isFinished = event.status === "finished";
  const isPaused = event.status === "paused";
  const isDraft = event.status === "draft";

  return (
    <>
      <Header />

      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        {/* HERO del evento */}
        <div className={`rounded-3xl p-6 md:p-10 mb-6 text-white relative overflow-hidden ${
          isActive ? "bg-gradient-to-br from-rose-deep via-rose-primary to-rose-medium" : "bg-ink-primary"
        }`}>
          <div className="absolute top-0 right-0 text-[16rem] opacity-10 -mr-12 -mt-16 leading-none select-none">
            {t.emoji}
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              {isActive && <span className="badge-live bg-white text-rose-deep">EN VIVO</span>}
              {isPaused && <span className="bg-warning/30 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">PAUSADO</span>}
              {isFinished && <span className="bg-white/20 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">FINALIZADO</span>}
              {isDraft && <span className="bg-white/20 text-white text-xs font-bold uppercase px-3 py-1 rounded-full">PRÓXIMAMENTE</span>}
              <span className="text-white/80 text-xs font-semibold">{t.name}</span>
            </div>
            <h1 className="font-display text-3xl md:text-5xl leading-tight">{event.title}</h1>
            {event.description && (
              <p className="text-white/90 mt-3 text-sm md:text-base">{event.description}</p>
            )}
            <div className="flex gap-6 mt-6 text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{event.total_buyers} compras</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>{formatPrice(event.total_revenue)} recaudado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Si tengo compra activa, mostrar flujo */}
        {activePurchase && (
          <LivePurchaseFlow
            purchase={activePurchase}
            onUpdate={loadAll}
          />
        )}

        {/* Mensajes de estado */}
        {isFinished && (
          <div className="card bg-rose-pastel text-center py-10 mb-6">
            <p className="font-display text-xl text-ink-primary">Este evento finalizó 🌸</p>
            <p className="text-ink-soft mt-2">Vuelvé pronto, hay más cosas geniales en camino.</p>
          </div>
        )}
        {isDraft && (
          <div className="card bg-rose-pastel text-center py-10 mb-6">
            <p className="font-display text-xl text-ink-primary">Próximamente 💗</p>
            <p className="text-ink-soft mt-2">El admin todavía no activó este evento.</p>
          </div>
        )}
        {isPaused && (
          <div className="card bg-warning/20 text-center py-6 mb-6">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-warning" />
            <p className="font-semibold text-ink-primary">El evento está pausado momentáneamente</p>
          </div>
        )}

        {/* Bolsitas: estado de la fila */}
        {event.type === "bolsitas" && isActive && !event.queue_open && !activePurchase && (
          <div className="card bg-gradient-to-br from-rose-pastel to-rose-medium/30 text-center py-8 mb-6">
            <Clock className="w-8 h-8 mx-auto mb-3 text-rose-deep" />
            <p className="font-display text-xl text-ink-primary mb-2">La fila aún no abrió</p>
            <p className="text-ink-secondary text-sm">Esperá la señal del LIVE para sumarte.</p>
          </div>
        )}

        {/* Lista de ofertas */}
        {!activePurchase && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-ink-primary">
              {event.type === "sobres" ? "Sobres disponibles" : "Promociones"}
            </h2>
            {offers.map((offer) => {
              const available = offerAvailable(offer, event);
              const total = event.type === "sobres" ? offer.released_count : offer.total_stock;
              const sold = offer.sold_count;
              const reserved = offer.reserved_count;
              const isSoldOut = available <= 0 && event.type === "capsulas";
              const isReleasePending = event.type === "sobres" && offer.released_count <= offer.sold_count + offer.reserved_count;

              return (
                <div key={offer.id} className="card">
                  <div className="flex items-start gap-4">
                    {offer.image_url ? (
                      <img src={offer.image_url} alt="" className="w-20 h-20 rounded-2xl object-cover" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-rose-pastel flex items-center justify-center text-3xl">
                        {t.emoji}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg text-ink-primary">{offer.name}</h3>
                      {offer.description && (
                        <p className="text-sm text-ink-soft mt-1">{offer.description}</p>
                      )}
                      <p className="font-display text-2xl font-bold text-rose-deep mt-2">
                        {formatPrice(offer.price)}
                      </p>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-ink-soft mb-1">
                      <span>{sold} vendidos · {reserved} en proceso</span>
                      <span className="font-semibold">{available} disponibles{event.type === "sobres" ? ` de ${offer.total_stock}` : ""}</span>
                    </div>
                    <div className="h-2 bg-rose-pastel rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-deep to-rose-primary transition-all"
                        style={{ width: `${(sold / offer.total_stock) * 100}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleBuy(offer)}
                    disabled={
                      !isActive ||
                      buying === offer.id ||
                      isSoldOut ||
                      isReleasePending ||
                      (event.type === "bolsitas" && !event.queue_open)
                    }
                    className="btn-primary w-full mt-4"
                  >
                    {buying === offer.id ? "Procesando..." :
                      isSoldOut ? "Agotado" :
                      isReleasePending ? "Esperando que admin libere..." :
                      !user ? "Iniciá sesión para comprar" :
                      event.type === "bolsitas" ? "Sumarme a la fila" :
                      "Comprar ahora"}
                    {!isSoldOut && !isReleasePending && (
                      !user ? <LogIn className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />

      <LoginModal
        open={loginOpen}
        onClose={() => { setLoginOpen(false); pendingOfferRef.current = null; }}
        title="Iniciá sesión para comprar en el LIVE"
        onSuccess={() => {
          const offer = pendingOfferRef.current;
          pendingOfferRef.current = null;
          // Esperamos un tick para que onAuthStateChange actualice 'user',
          // así handleBuy ve al usuario logueado.
          if (offer) setTimeout(() => handleBuy(offer), 50);
        }}
      />
    </>
  );
}
