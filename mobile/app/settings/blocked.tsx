import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, Image } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Background } from "@/components/Background";
import { Text } from "@/components/ui";
import { apiRequest } from "@/api";
import { colors, spacing, radius } from "@/theme";

interface BlockedUser {
  id: string;
  firstName?: string | null;
  displayName?: string | null;
  photo?: string | null;
}

export default function Blocked() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery<BlockedUser[]>({
    queryKey: ["/api/users/blocked"],
  });

  const unblock = async (userId: string) => {
    try {
      await apiRequest("POST", `/api/users/${userId}/unblock`);
      await qc.invalidateQueries({ queryKey: ["/api/users/blocked"] });
    } catch {
      // ignore
    }
  };

  return (
    <Background>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Blocked members</Text>
          <View style={{ width: 26 }} />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : data.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="shield-checkmark-outline" size={44} color={colors.mutedForeground} />
            <Text variant="muted" style={{ marginTop: spacing.md }}>
              You haven't blocked anyone.
            </Text>
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(u) => u.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
            renderItem={({ item }) => (
              <View style={styles.row}>
                {item.photo ? (
                  <Image source={{ uri: item.photo }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={22} color={colors.subtleForeground} />
                  </View>
                )}
                <Text style={styles.name}>
                  {item.displayName || item.firstName || "Member"}
                </Text>
                <Pressable style={styles.unblock} onPress={() => unblock(item.id)}>
                  <Text style={styles.unblockText}>Unblock</Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.input },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  name: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.foreground },
  unblock: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  unblockText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
});
