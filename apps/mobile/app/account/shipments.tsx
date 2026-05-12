import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Linking, Platform } from "react-native";
import { router, Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/brand";
import { formatPrice } from "@cancerianas/shared";
import Constants from "expo-constants";

const STATUS_META: Record<string, { label: string; emoji: string; color: string; cta?: string }> = {
  pending_address: { label: "Completá tu dirección", emoji: "📝", color: COLORS.roseDeep, cta: "Completar →" },
  pending_payment: { label: "Falta pagar", emoji: "⏳", color: "#F4B4A0", cta: "Pagar →" },
  paid: { label: "Pagado · preparando", emoji: "💚", color: "#A8D5A8" },
  label_generated: { label: "Listo para despachar", emoji: "🏷️", color: COLORS.rosePastel },
  dispatched: { label: "Despachado", emoji: "📦", color: COLORS.roseMedium },
  in_transit: { label: "En camino", emoji: "🚚", color: COLORS.rosePastel },
  out_for_delivery: { label: "Hoy llega", emoji: "🚪", color: COLORS.roseDeep },
  delivered: { label: "Entregado", emoji: "✅", color: "#A8D5A8" },
  returned: { label: "Devuelto", emoji: "↩️", color: "#E08585" },
  failed: { label: "Falló", emoji: "⚠️", color: "#E08585" },
  cancelled: { label: "Cancelado", emoji: "❌", color: COLORS.inkSoft },
};

// El wizard de envío es web (mucho form). Desde mobile abrimos en WebBrowser.
const WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_URL ??
  Constants.expoConfig?.extra?.webUrl ??
  "http://localhost:3000";

export default function ShipmentsScreen() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      router.replace("/(auth)/login");
      return;
    }
    const { data } = await supabase
      .from("shipments")
      .select("*")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false });
    setShipments(data ?? []);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("my-shipments")
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function openWizard(s: any) {
    const url = `${WEB_BASE}/shipment/${s.id}`;
    if (Platform.OS === "web") {
      window.location.href = url;
    } else {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: COLORS.cream,
        controlsColor: COLORS.roseDeep,
      });
    }
  }

  const pending = shipments.filter((s) => s.status === "pending_address" || s.status === "pending_payment");
  const active = shipments.filter(
    (s) => !["pending_address", "pending_payment", "delivered", "cancelled", "returned", "failed"].includes(s.status)
  );
  const finished = shipments.filter((s) =>
    ["delivered", "cancelled", "returned", "failed"].includes(s.status)
  );

  return (
    <>
      <Stack.Screen options={{ title: "Mis envíos 📦", headerShown: true, headerStyle: { backgroundColor: COLORS.cream } }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.cream }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {shipments.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📦</Text>
            <Text style={{ color: COLORS.inkSecondary, fontWeight: "700" }}>Sin envíos por ahora</Text>
            <Text style={{ color: COLORS.inkSoft, fontSize: 12, textAlign: "center", marginTop: 6 }}>
              Cuando tengas un paquete por recibir lo vas a ver acá
            </Text>
          </View>
        )}

        {pending.length > 0 && <Section title="Acción requerida 🔔" highlight items={pending} onTap={openWizard} />}
        {active.length > 0 && <Section title="En proceso" items={active} onTap={openWizard} />}
        {finished.length > 0 && <Section title="Historial" muted items={finished} onTap={openWizard} />}
      </ScrollView>
    </>
  );
}

function Section({ title, items, highlight, muted, onTap }: any) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "800",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 10,
          color: highlight ? COLORS.roseDeep : muted ? COLORS.inkSoft : COLORS.inkSecondary,
        }}
      >
        {title}
      </Text>
      {items.map((s: any) => {
        const meta = STATUS_META[s.status] ?? { label: s.status, emoji: "•", color: COLORS.inkSoft };
        const isAction = s.status === "pending_address" || s.status === "pending_payment";

        if (isAction) {
          return (
            <Pressable key={s.id} onPress={() => onTap(s)} style={{ marginBottom: 10, borderRadius: 20, overflow: "hidden" }}>
              <LinearGradient
                colors={["#E66B85", "#FF8FA3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Text style={{ fontSize: 32 }}>{meta.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{s.description}</Text>
                  <Text style={{ color: "#fff", opacity: 0.95, fontSize: 12, marginTop: 2 }}>
                    {meta.label}
                  </Text>
                </View>
                <View style={{ backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}>
                  <Text style={{ color: COLORS.roseDeep, fontWeight: "800", fontSize: 12 }}>
                    {meta.cta}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={s.id}
            onPress={() => onTap(s)}
            style={{
              backgroundColor: COLORS.white,
              padding: 14,
              borderRadius: 18,
              marginBottom: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: meta.color,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", color: COLORS.inkPrimary, fontSize: 14 }} numberOfLines={1}>
                {s.description}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.inkSoft }}>
                {meta.label} · {(s.weight_grams / 1000).toFixed(2)}kg
              </Text>
              {s.andreani_tracking_number && (
                <Text style={{ fontFamily: "monospace", fontSize: 10, color: COLORS.inkSoft, marginTop: 2 }}>
                  {s.andreani_tracking_number}
                </Text>
              )}
            </View>
            {s.cost_charged && (
              <Text style={{ color: COLORS.roseDeep, fontWeight: "800" }}>
                {formatPrice(Number(s.cost_charged))}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
