import { useState, useRef } from "react";
import { View, StyleSheet, Image, Animated, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiError } from "@/api";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/ui";
import { apiRequest } from "@/api";
import { useProfile } from "@/useProfile";
import { colors, spacing, radius } from "@/theme";
import type { DiscoverProfile, SwipeResult } from "@/types";
import { MatchModal } from "@/components/MatchModal";

export default function Discover() {
  const qc = useQueryClient();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [matched, setMatched] = useState<DiscoverProfile | null>(null);
  const position = useRef(new Animated.ValueXY()).current;

  const { data: profiles = [], isLoading, isFetching, refetch } = useQuery<DiscoverProfile[]>({
    queryKey: ["/api/discover"],
  });

  const { data: myProfile } = useProfile();

  const swipe = useMutation({
    mutationFn: async ({ swipedId, direction }: { swipedId: string; direction: "left" | "right" }) => {
      return apiRequest<SwipeResult>("POST", "/api/swipe", { swipedId, direction });
    },
    onSuccess: (result, variables) => {
      if (result.isMatch) {
        const p = profiles.find((x) => x.userId === variables.swipedId);
        if (p) setMatched(p);
        qc.invalidateQueries({ queryKey: ["/api/matches"] });
      }
    },
    onError: (e) => {
      // Backend requires face verification before swiping
      if (e instanceof ApiError && e.status === 403) {
        setIndex((i) => Math.max(0, i - 1)); // don't lose the card
        router.push("/profile-setup");
      }
    },
  });

  const current = profiles[index];

  const advance = (direction: "left" | "right") => {
    if (!current) return;
    const toX = direction === "right" ? 500 : -500;
    Animated.timing(position, {
      toValue: { x: toX, y: 0 },
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      swipe.mutate({ swipedId: current.userId, direction });
      setIndex((i) => i + 1);
    });
  };

  if (isLoading) {
    return (
      <Screen title="Discover">
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  // Face verification is required before matching
  if (myProfile && !myProfile.faceVerified) {
    return (
      <Screen title="Discover">
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="shield-checkmark-outline" size={44} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Verify to start matching</Text>
          <Text variant="muted" style={styles.emptyText}>
            A quick selfie confirms you're genuine. It keeps Fusion safe for everyone.
          </Text>
          <Pressable style={styles.refreshBtn} onPress={() => router.push("/profile-setup")}>
            <Ionicons name="camera" size={18} color={colors.primaryForeground} />
            <Text style={styles.refreshText}>Verify now</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen title="Discover">
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={44} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No more profiles right now</Text>
          <Text variant="muted" style={styles.emptyText}>
            You've seen everyone for now — check back soon as new members join
          </Text>
          <Pressable
            style={[styles.refreshBtn, isFetching && styles.refreshBtnBusy]}
            disabled={isFetching}
            onPress={async () => {
              await refetch();
              setIndex(0);
            }}
          >
            {isFetching ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.primaryForeground} />
            )}
            <Text style={styles.refreshText}>{isFetching ? "Checking…" : "Refresh"}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const photo = current.photos?.[0];
  const rotate = position.x.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  return (
    <Screen title="Discover">
      <View style={styles.deck}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ translateX: position.x }, { rotate }] },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Ionicons name="person" size={64} color={colors.subtleForeground} />
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.name}>
                {current.displayName}
                {current.age ? <Text style={styles.age}>, {current.age}</Text> : null}
              </Text>
              {current.location ? (
                <View style={styles.row}>
                  <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
                  <Text variant="muted">{current.location}</Text>
                </View>
              ) : null}
              <View style={styles.badges}>
                {[current.sect, current.religiousPractice, current.prayerFrequency, current.profession || current.occupation]
                  .filter(Boolean)
                  .map((b, i) => (
                    <View key={i} style={styles.badge}>
                      <Text style={styles.badgeText}>{String(b)}</Text>
                    </View>
                  ))}
              </View>
              {current.lookingFor ? (
                <View style={styles.intentBadge}>
                  <Ionicons name="sparkles" size={13} color={colors.primaryForeground} />
                  <Text style={styles.intentText}>{current.lookingFor}</Text>
                </View>
              ) : null}
              {current.bio ? <Text style={styles.bio}>{current.bio}</Text> : null}
            </View>
          </ScrollView>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.action, styles.pass]} onPress={() => advance("left")}>
          <Ionicons name="close" size={32} color="#fff" />
        </Pressable>
        <Pressable style={[styles.action, styles.like]} onPress={() => advance("right")}>
          <Ionicons name="heart" size={30} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <MatchModal
        profile={matched}
        onClose={() => setMatched(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(212,175,55,0.12)",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  emptyText: { textAlign: "center", marginBottom: spacing.xl },
  refreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.full,
    minWidth: 140, justifyContent: "center",
  },
  refreshBtnBusy: { opacity: 0.7 },
  refreshText: { color: colors.primaryForeground, fontWeight: "600" },

  deck: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  card: {
    flex: 1, borderRadius: radius.xl, backgroundColor: colors.card, overflow: "hidden",
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  photo: { width: "100%", height: 440, backgroundColor: colors.input },
  photoPlaceholder: { alignItems: "center", justifyContent: "center" },
  info: { padding: spacing.lg, gap: spacing.sm },
  name: { fontSize: 26, fontWeight: "700", color: colors.foreground },
  age: { fontSize: 24, fontWeight: "400", color: colors.foreground },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  badge: {
    backgroundColor: "rgba(245,240,228,0.08)", borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5,
  },
  badgeText: { color: colors.foreground, fontSize: 13 },
  intentBadge: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.md,
    paddingVertical: 5, marginTop: spacing.xs,
  },
  intentText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 13 },
  bio: { color: colors.foreground, lineHeight: 21, marginTop: spacing.xs },

  actions: { flexDirection: "row", justifyContent: "center", gap: spacing.xxl, paddingVertical: spacing.lg },
  action: {
    width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
  },
  pass: { backgroundColor: "#3A4356" },
  like: { backgroundColor: colors.primary },
});
