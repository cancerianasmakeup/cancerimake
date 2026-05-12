import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  RefreshControl,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { BRAND, COLORS } from "@/lib/brand";
import type { Product, Category, LiveEvent } from "@cancerianas/shared";
import { formatPrice } from "@cancerianas/shared";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_PADDING = 16;
const BANNER_WIDTH = SCREEN_WIDTH - BANNER_PADDING * 2;

type Banner = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  cta: string;
  gradient: [string, string, ...string[]];
  textColor: string;
  onPress: () => void;
};

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeLive, setActiveLive] = useState<LiveEvent | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<ScrollView>(null);

  async function load() {
    const [{ data: p }, { data: c }, { data: ev }] = await Promise.all([
      supabase.from("products").select("*").eq("status", "active").eq("is_featured", true).limit(6),
      supabase.from("categories").select("*").eq("is_active", true).order("display_order"),
      supabase.from("live_events").select("*").eq("status", "active").maybeSingle(),
    ]);
    setProducts((p ?? []) as Product[]);
    setCategories((c ?? []) as Category[]);
    setActiveLive(ev as LiveEvent);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("home-mobile")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_events" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-rotate banners
  useEffect(() => {
    const id = setInterval(() => {
      setBannerIndex((prev) => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollTo({ x: next * (BANNER_WIDTH + 12), animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(id);
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const banners: Banner[] = [
    activeLive
      ? {
          id: "live",
          emoji: "🔴",
          title: "EN VIVO ahora",
          subtitle: activeLive.title,
          cta: "Entrar",
          gradient: ["#E66B85", "#FF8FA3"],
          textColor: "#fff",
          onPress: () => router.push(`/live/${activeLive.id}`),
        }
      : {
          id: "next-live",
          emoji: "✨",
          title: "Próximo LIVE",
          subtitle: "Cápsulas, sobres y bolsitas",
          cta: "Ver agenda",
          gradient: ["#E66B85", "#FF8FA3", "#FFB3C6"],
          textColor: "#fff",
          onPress: () => router.push("/live"),
        },
    {
      id: "envio",
      emoji: "🎁",
      title: "Envío gratis",
      subtitle: "En compras de +$15.000",
      cta: "Ver tienda",
      gradient: ["#FFB3C6", "#FFE5EC"],
      textColor: "#3D2A33",
      onPress: () => router.push("/catalog"),
    },
    {
      id: "lenceria",
      emoji: "💖",
      title: "Lencería",
      subtitle: "Hecha con amor para vos",
      cta: "Explorar",
      gradient: ["#FF8FA3", "#E66B85"],
      textColor: "#fff",
      onPress: () => router.push("/catalog?category=lenceria"),
    },
    {
      id: "cosmetica",
      emoji: "🌸",
      title: "Cosmética que te abraza",
      subtitle: "Skincare elegido a mano",
      cta: "Quiero ver",
      gradient: ["#FFE5EC", "#FFF0F4"],
      textColor: "#3D2A33",
      onPress: () => router.push("/catalog?category=cosmetica"),
    },
  ];

  function onBannerScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    setBannerIndex(Math.round(x / (BANNER_WIDTH + 12)));
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.cream }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.roseDeep} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* LOGO a todo el ancho */}
      <View style={{ paddingTop: 24, paddingHorizontal: 16 }}>
        <Image
          source={{ uri: BRAND.logoUrl }}
          style={{ width: "100%", height: 64, resizeMode: "contain" }}
        />
      </View>

      {/* PASARELA DE BANNERS */}
      <View style={{ marginTop: 18 }}>
        <ScrollView
          ref={bannerRef}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          snapToInterval={BANNER_WIDTH + 12}
          snapToAlignment="start"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: BANNER_PADDING }}
          onMomentumScrollEnd={onBannerScroll}
        >
          {banners.map((b, i) => (
            <Pressable
              key={b.id}
              onPress={b.onPress}
              style={{
                width: BANNER_WIDTH,
                marginRight: i === banners.length - 1 ? 0 : 12,
                borderRadius: 28,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={b.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 22,
                  height: 168,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text
                    style={{
                      color: b.textColor,
                      fontSize: 22,
                      fontWeight: "800",
                      lineHeight: 26,
                    }}
                  >
                    {b.title}
                  </Text>
                  <Text
                    style={{
                      color: b.textColor,
                      fontSize: 13,
                      opacity: 0.9,
                      marginTop: 4,
                    }}
                  >
                    {b.subtitle}
                  </Text>
                  <View
                    style={{
                      marginTop: 14,
                      backgroundColor: b.textColor === "#fff" ? "rgba(255,255,255,0.95)" : COLORS.roseDeep,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 999,
                      alignSelf: "flex-start",
                    }}
                  >
                    <Text
                      style={{
                        color: b.textColor === "#fff" ? COLORS.roseDeep : "#fff",
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {b.cta} →
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 88, opacity: 0.95 }}>{b.emoji}</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>

        {/* Dots indicator */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: 12,
            gap: 6,
          }}
        >
          {banners.map((_, i) => (
            <View
              key={i}
              style={{
                width: bannerIndex === i ? 22 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: bannerIndex === i ? COLORS.roseDeep : COLORS.roseMedium,
              }}
            />
          ))}
        </View>
      </View>

      {/* CATEGORÍAS */}
      <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.inkPrimary }}>
            Encontrá lo tuyo
          </Text>
          <Text style={{ fontSize: 22, marginLeft: 6 }}>✿</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {categories.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/catalog?category=${c.slug}`)}
              style={{ marginRight: 10 }}
            >
              <LinearGradient
                colors={[c.gradient_from || "#FFB3C6", c.gradient_to || "#FF8FA3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  borderRadius: 24,
                  minWidth: 110,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 32, marginBottom: 4 }}>{c.icon || "🌸"}</Text>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                  {c.name}
                </Text>
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* PRODUCTOS DESTACADOS */}
      <View style={{ paddingHorizontal: 16, marginTop: 32 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 14 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.inkPrimary }}>
            Lo más amado
          </Text>
          <Text
            style={{
              marginLeft: 8,
              color: COLORS.roseDeep,
              fontWeight: "700",
              fontStyle: "italic",
              fontSize: 15,
            }}
          >
            esta semana
          </Text>
        </View>

        {products.length === 0 ? (
          <View
            style={{
              backgroundColor: COLORS.white,
              borderRadius: 24,
              padding: 32,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 48, marginBottom: 8 }}>🌷</Text>
            <Text style={{ color: COLORS.inkSoft, fontSize: 14 }}>
              Todavía no hay productos destacados
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {products.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/product/${p.slug}`)}
                style={{
                  width: "48.5%",
                  marginBottom: 14,
                  borderRadius: 24,
                  overflow: "hidden",
                  backgroundColor: COLORS.white,
                  shadowColor: COLORS.roseMedium,
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 3,
                }}
              >
                <View style={{ aspectRatio: 1, backgroundColor: COLORS.rosePastel, position: "relative" }}>
                  {p.images?.[0] && (
                    <Image source={{ uri: p.images[0] }} style={{ width: "100%", height: "100%" }} />
                  )}
                  {p.compare_price && p.compare_price > p.price && (
                    <View
                      style={{
                        position: "absolute",
                        top: 10,
                        left: 10,
                        backgroundColor: COLORS.roseDeep,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
                        -{Math.round((1 - p.price / p.compare_price) * 100)}%
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ padding: 12 }}>
                  <Text
                    numberOfLines={2}
                    style={{ fontWeight: "700", color: COLORS.inkPrimary, fontSize: 14, lineHeight: 18 }}
                  >
                    {p.name}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 6, gap: 6 }}>
                    <Text style={{ color: COLORS.roseDeep, fontWeight: "800", fontSize: 17 }}>
                      {formatPrice(p.price)}
                    </Text>
                    {p.compare_price && p.compare_price > p.price && (
                      <Text
                        style={{
                          color: COLORS.inkSoft,
                          fontSize: 12,
                          textDecorationLine: "line-through",
                        }}
                      >
                        {formatPrice(p.compare_price)}
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
