import { View, StyleSheet, ScrollView, Pressable, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/ui";
import { useAuth } from "@/auth";
import { useSubscription } from "@/useSubscription";
import { apiRequest } from "@/api";
import { colors, spacing, radius, gold } from "@/theme";

const PRIVACY_URL = "https://www.fusioncouples.co.uk/privacy";
const TERMS_URL = "https://www.fusioncouples.co.uk/terms";
const SUPPORT_EMAIL = "support@fusioncouples.co.uk";

export default function Settings() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isPremium, data: sub } = useSubscription();

  const confirmDelete = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your profile, matches and messages. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest("DELETE", "/api/account");
            } catch {
              // proceed to sign out regardless
            }
            await signOut();
          },
        },
      ]
    );
  };

  const manageSubscription = () => {
    // Apple-managed subscriptions are cancelled in the system settings.
    Linking.openURL("https://apps.apple.com/account/subscriptions").catch(() => {});
  };

  return (
    <Screen title="Settings" subtitle="Manage your account">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <View style={styles.accountCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={colors.subtleForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.firstName || "Fusion member"}</Text>
            <Text variant="muted" numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </View>

        {/* Premium */}
        {isPremium ? (
          <View style={styles.premiumActive}>
            <View style={styles.premiumRow}>
              <Ionicons name="diamond" size={20} color={colors.primary} />
              <Text style={styles.premiumTitle}>Fusion Premium</Text>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>Active</Text>
              </View>
            </View>
            {sub?.currentPeriodEnd ? (
              <Text variant="muted" style={{ marginTop: 6 }}>
                Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
              </Text>
            ) : null}
            <Pressable onPress={manageSubscription} hitSlop={6}>
              <Text style={styles.manageLink}>Manage subscription</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.premiumCta} onPress={() => router.push("/subscribe")}>
            <View style={styles.premiumRow}>
              <Ionicons name="diamond" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
                <Text variant="muted" style={{ fontSize: 13 }}>
                  See your likes, unlimited messaging & calls
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </View>
          </Pressable>
        )}

        <Section title="Profile">
          <Row icon="create-outline" label="Edit profile" onPress={() => router.push("/settings/edit-profile")} />
        </Section>

        <Section title="Safety">
          <Row
            icon="ban-outline"
            label="Blocked members"
            onPress={() => router.push("/settings/blocked")}
          />
        </Section>

        <Section title="Support">
          <Row
            icon="mail-outline"
            label="Contact support"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          />
          <Row
            icon="lock-closed-outline"
            label="Privacy Policy"
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />
          <Row
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => Linking.openURL(TERMS_URL)}
            last
          />
        </Section>

        <Section title="Account">
          <Row icon="log-out-outline" label="Sign out" onPress={signOut} />
          <Row icon="trash-outline" label="Delete account" destructive onPress={confirmDelete} last />
        </Section>

        <Text style={styles.version}>Fusion v1.0.0</Text>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
  destructive,
  last,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.row, !last && styles.rowBorderBottom]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={destructive ? colors.destructive : colors.primary} />
      <Text style={[styles.rowLabel, destructive && { color: colors.destructive }]}>{label}</Text>
      {!destructive ? (
        <Ionicons name="chevron-forward" size={18} color={colors.subtleForeground} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 19, fontWeight: "700", color: colors.foreground },

  premiumCta: {
    backgroundColor: gold.soft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: gold.border,
    padding: spacing.lg,
  },
  premiumActive: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: gold.border,
    padding: spacing.lg,
  },
  premiumRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  premiumTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  activePill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  activePillText: { color: colors.primaryForeground, fontSize: 11, fontWeight: "700" },
  manageLink: { color: colors.primary, fontWeight: "600", marginTop: spacing.md },

  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 0.6,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorderBottom: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { flex: 1, fontSize: 16, color: colors.foreground },

  version: { textAlign: "center", color: colors.subtleForeground, fontSize: 12, marginTop: spacing.md },
});
