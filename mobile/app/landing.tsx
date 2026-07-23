import { View, StyleSheet, ImageBackground, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Button } from "@/components/ui";
import { colors, spacing } from "@/theme";

export default function Landing() {
  const router = useRouter();

  return (
    <ImageBackground
      source={require("../assets/landing-bg.png")}
      resizeMode="cover"
      style={styles.bg}
    >
      {/* Darken slightly so the wordmark and buttons stay legible over the art */}
      <View style={styles.scrim} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <Image
            source={require("../assets/wordmark.png")}
            style={styles.wordmark}
            resizeMode="contain"
          />
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
  bg: { flex: 1, backgroundColor: colors.backgroundDeep },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,22,40,0.35)" },
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  hero: { flex: 1, alignItems: "center", justifyContent: "center" },
  wordmark: { width: 260, height: 150 },
  tagline: { color: colors.foreground, fontSize: 15, marginTop: -12, opacity: 0.9 },
  subtitle: { color: colors.foreground, fontSize: 22, marginTop: spacing.xxl, letterSpacing: 1 },
  actions: { gap: spacing.sm },
  legal: { textAlign: "center", marginTop: spacing.lg },
});
