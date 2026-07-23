import { View, StyleSheet, Image, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/ui";
import { useSubscription } from "@/useSubscription";
import { colors, spacing, radius } from "@/theme";
import type { LikeEntry } from "@/types";

export default function Likes() {
  const router = useRouter();
  const { isPremium: hasSub } = useSubscription();

  const { data: likes = [], isLoading } = useQuery<LikeEntry[]>({ queryKey: ["/api/likes"] });

  if (isLoading) {
    return (
      <Screen title="Likes You">
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Likes You" subtitle={likes.length === 1 ? "1 person likes you" : `${likes.length} people like you`}>
      <FlatList
        data={likes}
        keyExtractor={(l) => l.swipeId}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListHeaderComponent={
          !hasSub && likes.length > 0 ? (
            <Pressable style={styles.upsell} onPress={() => router.push("/subscribe")}>
              <View style={styles.crown}>
                <Ionicons name="star" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upsellTitle}>Upgrade to see who likes you</Text>
                <Text variant="muted" style={{ fontSize: 13 }}>£19.99/month · See clear photos & connect</Text>
              </View>
              <View style={styles.upsellBtn}>
                <Text style={styles.upsellBtnText}>Upgrade</Text>
              </View>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="star-outline" size={44} color={colors.mutedForeground} />
            <Text variant="muted" style={{ marginTop: spacing.md, textAlign: "center" }}>
              No likes yet — when someone likes you, they'll appear here
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const p = item.profile;
          const photo = p.photos?.[0];
          return (
            <Pressable
              style={styles.tile}
              onPress={() => (hasSub ? router.push("/(tabs)/matches") : router.push("/subscribe"))}
            >
              {photo ? (
                <Image source={{ uri: photo }} style={styles.tilePhoto} blurRadius={hasSub ? 0 : 28} />
              ) : (
                <View style={[styles.tilePhoto, styles.tilePlaceholder]}>
                  <Ionicons name="person" size={40} color={colors.subtleForeground} />
                </View>
              )}
              {!hasSub ? (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={26} color="#fff" />
                </View>
              ) : null}
              <View style={styles.tileInfo}>
                <Text style={styles.tileName} numberOfLines={1}>
                  {hasSub ? p.displayName : "Someone"}
                  {hasSub && p.age ? `, ${p.age}` : ""}
                </Text>
                {p.location ? (
                  <Text variant="muted" style={{ fontSize: 12 }} numberOfLines={1}>
                    {p.location}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  upsell: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "rgba(212,175,55,0.12)",
    borderColor: "rgba(212,175,55,0.3)", borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  crown: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(212,175,55,0.2)", alignItems: "center", justifyContent: "center" },
  upsellTitle: { color: colors.foreground, fontWeight: "600" },
  upsellBtn: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 8 },
  upsellBtnText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 13 },

  tile: { flex: 1, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  tilePhoto: { width: "100%", aspectRatio: 3 / 4, backgroundColor: colors.input },
  tilePlaceholder: { alignItems: "center", justifyContent: "center" },
  lockOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  tileInfo: { padding: spacing.sm },
  tileName: { color: colors.foreground, fontWeight: "600" },
});
