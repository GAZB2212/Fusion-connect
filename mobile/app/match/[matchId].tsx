import { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/ui";
import { useAuth } from "@/auth";
import { useCall } from "@/calls";
import { colors, spacing, radius, gradients, gold } from "@/theme";
import type { MatchEntry, Profile } from "@/types";

const { width } = Dimensions.get("window");

export default function MatchProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { startCall } = useCall();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [photoIndex, setPhotoIndex] = useState(0);

  const { data: matches = [], isLoading } = useQuery<MatchEntry[]>({ queryKey: ["/api/matches"] });
  const match = matches.find((m) => m.id === matchId);
  const partner: Profile | undefined = match
    ? match.user1Id === user?.id
      ? match.user2Profile
      : match.user1Profile
    : undefined;
  const partnerUserId = match ? (match.user1Id === user?.id ? match.user2Id : match.user1Id) : undefined;

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!match || !partner) {
    return (
      <View style={styles.loading}>
        <Text variant="muted">This match is no longer available.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const photos = partner.photos?.length ? partner.photos : [];
  const badges = [partner.sect, partner.religiousPractice, partner.prayerFrequency].filter(Boolean);

  const openChat = () =>
    router.push({
      pathname: "/chat/[matchId]",
      params: { matchId: match.id, name: partner.displayName, photo: photos[0] ?? "" },
    });

  const call = (callType: "audio" | "video") => {
    if (partnerUserId)
      startCall({ calleeUserId: partnerUserId, callType, name: partner.displayName, photo: photos[0] });
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Photo carousel */}
        <View style={styles.gallery}>
          {photos.length ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            >
              {photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photo} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="person" size={80} color={colors.subtleForeground} />
            </View>
          )}

          <LinearGradient colors={gradients.scrim} style={styles.scrim} pointerEvents="none" />

          {photos.length > 1 ? (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null}

          <SafeAreaView style={styles.galleryTop} edges={["top"]}>
            <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
          </SafeAreaView>

          <View style={styles.nameBlock}>
            <Text style={styles.name}>
              {partner.displayName}
              {partner.age ? <Text style={styles.age}>, {partner.age}</Text> : null}
            </Text>
            {partner.location ? (
              <View style={styles.locRow}>
                <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.85)" />
                <Text style={styles.loc}>{partner.location}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Details */}
        <View style={styles.body}>
          {badges.length ? (
            <View style={styles.badges}>
              {badges.map((b, i) => (
                <View key={i} style={styles.badge}>
                  <Text style={styles.badgeText}>{String(b)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {partner.profession || partner.occupation ? (
            <Detail icon="briefcase-outline" label={String(partner.profession || partner.occupation)} />
          ) : null}
          {partner.lookingFor ? <Detail icon="heart-outline" label={String(partner.lookingFor)} /> : null}

          {partner.bio ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>About</Text>
              <Text style={styles.bio}>{partner.bio}</Text>
            </View>
          ) : null}

          {partner.interests?.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Interests</Text>
              <View style={styles.badges}>
                {partner.interests.map((it, i) => (
                  <View key={i} style={styles.badge}>
                    <Text style={styles.badgeText}>{it}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Action bar */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable style={styles.circleBtn} onPress={() => call("audio")}>
          <Ionicons name="call" size={22} color={colors.primary} />
        </Pressable>
        <Pressable style={styles.messageBtn} onPress={openChat}>
          <Ionicons name="chatbubble" size={20} color={colors.primaryForeground} />
          <Text style={styles.messageText}>Message</Text>
        </Pressable>
        <Pressable style={styles.circleBtn} onPress={() => call("video")}>
          <Ionicons name="videocam" size={22} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function Detail({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.detailText}>{label}</Text>
    </View>
  );
}

const PHOTO_H = Math.round(width * 1.15);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },

  gallery: { width, height: PHOTO_H, backgroundColor: colors.card },
  photo: { width, height: PHOTO_H, backgroundColor: colors.input },
  photoPlaceholder: { alignItems: "center", justifyContent: "center" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 200 },
  galleryTop: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing.md },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  dots: { position: "absolute", top: spacing.md, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: "#fff", width: 18 },
  nameBlock: { position: "absolute", bottom: spacing.lg, left: spacing.xl, right: spacing.xl },
  name: { fontSize: 32, fontWeight: "800", color: "#fff" },
  age: { fontSize: 28, fontWeight: "400", color: "#fff" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  loc: { color: "rgba(255,255,255,0.9)", fontSize: 15 },

  body: { padding: spacing.xl, gap: spacing.lg },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  badge: {
    backgroundColor: gold.soft,
    borderColor: gold.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  badgeText: { color: colors.foreground, fontSize: 13 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  detailText: { color: colors.foreground, fontSize: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.primary, fontSize: 13, fontWeight: "700", letterSpacing: 0.4 },
  bio: { color: colors.foreground, fontSize: 16, lineHeight: 23 },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: "rgba(15,24,38,0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  circleBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: gold.border,
    backgroundColor: gold.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  messageBtn: {
    flex: 1,
    maxWidth: 220,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  messageText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 16 },
});
