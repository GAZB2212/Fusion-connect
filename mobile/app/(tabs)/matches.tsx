import { View, StyleSheet, Image, Pressable, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/ui";
import { useAuth } from "@/auth";
import { colors, spacing, radius } from "@/theme";
import type { MatchEntry, Profile } from "@/types";

export default function Matches() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: matches = [], isLoading, refetch, isRefetching } = useQuery<MatchEntry[]>({
    queryKey: ["/api/matches"],
  });

  const otherProfile = (m: MatchEntry): Profile =>
    m.user1Id === user?.id ? m.user2Profile : m.user1Profile;

  if (isLoading) {
    return (
      <Screen title="Matches" subtitle="People you both liked">
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Matches" subtitle={matches.length === 1 ? "1 person you both liked" : `${matches.length} people you both liked`}>
      {matches.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={44} color={colors.mutedForeground} />
          <Text variant="muted" style={{ marginTop: spacing.md }}>
            No matches yet — keep browsing
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const p = otherProfile(item);
            const openChat = () =>
              router.push({
                pathname: "/chat/[matchId]",
                params: { matchId: item.id, name: p.displayName, photo: p.photos?.[0] ?? "" },
              });
            return (
              <Pressable style={styles.card} onPress={openChat}>
                {p.photos?.[0] ? (
                  <Image source={{ uri: p.photos[0] }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={28} color={colors.subtleForeground} />
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.name}>
                    {p.displayName}
                    {p.age ? <Text style={styles.age}>, {p.age}</Text> : null}
                  </Text>
                  {p.location ? <Text variant="muted">{p.location}</Text> : null}
                </View>
                <Pressable style={styles.msgBtn} onPress={openChat} hitSlop={8}>
                  <Ionicons name="chatbubble" size={18} color={colors.primaryForeground} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card,
    borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.input },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  name: { fontSize: 17, fontWeight: "600", color: colors.foreground },
  age: { fontWeight: "400" },
  msgBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
