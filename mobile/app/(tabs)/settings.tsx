import { View, StyleSheet, ScrollView } from "react-native";
import { Screen } from "@/components/Screen";
import { Text, Button, Card } from "@/components/ui";
import { useAuth } from "@/auth";
import { colors, spacing } from "@/theme";

export default function Settings() {
  const { user, signOut } = useAuth();

  return (
    <Screen title="Settings" subtitle="Manage your account">
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text variant="muted">Signed in as</Text>
          <Text style={styles.name}>{user?.firstName || "Fusion member"}</Text>
          <Text variant="muted" style={{ marginTop: 2 }}>
            {user?.email}
          </Text>
          {user?.subscriptionStatus ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{user.subscriptionStatus}</Text>
            </View>
          ) : null}
        </Card>

        <View style={{ flex: 1 }} />

        <Button title="Sign Out" variant="outline" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.lg },
  name: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  badge: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgeText: { color: colors.primaryForeground, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
});
