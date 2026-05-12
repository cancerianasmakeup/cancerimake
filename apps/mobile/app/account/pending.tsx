import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Image } from "react-native";
import { router, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/brand";
import { formatPrice } from "@cancerianas/shared";

const TYPE_EMOJI: Record<string, string> = {
  capsulas: "💊",
  sobres: "✉️",
  bolsitas: "🎀",
};

export default function PendingScreen() {
  const [pendings, setPendings] = useState<any[]>([]);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      router.replace("/(auth)/login");
      return;
    }
    const [{ data: pend }, { data: ae }] = await Promise.all([
      supabase
        .from("live_purchases")
        .select(
          `id, status, amount, created_at, admin_notes,
           live_offers(id, name, image_url),
           live_events(id, title, type, started_at)`
        )
        .eq("user_id", u.user.id)
        .eq("status", "pending_recovery")
        .order("created_at", { ascending: false }),
      supabase
        .from("live_events")
        .select("id, title")
        .eq("status", "active")
        .maybeSingle(),
    ]);
    setPendings(pend ?? []);
    setActiveEvent(ae);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <>
      <Stack.Screen
        options={{ title: "Mis pendientes 🔖", headerShown: true, headerStyle: { backgroundColor: COLORS.cream } }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.cream }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeEvent && pendings.length > 0 && (
          <Pressable
            onPress={() => router.push(`/live/${activeEvent.id}`)}
            style={{ marginBottom: 14, borderRadius: 24, overflow: "hidden" }}
          >
            <LinearGradient
              colors={["#E66B85", "#FF8FA3"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Text style={{ fontSize: 36 }}>🔴</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                  ¡LIVE en vivo ahora!
                </Text>
                <Text style={{ color: "#fff", opacity: 0.95, fontSize: 12 }}>
                  "{activeEvent.title}"
                </Text>
              </View>
              <View style={{ backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 }}>
                <Text style={{ color: COLORS.roseDeep, fontWeight: "800" }}>Entrar</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {pendings.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🌸</Text>
            <Text style={{ color: COLORS.inkSecondary, fontWeight: "700", marginBottom: 6 }}>
              No tenés pendientes
            </Text>
            <Text style={{ color: COLORS.inkSoft, fontSize: 12, textAlign: "center", paddingHorizontal: 30 }}>
              Cuando ganes algo en un LIVE y no termines de pagar, lo vas a ver acá
            </Text>
          </View>
        ) : (
          <>
            <Text style={{ color: COLORS.inkSoft, marginBottom: 12, fontSize: 13 }}>
              Cosas que reservaste o ganaste y todavía no completaste el pago.
            </Text>
            {pendings.map((p: any) => (
              <View key={p.id} style={{ backgroundColor: COLORS.white, padding: 14, borderRadius: 20, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {p.live_offers?.image_url ? (
                    <Image
                      source={{ uri: p.live_offers.image_url }}
                      style={{ width: 70, height: 70, borderRadius: 16 }}
                    />
                  ) : (
                    <View style={{ width: 70, height: 70, backgroundColor: COLORS.rosePastel, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 28 }}>{TYPE_EMOJI[p.live_events?.type] ?? "🌸"}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ fontSize: 11, color: COLORS.roseDeep, fontWeight: "800", textTransform: "uppercase" }}>
                        🔖 Guardado para vos
                      </Text>
                    </View>
                    <Text style={{ fontWeight: "800", fontSize: 16, color: COLORS.inkPrimary, marginTop: 2 }}>
                      {p.live_offers?.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.inkSoft }}>
                      Del LIVE "{p.live_events?.title}"
                    </Text>
                  </View>
                </View>

                {p.admin_notes && (
                  <View style={{ backgroundColor: COLORS.roseWhisper, padding: 10, borderRadius: 12, marginTop: 10 }}>
                    <Text style={{ fontSize: 12, color: COLORS.inkSecondary, fontStyle: "italic" }}>
                      💬 {p.admin_notes}
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.roseDeep }}>
                    {formatPrice(Number(p.amount))}
                  </Text>
                  <Pressable
                    onPress={() => router.push(`/live/${p.live_events?.id}?recover=${p.id}`)}
                    style={{ backgroundColor: COLORS.roseDeep, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800" }}>Pagar →</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ backgroundColor: `${COLORS.rosePastel}80`, padding: 14, borderRadius: 16, marginTop: 16 }}>
          <Text style={{ fontSize: 12, color: COLORS.inkSecondary, lineHeight: 18 }}>
            <Text style={{ fontWeight: "800" }}>💡 Cómo funciona: </Text>
            cuando ganás algo en un LIVE, tenés tiempo limitado para pagar. Si no llegás, queda guardado acá.
            Te avisamos cada vez que arrancamos un LIVE nuevo para que lo completes.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
