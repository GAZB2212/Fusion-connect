import { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Image, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { GroupChannelHandler, GroupChannelListOrder } from "@sendbird/chat/groupChannel";
import type { GroupChannel } from "@sendbird/chat/groupChannel";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/ui";
import { TypingDots } from "@/components/TypingDots";
import { useSendbird, getSendbird } from "@/sendbird";
import { useAuth } from "@/auth";
import { colors, spacing, radius } from "@/theme";
import type { MatchEntry, Profile } from "@/types";

const LIST_HANDLER_ID = "fusion_channel_list_handler";

function previewOf(ch?: GroupChannel): string {
  const m: any = ch?.lastMessage;
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
  const { ready } = useSendbird();

  // Conversations are the people you've MATCHED with — one row per match.
  // Chaperones live inside each match's chat, never as their own conversation.
  const { data: matches = [], isLoading: matchesLoading, refetch, isRefetching } = useQuery<MatchEntry[]>({
    queryKey: ["/api/matches"],
  });

  // Sendbird channels give us last message + unread per match (keyed by url = matchId).
  const [channelMap, setChannelMap] = useState<Map<string, GroupChannel>>(new Map());
  // Channels (by url) where the other person is currently typing.
  const [typingChannels, setTypingChannels] = useState<Set<string>>(new Set());

  const loadChannels = useCallback(async () => {
    if (!ready) return;
    try {
      const sb = getSendbird();
      const query = sb.groupChannel.createMyGroupChannelListQuery({
        includeEmpty: true,
        limit: 100,
        order: GroupChannelListOrder.LATEST_LAST_MESSAGE,
      });
      const list = await query.next();
      const map = new Map<string, GroupChannel>();
      for (const c of list) map.set(c.url, c);
      setChannelMap(map);
    } catch {
      // keep whatever we have
    }
  }, [ready]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useFocusEffect(
    useCallback(() => {
      refetch();
      loadChannels();
    }, [refetch, loadChannels])
  );

  useEffect(() => {
    if (!ready) return;
    const sb = getSendbird();
    const handler = new GroupChannelHandler({
      onMessageReceived: () => loadChannels(),
      onChannelChanged: () => loadChannels(),
      onTypingStatusUpdated: (ch) => {
        const someoneElseTyping = ch.getTypingUsers().some((u) => u.userId !== user?.id);
        setTypingChannels((prev) => {
          const next = new Set(prev);
          if (someoneElseTyping) next.add(ch.url);
          else next.delete(ch.url);
          return next;
        });
      },
    });
    sb.groupChannel.addGroupChannelHandler(LIST_HANDLER_ID, handler);
    return () => sb.groupChannel.removeGroupChannelHandler(LIST_HANDLER_ID);
  }, [ready, loadChannels]);

  const partnerOf = (m: MatchEntry): Profile =>
    m.user1Id === user?.id ? m.user2Profile : m.user1Profile;

  // Sort matches by their latest message (active chats first).
  const rows = [...matches].sort((a, b) => {
    const ta = channelMap.get(a.id)?.lastMessage?.createdAt ?? 0;
    const tb = channelMap.get(b.id)?.lastMessage?.createdAt ?? 0;
    return tb - ta;
  });

  const openChat = (m: MatchEntry) => {
    const p = partnerOf(m);
    router.push({
      pathname: "/chat/[matchId]",
      params: { matchId: m.id, name: p.displayName, photo: p.photos?.[0] ?? "" },
    });
  };

  if (matchesLoading) {
    return (
      <Screen title="Messages" subtitle="Your conversations">
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Messages"
      subtitle={rows.length ? `${rows.length} conversation${rows.length === 1 ? "" : "s"}` : "Your conversations"}
    >
      {rows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={44} color={colors.mutedForeground} />
          <Text variant="muted" style={{ marginTop: spacing.md, textAlign: "center" }}>
            No conversations yet.{"\n"}When you match, message them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: spacing.sm }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); loadChannels(); }} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const p = partnerOf(item);
            const ch = channelMap.get(item.id);
            const unread = ch?.unreadMessageCount ?? 0;
            return (
              <Pressable style={styles.row} onPress={() => openChat(item)}>
                {p.photos?.[0] ? (
                  <Image source={{ uri: p.photos[0] }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={26} color={colors.subtleForeground} />
                  </View>
                )}
                <View style={styles.rowInfo}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.displayName}
                    </Text>
                    <Text style={styles.time}>{timeAgo(ch?.lastMessage?.createdAt)}</Text>
                  </View>
                  <View style={styles.rowBottom}>
                    {typingChannels.has(item.id) ? (
                      <View style={styles.typingWrap}>
                        <TypingDots />
                        <Text style={styles.typingLabel}>typing…</Text>
                      </View>
                    ) : (
                      <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
                        {previewOf(ch)}
                      </Text>
                    )}
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
  typingWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  typingLabel: { fontSize: 14, color: colors.primary, fontStyle: "italic" },
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
