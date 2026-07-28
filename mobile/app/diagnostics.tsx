import { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Background } from "@/components/Background";
import { Text } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { API_URL, apiRequest, getToken, ApiError } from "@/api";
import { useAuth } from "@/auth";
import { useCall } from "@/calls";
import type { MatchEntry, Profile } from "@/types";
import { colors, spacing, radius } from "@/theme";

type Check = { path: string; label: string };

const CHECKS: Check[] = [
  { path: "/api/auth/user", label: "Auth / current user" },
  { path: "/api/profile", label: "My profile" },
  { path: "/api/discover", label: "Discover feed" },
  { path: "/api/matches", label: "Matches" },
  { path: "/api/likes", label: "Likes" },
  { path: "/api/sendbird/token", label: "Chat token (Sendbird)" },
];

type Result = { label: string; path: string; ok: boolean; status: number | string; detail: string };

export default function Diagnostics() {
  const router = useRouter();
  const { user } = useAuth();
  const { wsConnected } = useCall();
  const [running, setRunning] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  const run = async () => {
    setRunning(true);
    setResults([]);
    setHasToken(!!(await getToken()));
    const out: Result[] = [];
    for (const c of CHECKS) {
      try {
        const data = await apiRequest<any>("GET", c.path);
        let detail = "";
        if (Array.isArray(data)) detail = `${data.length} item(s)`;
        else if (data && typeof data === "object") detail = Object.keys(data).slice(0, 4).join(", ");
        else if (data == null) detail = "null";
        else detail = String(data).slice(0, 40);
        out.push({ label: c.label, path: c.path, ok: true, status: 200, detail });
      } catch (e) {
        const status = e instanceof ApiError ? e.status : "ERR";
        const detail = e instanceof Error ? e.message : String(e);
        out.push({ label: c.label, path: c.path, ok: false, status, detail: detail.slice(0, 120) });
      }
      setResults([...out]);
    }
    setRunning(false);
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Background>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Diagnostics</Text>
          <Pressable onPress={run} hitSlop={10} disabled={running}>
            <Ionicons name="refresh" size={22} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.metaCard}>
            <Row k="Backend" v={API_URL} />
            <Row k="Signed in" v={user ? user.email : "no"} />
            <Row k="My user ID" v={user?.id || "—"} />
            <Row k="Realtime (calls)" v={wsConnected ? "✅ connected" : "❌ not connected"} />
            <Row k="Auth token stored" v={hasToken == null ? "…" : hasToken ? "yes" : "no"} />
          </View>

          <MatchesBreakdown myId={user?.id} />


          {running && results.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}

          {results.map((r) => (
            <View key={r.path} style={styles.checkRow}>
              <Ionicons
                name={r.ok ? "checkmark-circle" : "close-circle"}
                size={22}
                color={r.ok ? colors.success : colors.destructive}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.checkLabel}>
                  {r.label} <Text style={styles.checkStatus}>· {String(r.status)}</Text>
                </Text>
                <Text style={styles.checkDetail} numberOfLines={3}>
                  {r.detail}
                </Text>
              </View>
            </View>
          ))}

          <Text style={styles.hint}>
            Screenshot this whole screen and send it — it shows exactly which parts of the app can
            reach the server and which are failing.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}

function MatchesBreakdown({ myId }: { myId?: string }) {
  const { data: matches = [] } = useQuery<MatchEntry[]>({ queryKey: ["/api/matches"] });
  if (!matches.length) return null;
  return (
    <View style={styles.metaCard}>
      <Text style={styles.matchesTitle}>MY MATCHES (partner = who a call would ring)</Text>
      {matches.map((m) => {
        const partner: Profile = m.user1Id === myId ? m.user2Profile : m.user1Profile;
        const partnerId = m.user1Id === myId ? m.user2Id : m.user1Id;
        return (
          <View key={m.id} style={styles.matchRow}>
            <Text style={styles.matchName}>{partner?.displayName || "?"}</Text>
            <Text style={styles.matchId}>partner id: {partnerId}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaK}>{k}</Text>
      <Text style={styles.metaV} numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  content: { padding: spacing.lg, gap: spacing.md },
  center: { padding: spacing.xl, alignItems: "center" },
  metaCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metaRow: { flexDirection: "row", gap: spacing.md },
  metaK: { width: 120, color: colors.mutedForeground, fontSize: 13 },
  metaV: { flex: 1, color: colors.foreground, fontSize: 13, fontWeight: "500" },
  checkRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  matchesTitle: { color: colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  matchRow: { gap: 2 },
  matchName: { color: colors.foreground, fontSize: 15, fontWeight: "600" },
  matchId: { color: colors.mutedForeground, fontSize: 12 },
  checkLabel: { color: colors.foreground, fontSize: 15, fontWeight: "600" },
  checkStatus: { color: colors.mutedForeground, fontWeight: "400", fontSize: 13 },
  checkDetail: { color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
  hint: { color: colors.subtleForeground, fontSize: 13, textAlign: "center", marginTop: spacing.md, lineHeight: 18 },
});
