import "@expo/metro-runtime";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { COLORS } from "@/lib/brand";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor={COLORS.cream} />
        <Stack screenOptions={{
          headerStyle: { backgroundColor: COLORS.cream },
          headerTintColor: COLORS.inkPrimary,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: COLORS.cream },
        }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: "modal" }} />
          <Stack.Screen name="product/[slug]" options={{ title: "" }} />
          <Stack.Screen name="live/[id]" options={{ title: "LIVE", headerStyle: { backgroundColor: COLORS.roseDeep } }} />
          <Stack.Screen name="account/lives" options={{ title: "Mis LIVEs" }} />
          <Stack.Screen name="account/pending" options={{ title: "Mis pendientes" }} />
          <Stack.Screen name="account/shipments" options={{ title: "Mis envíos" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
