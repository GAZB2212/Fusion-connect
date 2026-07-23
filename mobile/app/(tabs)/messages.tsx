import { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, FlatList, Image, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GroupChannelHandler, GroupChannelListOrder } from "@sendbird/chat/groupChannel";
import type { GroupChannel } from "@sendbird/chat/groupChannel";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/ui";
import { useSendbird, getSendbird } from "@/sendbird";
import { useAuth } from "@/auth";
import { colors, spacing, radius } from "@/theme";

const LIST_HANDLER_ID = "fusion_channel_list_handler";

function lastMessagePreview(ch: GroupChannel): string {
  const m: any = ch.lastMessage;
  if (!m) return "Say salaam 👋";
  if (m.isFileMessage?.()) return "📷 Photo";
  return m.message || "";
}

function timeAgo(ms?: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return `${Math.floor(day / 7)}w`;
}

export default function Messages() {
  const router = useRouter();
  const { user } = useAuth();
  const { ready, error: connError, reconnect } = useSendbird();
  const [channels, setChannels] = useState<GroupChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return;
    try {
      const sb = getSendbird();
      const query = sb.groupChannel.createMyGroupChannelListQuery({
        includeEmpty: true,
        limit: 50,
        order: GroupChannelListOrder.LATEST_LAST_MESSAGE,
      });
      const list = await query.next();
      setChannels(list);
    } catch {
      // leave whatever we have
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ready]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when returning to the tab.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Live-update the list on new messages / read status.
  useEffect(() => {
    if (!ready) return;
    const sb = getSendbird();
    const handler = new GroupChannelHandler({
      onMessageReceived: () => load(),
      onChannelChanged: () => load(),
    });
    sb.groupChannel.addGroupChannelHandler(LIST_HANDLER_ID, handler);
    return () => sb.groupChannel.removeGroupChannelHandler(LIST_HANDLER_ID);
  }, [ready, load]);

  const partnerOf = (ch: GroupChannel) => ch.members.find((m) => m.userId !== user?.id);

  const openChat = (ch: GroupChannel) => {
    const p = partnerOf(ch);
    router.push({
      pathname: "/chat/[matchId]",
      params: { matchId: ch.url, name: p?.nickname || "Chat", photo: p?.profileUrl || "" },
    });
  };

  if (loading && !ready && !connError) {
    return (
      <Screen title="Messages" subtitle="Your conversations">
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (connError) {
    return (
      <Screen title="Messages" subtitle="Your conversations">
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
          <Text variant="muted" style={{ marginTop: spacing.md, textAlign: "center" }}>
            {connError}
          </Text>
          <Pressable onPress={reconnect} style={styles.retry}>
            <Text style={{ color: colors.primary, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Messages" subtitle={channels.length ? `${channels.length} conversations` : "Your conversations"}>
      {channels.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={44} color={colors.mutedForeground} />
          <Text variant="muted" style={{ marginTop: spacing.md, textAlign: "center" }}>
            No conversations yet.{"\n"}When you match, message them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={(c) => c.url}
          contentContainerStyle={{ paddingVertical: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const p = partnerOf(item);
            const unread = item.unreadMessageCount;
            return (
              <Pressable style={styles.row} onPress={() => openChat(item)}>
                {p?.profileUrl ? (
                  <Image source={{ uri: p.profileUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={26} color={colors.subtleForeground} />
                  </View>
                )}
                <View style={styles.rowInfo}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p?.nickname || "Match"}
                    </Text>
                    <Text style={styles.time}>{timeAgo(item.lastMessage?.createdAt)}</Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text
                      style={[styles.preview, unread > 0 && styles.previewUnread]}
                      numberOfLines={1}
                    >
                      {lastMessagePreview(item)}
                    </Text>
                    {unread > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
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
  retry: { marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.input },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: spacing.md },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.foreground },
  time: { fontSize: 12, color: colors.subtleForeground, marginLeft: spacing.sm },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preview: { flex: 1, fontSize: 14, color: colors.mutedForeground },
  previewUnread: { color: colors.foreground, fontWeight: "500" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: spacing.sm,
  },
  badgeText: { fontSize: 12, fontWeight: "700", color: colors.primaryForeground },
});
