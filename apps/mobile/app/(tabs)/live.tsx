import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/brand";
import type { LiveEvent } from "@cancerianas/shared";

const TYPE_INFO: Record<string, { emoji: string; name: string; tagline: string }> = {
  capsulas: { emoji: "💊", name: "Cápsulas", tagline: "Stock fijo, comprá libre" },
  sobres: { emoji: "✉️", name: "Sobres", tagline: "Liberación uno a uno" },
  bolsitas: { emoji: "🎀", name: "Bolsitas", tagline: "Fila por orden de llegada" },
};

export default function LiveTab() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("live_events")
      .select("*")
      .in("status", ["active", "paused", "draft"])
      .order("created_at", { ascending: false });
    setEvents((data ?? []) as LiveEvent[]);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("live-tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_events" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.cream }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <View style={{ alignItems: "center", marginBottom: 24, marginTop: 8 }}>
        <View style={{ backgroundColor: COLORS.rosePastel, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, marginBottom: 12 }}>
          <Text style={{ color: COLORS.roseDeep, fontWeight: "700", fontSize: 11, letterSpacing: 1 }}>LIVE SHOPPING</Text>
        </View>
        <Text style={{ fontSize: 28, fontWeight: "700", color: COLORS.inkPrimary, textAlign: "center" }}>
          Las dinámicas en vivo
        </Text>
        <Text style={{ color: COLORS.inkSecondary, textAlign: "center", marginTop: 8, paddingHorizontal: 20 }}>
          Mientras hago el LIVE en TikTok, vos comprás acá con lugar reservado.
        </Text>
      </View>

      {events.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>🌸</Text>
          <Text style={{ color: COLORS.inkSoft, textAlign: "center" }}>
            No hay eventos LIVE en este momento.{"\n"}Seguinos en TikTok para enterarte cuándo arranca el próximo.
          </Text>
        </View>
      ) : (
        events.map((ev) => {
          const t = TYPE_INFO[ev.type];
          const isLive = ev.status === "active";
          return (
            <Pressable
              key={ev.id}
              onPress={() => router.push(`/live/${ev.id}`)}
              style={{
                padding: 20,
                borderRadius: 24,
                marginBottom: 12,
                backgroundColor: isLive ? COLORS.roseDeep : COLORS.white,
                shadowColor: COLORS.roseMedium,
                shadowOpacity: isLive ? 0.4 : 0.15,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 48, marginRight: 14 }}>{t.emoji}</Text>
                <View style={{ flex: 1 }}>
                  {isLive && (
                    <View style={{ backgroundColor: "#fff", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 4 }}>
                      <Text style={{ color: COLORS.roseDeep, fontSize: 10, fontWeight: "700" }}>● EN VIVO</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 11, fontWeight: "600", color: isLive ? "rgba(255,255,255,0.8)" : COLORS.inkSoft, marginBottom: 2 }}>
                    {t.name.toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: isLive ? "#fff" : COLORS.inkPrimary }}>
                    {ev.title}
                  </Text>
                  {ev.description ? (
                    <Text style={{ fontSize: 13, color: isLive ? "rgba(255,255,255,0.85)" : COLORS.inkSecondary, marginTop: 4 }} numberOfLines={2}>
                      {ev.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}
