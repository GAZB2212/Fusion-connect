import { Modal, View, StyleSheet, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./ui";
import { colors, spacing, radius } from "@/theme";
import type { DiscoverProfile } from "@/types";

export function MatchModal({ profile, onClose }: { profile: DiscoverProfile | null; onClose: () => void }) {
  const router = useRouter();
  if (!profile) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Ionicons name="heart" size={48} color={colors.primary} />
          <Text style={styles.title}>It's a Match!</Text>
          <Text variant="muted" style={styles.sub}>
            You and {profile.displayName} both said yes
          </Text>
          {profile.photos?.[0] ? (
            <Image source={{ uri: profile.photos[0] }} style={styles.avatar} />
          ) : null}
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              onClose();
              router.push("/(tabs)/messages");
            }}
          >
            <Text style={styles.primaryText}>Send a message</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text variant="muted" style={{ marginTop: spacing.md }}>
              Keep browsing
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(10,22,40,0.85)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { alignItems: "center", backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xxl, width: "100%", borderWidth: 1, borderColor: colors.cardBorder },
  title: { fontSize: 28, fontWeight: "700", color: colors.primary, marginTop: spacing.md },
  sub: { textAlign: "center", marginTop: 4 },
  avatar: { width: 120, height: 120, borderRadius: 60, marginVertical: spacing.xl, borderWidth: 2, borderColor: colors.primary },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, marginTop: spacing.sm },
  primaryText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 16 },
});
