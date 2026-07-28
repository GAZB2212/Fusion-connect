import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GroupChannelHandler } from "@sendbird/chat/groupChannel";
import type { GroupChannel } from "@sendbird/chat/groupChannel";
import type { BaseMessage } from "@sendbird/chat/message";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MatchEntry } from "@/types";
import { Background } from "@/components/Background";
import { Text } from "@/components/ui";
import { connectSendbird, getSendbird } from "@/sendbird";
import { useCall } from "@/calls";
import { apiRequest } from "@/api";
import { useAuth } from "@/auth";
import { colors, spacing, radius, gold } from "@/theme";

const HANDLER_ID = "fusion_chat_handler";

/** Stable key for a message whether it's still pending (reqId) or delivered (messageId). */
function keyFor(m: BaseMessage): string {
  return String((m as any).messageId || (m as any).reqId || (m as any).createdAt);
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const min = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

export default function Chat() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ matchId: string; name?: string; photo?: string }>();
  const matchId = String(params.matchId);
  const name = params.name ? String(params.name) : "Chat";
  const photo = params.photo ? String(params.photo) : undefined;

  const { startCall } = useCall();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // The call partner is the OTHER real user in this match — derived from the
  // match record, NOT the Sendbird channel members (which also include
  // chaperones). Using a chaperone's id would 404 as "user not found".
  const { data: allMatches = [] } = useQuery<MatchEntry[]>({ queryKey: ["/api/matches"] });
  const thisMatch = allMatches.find((m) => m.id === matchId);
  const callPartnerId = thisMatch
    ? thisMatch.user1Id === user?.id
      ? thisMatch.user2Id
      : thisMatch.user1Id
    : null;

  const placeCall = async (callType: "audio" | "video") => {
    if (!callPartnerId) {
      Alert.alert("Can't call yet", "Still loading this match — try again in a moment.");
      return;
    }
    try {
      await startCall({ calleeUserId: callPartnerId, callType, name, photo });
    } catch (e: any) {
      Alert.alert("Call failed", e?.message || "Couldn't start the call. Please try again.");
    }
  };
  const [channel, setChannel] = useState<GroupChannel | null>(null);
  const [messages, setMessages] = useState<BaseMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  const channelRef = useRef<GroupChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myId = user?.id;

  // Merge messages, de-duping by stable key and keeping newest-first order.
  // Call-signal control messages are invisible plumbing — never render them.
  const mergeMessages = useCallback((incoming: BaseMessage[]) => {
    const visible = incoming.filter((m) => (m as any).customType !== "call_signal");
    setMessages((prev) => {
      const map = new Map<string, BaseMessage>();
      for (const m of prev) map.set(keyFor(m), m);
      for (const m of visible) map.set(keyFor(m), m);
      return Array.from(map.values()).sort(
        (a, b) => (b as any).createdAt - (a as any).createdAt
      );
    });
  }, []);

  // Connect, ensure the channel exists on the backend, load history, subscribe.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sb = await connectSendbird();
        // Make sure the group channel is provisioned for this match.
        await apiRequest("POST", `/api/sendbird/ensure-channel/${matchId}`);
        const ch = await sb.groupChannel.getChannel(matchId);
        if (cancelled) return;

        channelRef.current = ch;
        setChannel(ch);
        const partner = ch.members.find((m) => m.userId !== myId);
        if (partner) setPartnerId(partner.userId);

        const query = ch.createPreviousMessageListQuery({ limit: 60, reverse: true });
        const history = await query.load();
        if (cancelled) return;

        mergeMessages(history);
        setLoading(false);
        ch.markAsRead().catch(() => {});
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Couldn't open this conversation");
          setLoading(false);
        }
      }
    })();

    // Real-time handler for this channel.
    const sb = getSendbird();
    const handler = new GroupChannelHandler({
      onMessageReceived: (ch, message) => {
        if (ch.url !== matchId) return;
        mergeMessages([message]);
        channelRef.current?.markAsRead().catch(() => {});
      },
      onMessageUpdated: (ch, message) => {
        if (ch.url !== matchId) return;
        mergeMessages([message]);
      },
      onTypingStatusUpdated: (ch) => {
        if (ch.url !== matchId) return;
        const typers = ch.getTypingUsers().filter((u) => u.userId !== myId);
        setPartnerTyping(typers.length > 0);
      },
      onUnreadMemberStatusUpdated: (ch) => {
        if (ch.url !== matchId) return;
        // Nudge a re-render so read receipts refresh.
        setMessages((prev) => [...prev]);
      },
    });
    sb.groupChannel.addGroupChannelHandler(HANDLER_ID, handler);

    return () => {
      cancelled = true;
      getSendbird().groupChannel.removeGroupChannelHandler(HANDLER_ID);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      channelRef.current?.endTyping();
    };
  }, [matchId, myId, mergeMessages]);

  const onChangeDraft = (text: string) => {
    setDraft(text);
    const ch = channelRef.current;
    if (!ch) return;
    if (text.length > 0) {
      ch.startTyping();
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => ch.endTyping(), 3000);
    } else {
      ch.endTyping();
    }
  };

  const send = () => {
    const ch = channelRef.current;
    const text = draft.trim();
    if (!ch || !text) return;
    setDraft("");
    ch.endTyping();

    ch.sendUserMessage({ message: text })
      .onPending((msg) => mergeMessages([msg]))
      .onSucceeded((msg) => mergeMessages([msg]))
      .onFailed((_err, msg) => {
        if (msg) mergeMessages([msg]);
      });
  };

  const doUnmatch = () => {
    Alert.alert("Unmatch", `Unmatch with ${name.split(" ")[0]}? This removes your conversation.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unmatch",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest("DELETE", `/api/matches/${matchId}`);
            await queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
          } catch {
            // ignore
          }
          router.back();
        },
      },
    ]);
  };

  const doBlock = () => {
    if (!partnerId) return;
    Alert.alert("Block", `Block ${name.split(" ")[0]}? They won't be able to contact you.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest("POST", `/api/users/${partnerId}/block`);
            await queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
          } catch {
            // ignore
          }
          router.back();
        },
      },
    ]);
  };

  const doReport = () => {
    if (!partnerId) return;
    const submit = async (reason: string) => {
      try {
        await apiRequest("POST", `/api/users/${partnerId}/report`, { reason });
        Alert.alert("Thank you", "Our team will review this report.");
      } catch {
        // ignore
      }
    };
    const reasons = ["Inappropriate messages", "Fake profile", "Harassment", "Other"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: "Report reason", options: [...reasons, "Cancel"], cancelButtonIndex: reasons.length },
        (i) => {
          if (i < reasons.length) submit(reasons[i]);
        }
      );
    } else {
      Alert.alert("Report reason", undefined, [
        ...reasons.map((r) => ({ text: r, onPress: () => submit(r) })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  };

  const openMenu = () => {
    const options = ["Unmatch", "Block", "Report", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 1, cancelButtonIndex: 3 },
        (i) => {
          if (i === 0) doUnmatch();
          else if (i === 1) doBlock();
          else if (i === 2) doReport();
        }
      );
    } else {
      Alert.alert(name, undefined, [
        { text: "Unmatch", onPress: doUnmatch },
        { text: "Block", style: "destructive", onPress: doBlock },
        { text: "Report", onPress: doReport },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const renderItem = useCallback(
    ({ item, index }: { item: BaseMessage; index: number }) => {
      if (item.isAdminMessage?.()) {
        return (
          <View style={styles.systemRow}>
            <Text style={styles.systemText}>{(item as any).message}</Text>
          </View>
        );
      }

      const senderId = (item as any).sender?.userId;
      const mine = senderId === myId;
      const text = (item as any).message ?? "";
      const createdAt = (item as any).createdAt as number;
      const failed = (item as any).sendingStatus === "failed";

      // Read receipt only for my most-recent message.
      const isNewestMine = mine && index === messages.findIndex((m) => (m as any).sender?.userId === myId);
      let receipt: string | null = null;
      if (isNewestMine && channel && (item as any).messageId) {
        try {
          const unread = channel.getUnreadMemberCount(item as any);
          receipt = unread === 0 ? "Read" : "Sent";
        } catch {
          receipt = null;
        }
      }

      return (
        <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{text}</Text>
          </View>
          <View style={[styles.metaRow, mine ? styles.metaRight : styles.metaLeft]}>
            <Text style={styles.metaText}>{formatTime(createdAt)}</Text>
            {failed ? (
              <Text style={styles.metaFailed}> · Failed</Text>
            ) : receipt ? (
              <Text style={[styles.metaText, receipt === "Read" && styles.metaRead]}> · {receipt}</Text>
            ) : null}
          </View>
        </View>
      );
    },
    [myId, messages, channel]
  );

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
            <Ionicons name="person" size={18} color={colors.subtleForeground} />
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {name}
          </Text>
          {partnerTyping ? (
            <Text style={styles.headerStatus}>typing…</Text>
          ) : (
            <Text style={styles.headerStatusMuted}>Matched</Text>
          )}
        </View>
        <Pressable
          onPress={() => placeCall("audio")}
          disabled={!callPartnerId}
          hitSlop={8}
          style={[styles.callBtn, !callPartnerId && styles.callBtnDisabled]}
        >
          <Ionicons name="call" size={19} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => placeCall("video")}
          disabled={!callPartnerId}
          hitSlop={8}
          style={[styles.callBtn, !callPartnerId && styles.callBtnDisabled]}
        >
          <Ionicons name="videocam" size={19} color={colors.primary} />
        </Pressable>
        <Pressable onPress={openMenu} hitSlop={8} style={styles.menuBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.foreground} />
        </Pressable>
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, photo, partnerTyping, callPartnerId]
  );

  return (
    <Background>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        {header}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
              <Text variant="muted" style={{ marginTop: spacing.md, textAlign: "center" }}>
                {error}
              </Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              inverted
              keyExtractor={keyFor}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              keyboardDismissMode="interactive"
              ListFooterComponent={
                messages.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>Say salaam 👋</Text>
                    <Text variant="muted" style={styles.emptySub}>
                      Start the conversation with {name.split(" ")[0]}.
                    </Text>
                  </View>
                ) : null
              }
            />
          )}

          {partnerTyping ? (
            <View style={styles.typingBar}>
              <Text style={styles.typingText}>{name.split(" ")[0]} is typing…</Text>
            </View>
          ) : null}

          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <TextInput
              style={styles.input}
              placeholder="Message"
              placeholderTextColor={colors.subtleForeground}
              value={draft}
              onChangeText={onChangeDraft}
              multiline
              onSubmitEditing={send}
              blurOnSubmit={false}
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim()}
              style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
            >
              <Ionicons name="arrow-up" size={22} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBtn: { padding: 2 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.input },
  headerAvatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: "700", color: colors.foreground },
  headerStatus: { fontSize: 13, color: colors.primary, fontWeight: "500" },
  headerStatusMuted: { fontSize: 13, color: colors.subtleForeground },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: gold.border,
    backgroundColor: gold.soft,
  },
  callBtnDisabled: { opacity: 0.4 },
  menuBtn: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },

  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 2 },

  bubbleRow: { marginVertical: 4, maxWidth: "82%" },
  rowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  rowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 16, color: colors.foreground, lineHeight: 21 },
  bubbleTextMine: { color: colors.primaryForeground, fontWeight: "500" },

  metaRow: { flexDirection: "row", marginTop: 3, paddingHorizontal: 4 },
  metaLeft: { justifyContent: "flex-start" },
  metaRight: { justifyContent: "flex-end" },
  metaText: { fontSize: 11, color: colors.subtleForeground },
  metaRead: { color: colors.primary },
  metaFailed: { fontSize: 11, color: colors.destructive },

  systemRow: { alignItems: "center", marginVertical: spacing.md },
  systemText: {
    fontSize: 12,
    color: colors.mutedForeground,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    overflow: "hidden",
    textAlign: "center",
  },

  emptyWrap: { alignItems: "center", paddingVertical: spacing.xxl, transform: [{ scaleY: -1 }] },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 6 },
  emptySub: { textAlign: "center" },

  typingBar: { paddingHorizontal: spacing.lg, paddingBottom: 4 },
  typingText: { fontSize: 12, color: colors.subtleForeground, fontStyle: "italic" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.xl,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: gold.faintBorder,
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "ios" ? 12 : 8,
    paddingBottom: Platform.OS === "ios" ? 12 : 8,
    color: colors.foreground,
    fontSize: 16,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
