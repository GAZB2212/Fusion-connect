import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text, Button } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";

const BENEFITS = [
  "See everyone who likes you",
  "Unlimited matches & messaging",
  "Voice & video calls with matches",
  "Priority in discovery",
];

export default function Subscribe() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.close} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={26} color={colors.mutedForeground} />
        </Pressable>

        <View style={styles.crown}>
          <Ionicons name="star" size={34} color={colors.primary} />
        </View>
        <Text variant="display" style={styles.title}>Fusion Premium</Text>
        <Text variant="muted" style={styles.subtitle}>
          Everything you need to find your spouse
        </Text>

        <View style={styles.card}>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefit}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>£19.99</Text>
          <Text variant="muted">/ month</Text>
        </View>

        <Button title="Subscribe" onPress={() => {}} />
        <Text variant="muted" style={styles.note}>
          Purchases are handled securely through the App Store. Cancel anytime.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, alignItems: "center", gap: spacing.md },
  close: { alignSelf: "flex-end" },
  crown: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(212,175,55,0.15)", alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  title: { marginTop: spacing.md },
  subtitle: { textAlign: "center" },
  card: { width: "100%", backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder, padding: spacing.lg, gap: spacing.md, marginTop: spacing.lg },
  benefit: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  benefitText: { color: colors.foreground, fontSize: 15, flex: 1 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginVertical: spacing.lg },
  price: { fontSize: 40, fontWeight: "700", color: colors.foreground },
  note: { textAlign: "center", marginTop: spacing.md },
});
