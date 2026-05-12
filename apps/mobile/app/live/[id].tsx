import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Image, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/brand";
import { formatPrice, offerAvailable } from "@cancerianas/shared";
import type { LiveEvent, LiveOffer, LivePurchase } from "@cancerianas/shared";

const TYPE_INFO: Record<string, { emoji: string; name: string }> = {
  capsulas: { emoji: "💊", name: "Cápsulas" },
  sobres: { emoji: "✉️", name: "Sobres" },
  bolsitas: { emoji: "🎀", name: "Bolsitas" },
};

export default function LiveEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [user, setUser] = useState<any>(null);
  const [activePurchase, setActivePurchase] = useState<any>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user)); }, []);

  const loadAll = useCallback(async () => {
    if (!id) return;
    const { data: ev } = await supabase.from("live_events").select("*").eq("id", id).single();
    setEvent(ev as LiveEvent);
    const { data: offs } = await supabase.from("live_offers").select("*").eq("event_id", id).order("display_order");
    setOffers((offs ?? []) as LiveOffer[]);
    if (user) {
      const { data: p } = await supabase
        .from("live_purchases")
        .select("*, live_offers(*)")
        .eq("event_id", id)
        .eq("user_id", user.id)
        .in("status", ["queued", "paying"])
        .maybeSingle();
      setActivePurchase(p);
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`live-mobile-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_events", filter: `id=eq.${id}` }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_offers", filter: `event_id=eq.${id}` }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_purchases", filter: `event_id=eq.${id}` }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, loadAll]);

  // Countdown
  useEffect(() => {
    if (!activePurchase || activePurchase.status !== "paying" || !activePurchase.reserved_until) return;
    const tick = () => {
      const expires = new Date(activePurchase.reserved_until).getTime();
      const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [activePurchase]);

  async function handleBuy(offer: LiveOffer) {
    if (!user) { router.push("/(auth)/login"); return; }
    if (!event || event.status !== "active") {
      Alert.alert("Aviso", "Este evento no está activo");
      return;
    }
    setBusy(offer.id);
    try {
      const { data, error } = await supabase.rpc("buy_live_offer", {
        p_event_id: id, p_offer_id: offer.id, p_user_id: user.id,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) {
        const msg: Record<string, string> = {
          event_not_active: "El evento no está activo",
          offer_inactive: "Esta oferta ya no está disponible",
          sold_out: "¡Se agotó! 🌸",
          queue_closed: "La fila aún no abrió",
          already_in_queue: "Ya estás participando",
        };
        Alert.alert("Aviso", msg[result.error] || "No se pudo procesar");
      } else {
        loadAll();
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(null);
    }
  }

  async function startPayment() {
    setBusy("paying");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-preference`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "live_purchase", id: activePurchase.id }),
      });
      const json = await res.json();
      if (!json.init_point) throw new Error(json.error || "Error iniciando pago");
      await WebBrowser.openBrowserAsync(json.init_point);
      // Al volver, se actualiza por Realtime
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading || !event) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={COLORS.roseDeep} />
      </View>
    );
  }

  const t = TYPE_INFO[event.type];
  const isActive = event.status === "active";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.cream }} contentContainerStyle={{ padding: 16 }}>
      {/* Hero */}
      <View style={{ backgroundColor: isActive ? COLORS.roseDeep : COLORS.inkPrimary, padding: 20, borderRadius: 24, marginBottom: 16 }}>
        {isActive && (
          <View style={{ backgroundColor: "#fff", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8 }}>
            <Text style={{ color: COLORS.roseDeep, fontWeight: "700", fontSize: 11 }}>● EN VIVO</Text>
          </View>
        )}
        <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600", marginBottom: 4 }}>
          {t.name.toUpperCase()}
        </Text>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>{event.title}</Text>
        {event.description && (
          <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 8 }}>{event.description}</Text>
        )}
      </View>

      {/* Compra activa */}
      {activePurchase && activePurchase.status === "queued" && (
        <View style={{ backgroundColor: COLORS.rosePastel, padding: 20, borderRadius: 20, marginBottom: 16, alignItems: "center" }}>
          <Text style={{ fontSize: 16, color: COLORS.inkSecondary }}>Estás en la fila</Text>
          <Text style={{ fontSize: 48, fontWeight: "700", color: COLORS.roseDeep, marginVertical: 8 }}>
            #{activePurchase.queue_position}
          </Text>
          <Text style={{ color: COLORS.inkSoft, textAlign: "center", fontSize: 13 }}>
            Cuando se libere un lugar, te avisamos
          </Text>
        </View>
      )}

      {activePurchase && activePurchase.status === "paying" && secondsLeft !== null && (
        <View style={{
          backgroundColor: secondsLeft < 30 ? "rgba(224,133,133,0.15)" : COLORS.rosePastel,
          padding: 24, borderRadius: 20, marginBottom: 16, alignItems: "center"
        }}>
          <Text style={{ fontSize: 32 }}>🌸</Text>
          <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.inkPrimary, marginTop: 4 }}>
            ¡Es tu turno!
          </Text>
          <Text style={{
            fontSize: 56, fontWeight: "700", marginVertical: 12,
            color: secondsLeft < 30 ? COLORS.error : COLORS.roseDeep,
            fontVariant: ["tabular-nums"],
          }}>
            {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}
          </Text>
          <Text style={{ color: COLORS.inkSoft, fontSize: 12, marginBottom: 16 }}>
            Tiempo para completar el pago
          </Text>
          <Text style={{ fontSize: 24, fontWeight: "700", color: COLORS.inkPrimary, marginBottom: 16 }}>
            {formatPrice(activePurchase.amount)}
          </Text>
          <Pressable
            onPress={startPayment}
            disabled={busy === "paying" || secondsLeft === 0}
            style={{
              backgroundColor: COLORS.roseDeep, paddingVertical: 16, paddingHorizontal: 32,
              borderRadius: 999, opacity: busy === "paying" ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {busy === "paying" ? "Conectando..." : "Pagar con Mercado Pago"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Lista de ofertas */}
      {!activePurchase && (
        <>
          <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.inkPrimary, marginBottom: 12 }}>
            {event.type === "sobres" ? "Sobres disponibles" : "Promociones"}
          </Text>
          {offers.map((offer) => {
            const available = offerAvailable(offer, event);
            const isSoldOut = available <= 0 && event.type === "capsulas";
            const releasePending = event.type === "sobres" && offer.released_count <= offer.sold_count + offer.reserved_count;

            return (
              <View key={offer.id} style={{ backgroundColor: COLORS.white, padding: 16, borderRadius: 20, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                  {offer.image_url ? (
                    <Image source={{ uri: offer.image_url }} style={{ width: 64, height: 64, borderRadius: 14 }} />
                  ) : (
                    <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: COLORS.rosePastel, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 28 }}>{t.emoji}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.inkPrimary }}>{offer.name}</Text>
                    {offer.description && <Text style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{offer.description}</Text>}
                    <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.roseDeep, marginTop: 4 }}>
                      {formatPrice(offer.price)}
                    </Text>
                  </View>
                </View>

                <View style={{ height: 6, backgroundColor: COLORS.rosePastel, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                  <View style={{ height: "100%", width: `${(offer.sold_count / offer.total_stock) * 100}%`, backgroundColor: COLORS.roseDeep }} />
                </View>
                <Text style={{ fontSize: 11, color: COLORS.inkSoft, textAlign: "center", marginBottom: 12 }}>
                  {offer.sold_count} vendidos · {available} disponibles
                </Text>

                <Pressable
                  onPress={() => handleBuy(offer)}
                  disabled={!isActive || busy === offer.id || isSoldOut || releasePending || (event.type === "bolsitas" && !event.queue_open)}
                  style={{
                    backgroundColor: COLORS.roseDeep, padding: 14, borderRadius: 999, alignItems: "center",
                    opacity: (!isActive || busy === offer.id || isSoldOut || releasePending || (event.type === "bolsitas" && !event.queue_open)) ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    {busy === offer.id ? "Procesando..." :
                      isSoldOut ? "Agotado" :
                      releasePending ? "Esperando liberación..." :
                      event.type === "bolsitas" ? "Sumarme a la fila" : "Comprar ahora"}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}
