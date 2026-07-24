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

export default function Signup() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!firstName || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await signUp({ firstName: firstName.trim(), email: email.trim(), password });
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Sign up failed. Please try again.");
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

            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.subheading}>Begin your journey to a blessed marriage</Text>

            <View style={styles.form}>
              <AuthInput
                icon="person-outline"
                placeholder="First name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
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
                placeholder="Password (min 8 characters)"
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

              <Button title="Create Account" loading={loading} onPress={onSubmit} style={styles.cta} />
            </View>

            <View style={styles.trust}>
              <Ionicons name="shield-checkmark" size={15} color={colors.primary} />
              <Text style={styles.trustText}>Private, verified & respectful — for marriage only</Text>
            </View>

            <Text style={styles.legal}>
              By continuing you agree to our Terms of Service and Privacy Policy.
            </Text>
          </ScrollView>

          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            hitSlop={8}
            style={styles.footerWrap}
          >
            <Text style={styles.footer}>
              Already have an account? <Text style={styles.footerAccent}>Sign in</Text>
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
  trust: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: spacing.xl,
  },
  trustText: { color: colors.mutedForeground, fontSize: 13 },
  legal: {
    color: colors.subtleForeground,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 17,
    paddingHorizontal: spacing.lg,
  },
  footerWrap: { paddingVertical: spacing.lg },
  footer: { textAlign: "center", color: colors.mutedForeground, fontSize: 15 },
  footerAccent: { color: colors.primary, fontWeight: "700" },
});
