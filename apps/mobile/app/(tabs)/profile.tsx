import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, Image } from "react-native";
import { router, Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/brand";
import { formatPrice } from "@cancerianas/shared";

export default function ProfileTab() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [livesCount, setLivesCount] = useState(0);
  const [shipmentActionCount, setShipmentActionCount] = useState(0);
  const [shipmentCount, setShipmentCount] = useState(0);

  async function loadAll() {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    if (!data.user) return;

    const [{ data: o }, { count: pc }, { data: livesRows }, { count: sac }, { count: sc }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, total, status, created_at")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("live_purchases")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id)
        .eq("status", "pending_recovery"),
      supabase
        .from("live_purchases")
        .select("event_id")
        .eq("user_id", data.user.id),
      supabase
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id)
        .in("status", ["pending_address", "pending_payment"]),
      supabase
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id),
    ]);
    setOrders(o ?? []);
    setPendingCount(pc ?? 0);
    setLivesCount(new Set((livesRows ?? []).map((r: any) => r.event_id)).size);
    setShipmentActionCount(sac ?? 0);
    setShipmentCount(sc ?? 0);
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.cream, padding: 20, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🌸</Text>
        <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.inkPrimary, marginBottom: 8, textAlign: "center" }}>
          Iniciá sesión
        </Text>
        <Text style={{ color: COLORS.inkSecondary, textAlign: "center", marginBottom: 24 }}>
          Para ver tus compras y participar en LIVE.
        </Text>
        <Pressable
          onPress={() => router.push("/(auth)/login")}
          style={{ backgroundColor: COLORS.roseDeep, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 999 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Entrar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.cream }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Avatar + nombre */}
      <View style={{ backgroundColor: COLORS.white, padding: 20, borderRadius: 24, marginBottom: 14, alignItems: "center" }}>
        <View style={{ width: 72, height: 72, backgroundColor: COLORS.rosePastel, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Text style={{ fontSize: 32 }}>🌸</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "800", color: COLORS.inkPrimary }}>
          {user.user_metadata?.full_name || "Hola!"}
        </Text>
        <Text style={{ color: COLORS.inkSoft, fontSize: 13 }}>{user.email}</Text>
      </View>

      {/* Shipment action banner */}
      {shipmentActionCount > 0 && (
        <Pressable onPress={() => router.push("/account/shipments")} style={{ marginBottom: 10, borderRadius: 24, overflow: "hidden" }}>
          <LinearGradient
            colors={["#E66B85", "#FF8FA3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Text style={{ fontSize: 36 }}>📦</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                Tenés {shipmentActionCount === 1 ? "un envío" : `${shipmentActionCount} envíos`} esperándote
              </Text>
              <Text style={{ color: "#fff", opacity: 0.9, fontSize: 12 }}>
                Completá tus datos para recibirlo
              </Text>
            </View>
            <View style={{ backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
              <Text style={{ color: COLORS.roseDeep, fontWeight: "800" }}>Completar</Text>
            </View>
          </LinearGradient>
        </Pressable>
      )}

      {/* Pending banner if any */}
      {pendingCount > 0 && (
        <Pressable onPress={() => router.push("/account/pending")} style={{ marginBottom: 14, borderRadius: 24, overflow: "hidden" }}>
          <LinearGradient
            colors={["#E66B85", "#FF8FA3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Text style={{ fontSize: 36 }}>🔖</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                Tenés {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
              </Text>
              <Text style={{ color: "#fff", opacity: 0.9, fontSize: 12 }}>
                Compras guardadas esperando que las completes
              </Text>
            </View>
            <View style={{ backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
              <Text style={{ color: COLORS.roseDeep, fontWeight: "800" }}>Ver</Text>
            </View>
          </LinearGradient>
        </Pressable>
      )}

      {/* Quick links */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <Pressable
          onPress={() => router.push("/account/lives")}
          style={{ flex: 1, backgroundColor: COLORS.white, padding: 16, borderRadius: 20, alignItems: "center" }}
        >
          <Text style={{ fontSize: 28, marginBottom: 4 }}>✨</Text>
          <Text style={{ fontWeight: "700", color: COLORS.inkPrimary, fontSize: 13 }}>Mis LIVEs</Text>
          <Text style={{ color: COLORS.inkSoft, fontSize: 11 }}>{livesCount} eventos</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/account/pending")}
          style={{ flex: 1, backgroundColor: COLORS.white, padding: 16, borderRadius: 20, alignItems: "center" }}
        >
          <Text style={{ fontSize: 28, marginBottom: 4 }}>🔖</Text>
          <Text style={{ fontWeight: "700", color: COLORS.inkPrimary, fontSize: 13 }}>Pendientes</Text>
          <Text style={{ color: pendingCount > 0 ? COLORS.roseDeep : COLORS.inkSoft, fontSize: 11, fontWeight: pendingCount > 0 ? "800" : "400" }}>
            {pendingCount > 0 ? `${pendingCount} esperando` : "Ninguno"}
          </Text>
        </Pressable>
      </View>

      {shipmentCount > 0 && (
        <Pressable
          onPress={() => router.push("/account/shipments")}
          style={{ backgroundColor: COLORS.white, padding: 16, borderRadius: 20, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <Text style={{ fontSize: 28 }}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: COLORS.inkPrimary, fontSize: 14 }}>Mis envíos</Text>
            <Text style={{ color: COLORS.inkSoft, fontSize: 11 }}>{shipmentCount} envío{shipmentCount === 1 ? "" : "s"}</Text>
          </View>
          <Text style={{ color: COLORS.roseDeep, fontWeight: "800" }}>Ver →</Text>
        </Pressable>
      )}

      {/* Orders */}
      <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.inkPrimary, marginBottom: 10 }}>
        Mis compras
      </Text>
      {orders.length === 0 ? (
        <Text style={{ color: COLORS.inkSoft, textAlign: "center", paddingVertical: 20 }}>
          Todavía no tenés compras
        </Text>
      ) : (
        orders.map((o) => (
          <View key={o.id} style={{ backgroundColor: COLORS.white, padding: 14, borderRadius: 16, marginBottom: 8 }}>
            <Text style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.inkSoft }}>
              {o.order_number}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text style={{ color: COLORS.inkSecondary, textTransform: "capitalize" }}>{o.status}</Text>
              <Text style={{ color: COLORS.roseDeep, fontWeight: "800" }}>
                {formatPrice(Number(o.total))}
              </Text>
            </View>
          </View>
        ))
      )}

      <Pressable
        onPress={() => {
          Alert.alert("Cerrar sesión", "¿Querés salir?", [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Salir",
              style: "destructive",
              onPress: async () => {
                await supabase.auth.signOut();
                router.replace("/");
              },
            },
          ]);
        }}
        style={{ backgroundColor: COLORS.white, padding: 14, borderRadius: 16, marginTop: 24, alignItems: "center" }}
      >
        <Text style={{ color: COLORS.error, fontWeight: "700" }}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}
