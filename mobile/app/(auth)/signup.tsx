import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, ScrollView, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Button, Input } from "@/components/ui";
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Image
            source={require("../../assets/wordmark.png")}
            style={styles.wordmark}
            resizeMode="contain"
          />
          <Text variant="title" style={styles.heading}>
            Create your account
          </Text>

          <View style={styles.form}>
            <Input placeholder="First name" value={firstName} onChangeText={setFirstName} />
            <Input
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input placeholder="Password (min 8 characters)" secureTextEntry value={password} onChangeText={setPassword} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Create Account" loading={loading} onPress={onSubmit} />
          </View>
        </ScrollView>

        <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
          <Text variant="muted" style={styles.footer}>
            Already have an account? <Text style={styles.footerAccent}>Sign in</Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xl },
  wordmark: { width: 200, height: 88, alignSelf: "center" },
  heading: { textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  error: { color: colors.destructive, fontSize: 14 },
  footer: { textAlign: "center", paddingBottom: spacing.xl },
  footerAccent: { color: colors.primary },
});
