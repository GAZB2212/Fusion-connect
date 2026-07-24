import { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text, Button } from "@/components/ui";
import { AuthInput } from "@/components/AuthInput";
import { Background } from "@/components/Background";
import { useAuth } from "@/auth";
import { ApiError } from "@/api";
import { colors, spacing } from "@/theme";

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Background>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.back} onPress={() => router.replace("/landing")} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color={colors.foreground} />
            </Pressable>

            <Image
              source={require("../../assets/wordmark.png")}
              style={styles.wordmark}
              resizeMode="contain"
            />

            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>Sign in to continue your search</Text>

            <View style={styles.form}>
              <AuthInput
                icon="mail-outline"
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <AuthInput
                icon="lock-closed-outline"
                placeholder="Password"
                secure
                value={password}
                onChangeText={setPassword}
              />

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={colors.destructive} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              <Button title="Sign In" loading={loading} onPress={onSubmit} style={styles.cta} />

              <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={8}>
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            </View>
          </ScrollView>

          <Pressable
            onPress={() => router.replace("/(auth)/signup")}
            hitSlop={8}
            style={styles.footerWrap}
          >
            <Text style={styles.footer}>
              Don't have an account? <Text style={styles.footerAccent}>Create one</Text>
            </Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  flex: { flex: 1 },
  body: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  back: { position: "absolute", top: spacing.sm, left: 0, padding: spacing.sm },
  wordmark: { width: 168, height: 74, alignSelf: "center", marginBottom: spacing.md },
  heading: { fontSize: 28, fontWeight: "800", color: colors.foreground, textAlign: "center", letterSpacing: -0.5 },
  subheading: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  form: { gap: spacing.md },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  error: { color: colors.destructive, fontSize: 14, flex: 1 },
  cta: { marginTop: spacing.sm },
  link: { textAlign: "center", color: colors.mutedForeground, marginTop: spacing.sm, fontSize: 15 },
  footerWrap: { paddingVertical: spacing.lg },
  footer: { textAlign: "center", color: colors.mutedForeground, fontSize: 15 },
  footerAccent: { color: colors.primary, fontWeight: "700" },
});
