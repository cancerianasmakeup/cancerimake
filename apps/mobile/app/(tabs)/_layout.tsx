import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { COLORS } from "@/lib/brand";

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.roseDeep,
        tabBarInactiveTintColor: COLORS.inkSoft,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.rosePastel,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ focused }) => <TabIcon icon="🌸" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: "Tienda",
          tabBarIcon: ({ focused }) => <TabIcon icon="🛍️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "LIVE",
          tabBarIcon: ({ focused }) => <TabIcon icon="✨" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Cuenta",
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
