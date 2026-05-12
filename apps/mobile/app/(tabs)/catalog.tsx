import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  RefreshControl,
  Modal,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/lib/brand";
import type { Product, Category } from "@cancerianas/shared";
import { formatPrice } from "@cancerianas/shared";

type SortKey = "recent" | "price_asc" | "price_desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Más recientes" },
  { key: "price_asc", label: "Precio: menor a mayor" },
  { key: "price_desc", label: "Precio: mayor a menor" },
];

export default function CatalogScreen() {
  const { category: categorySlug } = useLocalSearchParams<{ category?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  // Debounce de búsqueda — 300ms para no spamear Supabase mientras tipea
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Categorías una vez
  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => {
        setCategories((data ?? []) as Category[]);
        if (categorySlug && data) {
          const found = data.find((c) => c.slug === categorySlug);
          if (found) setSelectedCat(found.id);
        }
      });
  }, [categorySlug]);

  // Productos cuando cambia categoría / orden / búsqueda
  useEffect(() => {
    const reqId = ++requestId.current;
    setLoading(true);

    let q = supabase.from("products").select("*").eq("status", "active");

    if (selectedCat) q = q.eq("category_id", selectedCat);

    if (debouncedSearch.length > 0) {
      // ilike en name o description
      const term = `%${debouncedSearch.replace(/[%_]/g, "")}%`;
      q = q.or(`name.ilike.${term},description.ilike.${term}`);
    }

    if (sort === "recent") q = q.order("created_at", { ascending: false });
    else if (sort === "price_asc") q = q.order("price", { ascending: true });
    else if (sort === "price_desc") q = q.order("price", { ascending: false });

    q.then(({ data }) => {
      // Ignorá la respuesta si el usuario ya disparó otra búsqueda
      if (reqId !== requestId.current) return;
      setProducts((data ?? []) as Product[]);
      setLoading(false);
    });
  }, [selectedCat, debouncedSearch, sort]);

  const onRefresh = async () => {
    setRefreshing(true);
    requestId.current++; // invalida cualquier request en vuelo
    let q = supabase.from("products").select("*").eq("status", "active");
    if (selectedCat) q = q.eq("category_id", selectedCat);
    if (debouncedSearch.length > 0) {
      const term = `%${debouncedSearch.replace(/[%_]/g, "")}%`;
      q = q.or(`name.ilike.${term},description.ilike.${term}`);
    }
    if (sort === "recent") q = q.order("created_at", { ascending: false });
    else if (sort === "price_asc") q = q.order("price", { ascending: true });
    else if (sort === "price_desc") q = q.order("price", { ascending: false });
    const { data } = await q;
    setProducts((data ?? []) as Product[]);
    setRefreshing(false);
  };

  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((s) => s.key === sort)?.label ?? "",
    [sort]
  );

  const showCount = !loading && products.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.cream }}>
      {/* Header: search + sort */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: COLORS.cream }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: COLORS.white,
            borderRadius: 14,
            paddingHorizontal: 14,
            height: 44,
            shadowColor: COLORS.roseMedium,
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscá un producto…"
            placeholderTextColor={COLORS.inkSoft}
            style={{
              flex: 1,
              color: COLORS.inkPrimary,
              fontSize: 15,
              paddingVertical: Platform.OS === "ios" ? 10 : 6,
            }}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Text style={{ fontSize: 18, color: COLORS.inkSoft }}>✕</Text>
            </Pressable>
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          <Text style={{ color: COLORS.inkSoft, fontSize: 13 }}>
            {loading
              ? "Cargando…"
              : showCount
              ? `${products.length} producto${products.length === 1 ? "" : "s"}`
              : "Sin resultados"}
          </Text>
          <Pressable
            onPress={() => setSortModalOpen(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: COLORS.white,
              borderRadius: 999,
              shadowColor: COLORS.roseMedium,
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 1,
            }}
            hitSlop={6}
          >
            <Text style={{ fontSize: 13, color: COLORS.inkPrimary, fontWeight: "600", marginRight: 6 }}>
              {sortLabel}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.roseDeep }}>▾</Text>
          </Pressable>
        </View>
      </View>

      {/* Chips de categorías */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        style={{ flexGrow: 0, backgroundColor: COLORS.cream }}
      >
        <Pressable
          onPress={() => setSelectedCat(null)}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 999,
            marginRight: 8,
            backgroundColor: !selectedCat ? COLORS.roseDeep : COLORS.white,
          }}
        >
          <Text style={{ color: !selectedCat ? "#fff" : COLORS.inkPrimary, fontWeight: "600" }}>Todo</Text>
        </Pressable>
        {categories.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setSelectedCat(c.id)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              marginRight: 8,
              backgroundColor: selectedCat === c.id ? COLORS.roseDeep : COLORS.white,
            }}
          >
            <Text style={{ color: selectedCat === c.id ? "#fff" : COLORS.inkPrimary, fontWeight: "600" }}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Grid */}
      {loading && products.length === 0 ? (
        <SkeletonGrid />
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.roseDeep}
              colors={[COLORS.roseDeep]}
            />
          }
          renderItem={({ item }) => <ProductGridCard item={item} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🌸</Text>
              <Text style={{ color: COLORS.inkSoft, textAlign: "center", paddingHorizontal: 24 }}>
                {debouncedSearch
                  ? `No encontramos productos para "${debouncedSearch}"`
                  : "No hay productos en esta categoría"}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal de orden */}
      <Modal
        visible={sortModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setSortModalOpen(false)}
      >
        <Pressable
          onPress={() => setSortModalOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(61, 42, 51, 0.45)", justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: COLORS.white,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              paddingBottom: 28,
            }}
          >
            <View style={{ alignItems: "center", paddingTop: 6, paddingBottom: 14 }}>
              <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: COLORS.rosePastel }} />
            </View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: COLORS.inkPrimary,
                paddingHorizontal: 24,
                paddingBottom: 8,
              }}
            >
              Ordenar por
            </Text>
            {SORT_OPTIONS.map((opt) => {
              const active = opt.key === sort;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setSort(opt.key);
                    setSortModalOpen(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 24,
                    paddingVertical: 14,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: active ? COLORS.roseDeep : COLORS.inkPrimary,
                      fontWeight: active ? "700" : "500",
                    }}
                  >
                    {opt.label}
                  </Text>
                  {active && <Text style={{ fontSize: 16, color: COLORS.roseDeep }}>✓</Text>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ProductGridCard({ item }: { item: Product }) {
  // Calcular badge: prioridad sin-stock > oferta > pocas-unidades
  const stock = item.stock ?? 0;
  const hasDiscount =
    item.compare_price != null && Number(item.compare_price) > Number(item.price);
  const discountPct = hasDiscount
    ? Math.round(((Number(item.compare_price) - Number(item.price)) / Number(item.compare_price)) * 100)
    : 0;

  let badge: { text: string; bg: string; color: string } | null = null;
  if (stock <= 0) {
    badge = { text: "Sin stock", bg: COLORS.inkSoft, color: COLORS.white };
  } else if (hasDiscount && discountPct > 0) {
    badge = { text: `-${discountPct}%`, bg: COLORS.roseDeep, color: COLORS.white };
  } else if (stock > 0 && stock <= 3) {
    badge = { text: `Últimas ${stock}`, bg: COLORS.warning, color: COLORS.inkPrimary };
  }

  const soldOut = stock <= 0;

  return (
    <Pressable
      onPress={() => router.push(`/product/${item.slug}`)}
      style={{
        flex: 1,
        margin: 6,
        backgroundColor: COLORS.white,
        borderRadius: 18,
        overflow: "hidden",
        shadowColor: COLORS.roseMedium,
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 2,
        opacity: soldOut ? 0.55 : 1,
      }}
    >
      <View style={{ aspectRatio: 1, backgroundColor: COLORS.rosePastel }}>
        {item.images?.[0] && (
          <Image source={{ uri: item.images[0] }} style={{ width: "100%", height: "100%" }} />
        )}
        {badge && (
          <View
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: badge.bg,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text
              style={{ color: badge.color, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 }}
            >
              {badge.text}
            </Text>
          </View>
        )}
      </View>
      <View style={{ padding: 10 }}>
        <Text
          numberOfLines={2}
          style={{
            fontWeight: "600",
            color: COLORS.inkPrimary,
            fontSize: 13,
            textDecorationLine: soldOut ? "line-through" : "none",
          }}
        >
          {item.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <Text style={{ color: COLORS.roseDeep, fontWeight: "700", fontSize: 16 }}>
            {formatPrice(item.price)}
          </Text>
          {hasDiscount && (
            <Text
              style={{
                color: COLORS.inkSoft,
                fontSize: 12,
                textDecorationLine: "line-through",
              }}
            >
              {formatPrice(Number(item.compare_price))}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function SkeletonGrid() {
  // 6 placeholders en grid 2x3 mientras carga
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 12 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={i}
          style={{
            width: "47%",
            margin: 6,
            backgroundColor: COLORS.white,
            borderRadius: 18,
            overflow: "hidden",
            opacity: 0.6,
          }}
        >
          <View style={{ aspectRatio: 1, backgroundColor: COLORS.rosePastel }} />
          <View style={{ padding: 10 }}>
            <View style={{ height: 12, backgroundColor: COLORS.rosePastel, borderRadius: 6, marginBottom: 6 }} />
            <View style={{ height: 12, width: "60%", backgroundColor: COLORS.rosePastel, borderRadius: 6, marginBottom: 10 }} />
            <View style={{ height: 16, width: "40%", backgroundColor: COLORS.roseMedium, borderRadius: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}
