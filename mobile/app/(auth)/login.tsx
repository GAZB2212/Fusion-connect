import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Button, Input } from "@/components/ui";
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.body}>
          <Image
            source={require("../../assets/wordmark.png")}
            style={styles.wordmark}
            resizeMode="contain"
          />
          <Text variant="title" style={styles.heading}>
            Welcome back
          </Text>

          <View style={styles.form}>
            <Input
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Sign In" loading={loading} onPress={onSubmit} />
            <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={8}>
              <Text variant="muted" style={styles.link}>
                Forgot password?
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => router.replace("/(auth)/signup")} hitSlop={8}>
          <Text variant="muted" style={styles.footer}>
            Don't have an account? <Text style={styles.footerAccent}>Create one</Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl },
  wordmark: { width: 200, height: 88, alignSelf: "center" },
  heading: { textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  error: { color: colors.destructive, fontSize: 14 },
  link: { textAlign: "center", marginTop: spacing.sm },
  footer: { textAlign: "center", paddingBottom: spacing.xl },
  footerAccent: { color: colors.primary },
});
