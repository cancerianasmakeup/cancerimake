import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { router, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/brand";
import { formatPrice } from "@cancerianas/shared";

const TYPE_EMOJI: Record<string, string> = {
  capsulas: "💊",
  sobres: "✉️",
  bolsitas: "🎀",
};

export default function MyLivesScreen() {
  const [groups, setGroups] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      router.replace("/(auth)/login");
      return;
    }
    const { data: rows } = await supabase
      .from("live_purchases")
      .select(
        `id, status, amount, created_at,
         live_offers(name),
         live_events(id, title, type, status, started_at, created_at)`
      )
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false });

    const map = new Map<string, any>();
    (rows ?? []).forEach((r: any) => {
      const ev = r.live_events;
      if (!ev) return;
      if (!map.has(ev.id)) {
        map.set(ev.id, { event: ev, items: [], paid: 0, paidAmt: 0, pending: 0, pendAmt: 0 });
      }
      const g = map.get(ev.id)!;
      g.items.push(r);
      if (r.status === "paid") {
        g.paid++;
        g.paidAmt += Number(r.amount);
      }
      if (r.status === "pending_recovery") {
        g.pending++;
        g.pendAmt += Number(r.amount);
      }
    });
    setGroups(Array.from(map.values()));
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
      <Stack.Screen options={{ title: "Mis LIVEs", headerShown: true, headerStyle: { backgroundColor: COLORS.cream } }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.cream }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {groups.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>✨</Text>
            <Text style={{ color: COLORS.inkSoft, marginBottom: 12 }}>Todavía no participaste de ningún LIVE</Text>
            <Pressable
              onPress={() => router.push("/(tabs)/live")}
              style={{ backgroundColor: COLORS.roseDeep, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Ver próximos →</Text>
            </Pressable>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.event.id} style={{ backgroundColor: COLORS.white, padding: 16, borderRadius: 20, marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 28 }}>{TYPE_EMOJI[g.event.type]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: 16, color: COLORS.inkPrimary }}>{g.event.title}</Text>
                  <Text style={{ color: COLORS.inkSoft, fontSize: 12 }}>
                    {g.event.started_at
                      ? new Date(g.event.started_at).toLocaleDateString("es-AR")
                      : "Sin fecha"}{" "}
                    · {g.event.status}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <View style={{ flex: 1, backgroundColor: "#A8D5A833", padding: 10, borderRadius: 14, alignItems: "center" }}>
                  <Text style={{ fontSize: 10, color: COLORS.inkSoft, textTransform: "uppercase" }}>
                    Compraste
                  </Text>
                  <Text style={{ fontWeight: "800", color: COLORS.inkPrimary }}>
                    {g.paid} · {formatPrice(g.paidAmt)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: g.pending > 0 ? `${COLORS.roseDeep}25` : "#0001",
                    padding: 10,
                    borderRadius: 14,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 10, color: COLORS.inkSoft, textTransform: "uppercase" }}>
                    Pendientes
                  </Text>
                  <Text style={{ fontWeight: "800", color: g.pending > 0 ? COLORS.roseDeep : COLORS.inkSoft }}>
                    {g.pending > 0 ? `${g.pending} · ${formatPrice(g.pendAmt)}` : "—"}
                  </Text>
                </View>
              </View>

              {g.pending > 0 && (
                <Pressable
                  onPress={() => router.push("/account/pending")}
                  style={{ backgroundColor: COLORS.roseDeep, padding: 12, borderRadius: 999, alignItems: "center", marginTop: 10 }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Completar mis pendientes →</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}
