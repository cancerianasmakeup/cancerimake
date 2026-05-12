import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, Image } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { BRAND, COLORS } from "@/lib/brand";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Ups", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: COLORS.cream }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <Image source={{ uri: BRAND.logoUrl }} style={{ width: 200, height: 50, resizeMode: "contain" }} />
          <Text style={{ color: COLORS.inkSoft, fontStyle: "italic", marginTop: 8 }}>{BRAND.tagline}</Text>
        </View>

        <View style={{ backgroundColor: COLORS.white, padding: 20, borderRadius: 24 }}>
          <View style={{ flexDirection: "row", backgroundColor: COLORS.roseWhisper, borderRadius: 999, padding: 4, marginBottom: 20 }}>
            <Pressable
              onPress={() => setMode("login")}
              style={{ flex: 1, padding: 10, borderRadius: 999, backgroundColor: mode === "login" ? "#fff" : "transparent", alignItems: "center" }}
            >
              <Text style={{ fontWeight: "700", color: mode === "login" ? COLORS.inkPrimary : COLORS.inkSoft }}>Entrar</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("register")}
              style={{ flex: 1, padding: 10, borderRadius: 999, backgroundColor: mode === "register" ? "#fff" : "transparent", alignItems: "center" }}
            >
              <Text style={{ fontWeight: "700", color: mode === "register" ? COLORS.inkPrimary : COLORS.inkSoft }}>Crear cuenta</Text>
            </Pressable>
          </View>

          {mode === "register" && (
            <TextInput
              placeholder="Tu nombre"
              placeholderTextColor={COLORS.inkSoft}
              value={name}
              onChangeText={setName}
              style={inputStyle}
            />
          )}
          <TextInput
            placeholder="Email"
            placeholderTextColor={COLORS.inkSoft}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={inputStyle}
          />
          <TextInput
            placeholder="Contraseña (mín. 6)"
            placeholderTextColor={COLORS.inkSoft}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={inputStyle}
          />

          <Pressable
            onPress={handle}
            disabled={loading}
            style={{
              backgroundColor: COLORS.roseDeep,
              padding: 16,
              borderRadius: 999,
              alignItems: "center",
              marginTop: 8,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {loading ? "Procesando..." : mode === "login" ? "Entrar 🌸" : "Crear cuenta 🌸"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: COLORS.roseWhisper,
  padding: 14,
  borderRadius: 14,
  marginBottom: 12,
  fontSize: 15,
  color: COLORS.inkPrimary,
} as const;
