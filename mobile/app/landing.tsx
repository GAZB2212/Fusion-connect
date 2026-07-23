import { View, StyleSheet, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Button } from "@/components/ui";
import { colors, spacing } from "@/theme";

export default function Landing() {
  const router = useRouter();

  return (
    <ImageBackground
      source={require("../assets/pattern.png")}
      resizeMode="repeat"
      style={styles.bg}
      imageStyle={{ opacity: 0.5 }}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          {/* Gold "fusion" wordmark */}
          <Text style={styles.wordmark}>fusion</Text>
          <Text style={styles.tagline}>find your perfect match</Text>
          <Text style={styles.subtitle}>Where Muslims Meet</Text>
        </View>

        <View style={styles.actions}>
          <Button title="Create Account" onPress={() => router.push("/(auth)/signup")} />
          <Button
            title="Sign In"
            variant="ghost"
            onPress={() => router.push("/(auth)/login")}
            style={{ marginTop: spacing.sm }}
          />
          <Text variant="muted" style={styles.legal}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  hero: { flex: 1, alignItems: "center", justifyContent: "center" },
  wordmark: {
    fontSize: 64,
    color: colors.primary,
    fontStyle: "italic",
    fontWeight: "600",
  },
  tagline: { color: colors.foreground, fontSize: 14, marginTop: -8, opacity: 0.9 },
  subtitle: { color: colors.foreground, fontSize: 22, marginTop: spacing.xxl, letterSpacing: 1 },
  actions: { gap: spacing.sm },
  legal: { textAlign: "center", marginTop: spacing.lg },
});
