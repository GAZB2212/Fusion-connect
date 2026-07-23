import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Button, Input } from "@/components/ui";
import { apiRequest, ApiError } from "@/api";
import { colors, spacing } from "@/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email) {
      setError("Please enter your email");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (e) {
      // Backend intentionally responds the same whether or not the email exists
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.body}>
          <Text variant="title" style={styles.heading}>
            Reset password
          </Text>
          {sent ? (
            <Text variant="muted" style={styles.sent}>
              If an account exists for {email}, we've sent a reset link. Check your inbox.
            </Text>
          ) : (
            <View style={styles.form}>
              <Input
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              {error ? <Text style={{ color: colors.destructive }}>{error}</Text> : null}
              <Button title="Send reset link" loading={loading} onPress={onSubmit} />
            </View>
          )}
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text variant="muted" style={styles.link}>
              Back to sign in
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.lg },
  heading: { textAlign: "center" },
  form: { gap: spacing.md },
  sent: { textAlign: "center" },
  link: { textAlign: "center", marginTop: spacing.md },
});
