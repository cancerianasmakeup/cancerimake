import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  Alert,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/brand";
import { formatPrice } from "@cancerianas/shared";
import type { Product } from "@cancerianas/shared";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .single()
      .then(({ data }) => setProduct(data as Product));
  }, [slug]);

  async function addToCart() {
    if (!product) return;
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/(auth)/login");
        return;
      }

      let { data: cart } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!cart) {
        const { data: nc } = await supabase
          .from("carts")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        cart = nc;
      }
      if (!cart) return;

      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cart.id)
        .eq("product_id", product.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + qty })
          .eq("id", existing.id);
      } else {
        await supabase.from("cart_items").insert({
          cart_id: cart.id,
          product_id: product.id,
          quantity: qty,
          unit_price: product.price,
        });
      }
      Alert.alert("Listo 🌸", "Agregado al carrito");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAdding(false);
    }
  }

  if (!product) return <View style={{ flex: 1, backgroundColor: COLORS.cream }} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.cream }}>
      <ProductImageCarousel images={product.images ?? []} />
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: COLORS.inkPrimary }}>
          {product.name}
        </Text>
        <Text
          style={{ fontSize: 28, fontWeight: "700", color: COLORS.roseDeep, marginTop: 8 }}
        >
          {formatPrice(product.price)}
        </Text>
        {product.description && (
          <Text style={{ color: COLORS.inkSecondary, marginTop: 16, lineHeight: 22 }}>
            {product.description}
          </Text>
        )}

        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: 24, gap: 12 }}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: COLORS.white,
              borderRadius: 999,
              alignItems: "center",
            }}
          >
            <Pressable onPress={() => setQty(Math.max(1, qty - 1))} style={{ padding: 12 }}>
              <Text style={{ fontSize: 18 }}>−</Text>
            </Pressable>
            <Text style={{ paddingHorizontal: 12, fontWeight: "700" }}>{qty}</Text>
            <Pressable onPress={() => setQty(qty + 1)} style={{ padding: 12 }}>
              <Text style={{ fontSize: 18 }}>+</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={addToCart}
          disabled={adding || product.stock === 0}
          style={{
            backgroundColor: COLORS.roseDeep,
            padding: 16,
            borderRadius: 999,
            marginTop: 24,
            alignItems: "center",
            opacity: adding || product.stock === 0 ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            {product.stock === 0 ? "Sin stock" : adding ? "Agregando..." : "Agregar al carrito 🌸"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/**
 * Carrusel horizontal de imágenes con paginación + dots indicator.
 * Los videos del producto NO se muestran acá por ahora (mobile no tiene
 * `expo-video` instalado). En la web sí se ven en la galería.
 */
function ProductImageCarousel({ images }: { images: string[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const flatListRef = useRef<FlatList<string>>(null);

  if (images.length === 0) {
    return (
      <View
        style={{
          width: SCREEN_WIDTH,
          aspectRatio: 1,
          backgroundColor: COLORS.rosePastel,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 80 }}>🌸</Text>
      </View>
    );
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx !== activeIdx) setActiveIdx(idx);
  }

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={images}
        keyExtractor={(item, i) => `${i}-${item}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{
              width: SCREEN_WIDTH,
              aspectRatio: 1,
              backgroundColor: COLORS.rosePastel,
            }}
          />
        )}
      />
      {images.length > 1 && (
        <View
          style={{
            position: "absolute",
            bottom: 14,
            left: 0,
            right: 0,
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {images.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === activeIdx ? 22 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === activeIdx ? COLORS.roseDeep : "rgba(255,255,255,0.7)",
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
