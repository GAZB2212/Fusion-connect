import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { View, StyleSheet, Image, Pressable, Vibration, AppState } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { GroupChannelHandler } from "@sendbird/chat/groupChannel";
import { Text } from "./components/ui";
import { getSendbird } from "./sendbird";
import { apiRequest, getToken, getWebSocketUrl } from "./api";
import { registerPushToken, setupCallNotificationCategory, extractCallData } from "./push";
import { useAuth } from "./auth";
import { colors, spacing, gold } from "./theme";

export type CallType = "audio" | "video";
export type CallDirection = "outgoing" | "incoming";
export type CallPhase = "ringing" | "connecting" | "connected" | "ended";

export interface ActiveCall {
  callId: string;
  channel: string;
  callType: CallType;
  direction: CallDirection;
  phase: CallPhase;
  peerUserId: string;
  peerName: string;
  peerPhoto?: string;
  // Agora join credentials (available once the call is accepted)
  appId?: string;
  rtcToken?: string;
  uid?: number;
  endReason?: string;
}

interface IncomingCall {
  callId: string;
  channel: string;
  callType: CallType;
  callerId: string;
  callerName: string;
}

interface CallContextValue {
  activeCall: ActiveCall | null;
  startCall: (opts: {
    calleeUserId: string;
    callType: CallType;
    name: string;
    photo?: string;
  }) => Promise<void>;
  endCall: (reason?: string) => Promise<void>;
  markConnected: () => void;
  wsConnected: boolean;
}

const CallContext = createContext<CallContextValue>({
  activeCall: null,
  startCall: async () => {},
  endCall: async () => {},
  markConnected: () => {},
  wsConnected: false,
});

const INCOMING_VIBRATION = [0, 800, 1000] as number[];

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);
  const activeRef = useRef<ActiveCall | null>(null);
  const incomingRef = useRef<IncomingCall | null>(null);

  activeRef.current = activeCall;
  incomingRef.current = incomingCall;

  const stopRinging = useCallback(() => Vibration.cancel(), []);

  const clearIncoming = useCallback(() => {
    stopRinging();
    setIncomingCall(null);
  }, [stopRinging]);

  // ---- WebSocket lifecycle ---------------------------------------------
  const connect = useCallback(async () => {
    if (!user) return;
    const token = await getToken();
    if (!token) return;

    closedRef.current = false;
    try {
      const ws = new WebSocket(getWebSocketUrl("/ws", token));
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        if (pingRef.current) clearInterval(pingRef.current);
        pingRef.current = setInterval(() => {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch {
            // ignore
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }
        handleSignal(msg);
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (pingRef.current) clearInterval(pingRef.current);
        if (!closedRef.current) scheduleReconnect();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    } catch {
      scheduleReconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    reconnectRef.current = setTimeout(() => connect(), 3000);
  }, [connect]);

  const disconnect = useCallback(() => {
    closedRef.current = true;
    if (pingRef.current) clearInterval(pingRef.current);
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    try {
      wsRef.current?.close();
    } catch {
      // ignore
    }
    wsRef.current = null;
  }, []);

  // ---- Signal handling --------------------------------------------------
  const handleSignal = useCallback(
    (msg: { type: string; data?: any }) => {
      const { type, data } = msg;

      switch (type) {
        case "incoming_call": {
          // Ignore if we're already in a call.
          if (activeRef.current || incomingRef.current) return;
          const d = data || {};
          setIncomingCall({
            callId: d.callId,
            channel: d.channel,
            callType: (d.callType as CallType) || "audio",
            callerId: d.callerId,
            callerName: d.callerName || "Someone",
          });
          Vibration.vibrate(INCOMING_VIBRATION, true);
          break;
        }
        case "call_accepted": {
          // Our outgoing call was accepted — fetch our token and connect.
          const cur = activeRef.current;
          if (!cur || cur.callId !== data?.callId) return;
          (async () => {
            try {
              const creds = await apiRequest<{
                channel: string;
                rtcToken: string;
                uid: number;
                appId: string;
                callType: CallType;
              }>("GET", `/api/call/token?callId=${cur.callId}`);
              setActiveCall((prev) =>
                prev && prev.callId === cur.callId
                  ? {
                      ...prev,
                      phase: "connecting",
                      appId: creds.appId,
                      rtcToken: creds.rtcToken,
                      uid: creds.uid,
                      channel: creds.channel,
                    }
                  : prev
              );
            } catch (e: any) {
              // Surface the failure on the call screen instead of silently closing.
              setActiveCall((prev) =>
                prev && prev.callId === cur.callId
                  ? { ...prev, phase: "ended", endReason: e?.message || "connect-failed" }
                  : prev
              );
            }
          })();
          break;
        }
        case "call_declined": {
          const cur = activeRef.current;
          if (cur && cur.callId === data?.callId) {
            setActiveCall({ ...cur, phase: "ended", endReason: "declined" });
          }
          break;
        }
        case "call_ended": {
          const cur = activeRef.current;
          if (cur && cur.callId === data?.callId) {
            setActiveCall({ ...cur, phase: "ended", endReason: "ended" });
          }
          break;
        }
        case "call_cancelled":
        case "call_missed": {
          // Incoming ring cancelled by caller / timeout.
          if (incomingRef.current && incomingRef.current.callId === data?.callId) {
            clearIncoming();
          }
          const cur = activeRef.current;
          if (cur && cur.callId === data?.callId) {
            setActiveCall({ ...cur, phase: "ended", endReason: "missed" });
          }
          break;
        }
        default:
          break;
      }
    },
    [clearIncoming]
  );

  // Ask the server whether a call is ringing for me right now. Called when the
  // app comes to the foreground — e.g. the callee tapped an "Incoming call"
  // push that woke a closed app; the live signal was missed, but the ringing
  // call is still on the server, so we surface the answer overlay here.
  const checkPending = useCallback(async () => {
    if (activeRef.current || incomingRef.current) return;
    try {
      const pending = await apiRequest<{
        callId: string;
        channel: string;
        callType: CallType;
        callerId: string;
        callerName: string;
      } | null>("GET", "/api/call/pending");
      if (!pending?.callId) return;
      if (activeRef.current || incomingRef.current) return;
      setIncomingCall({
        callId: pending.callId,
        channel: pending.channel,
        callType: pending.callType || "audio",
        callerId: pending.callerId,
        callerName: pending.callerName || "Someone",
      });
      Vibration.vibrate(INCOMING_VIBRATION, true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user) {
      connect();
      checkPending();
    } else {
      disconnect();
      setActiveCall(null);
      clearIncoming();
    }
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // When the app returns to the foreground: reconnect the socket AND ask the
  // server whether a call is ringing (covers a closed app woken by a push).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && user) {
        if (wsRef.current?.readyState !== WebSocket.OPEN) connect();
        checkPending();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, connect, checkPending]);

  // Reliable call signaling over Sendbird. Our /ws is best-effort in production
  // (some hosts drop the upgrade), so we also carry every call signal as a
  // silent Sendbird channel control-message — the same transport that makes
  // chat reliable. The client de-dupes by callId, so double delivery is safe.
  useEffect(() => {
    if (!user) return;
    const handlerId = "fusion_call_signal";
    const handler = new GroupChannelHandler({
      onMessageReceived: (_channel, message) => {
        if ((message as any).customType !== "call_signal") return;
        let payload: any;
        try {
          payload = JSON.parse((message as any).data || "{}");
        } catch {
          return;
        }
        if (!payload?.signal) return;
        // The channel delivers to both members; only act on signals addressed
        // to me (e.g. the caller must ignore the incoming_call it just sent).
        if (payload.to && payload.to !== user.id) return;
        handleSignal({ type: payload.signal, data: payload });
      },
    });
    try {
      getSendbird().groupChannel.addGroupChannelHandler(handlerId, handler);
    } catch {
      // Sendbird not initialised yet — the provider will connect shortly.
    }
    return () => {
      try {
        getSendbird().groupChannel.removeGroupChannelHandler(handlerId);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, handleSignal]);

  // ---- Public actions ---------------------------------------------------
  const startCall = useCallback<CallContextValue["startCall"]>(
    async ({ calleeUserId, callType, name, photo }) => {
      if (activeRef.current) return;
      try {
        const res = await apiRequest<{ callId: string; channel: string; callType: CallType }>(
          "POST",
          "/api/call/invite",
          { calleeUserId, callType }
        );
        setActiveCall({
          callId: res.callId,
          channel: res.channel,
          callType,
          direction: "outgoing",
          phase: "ringing",
          peerUserId: calleeUserId,
          peerName: name,
          peerPhoto: photo,
        });
        router.push({ pathname: "/call/[callId]", params: { callId: res.callId } });
      } catch (e: any) {
        // Surface nothing invasive; caller UI stays put.
        throw e;
      }
    },
    [router]
  );

  const acceptIncoming = useCallback(async () => {
    const inc = incomingRef.current;
    if (!inc) return;
    stopRinging();
    try {
      const creds = await apiRequest<{
        channel: string;
        rtcToken: string;
        uid: number;
        appId: string;
        callType: CallType;
        callerId: string;
      }>("POST", "/api/call/accept", { callId: inc.callId });

      setActiveCall({
        callId: inc.callId,
        channel: creds.channel,
        callType: creds.callType || inc.callType,
        direction: "incoming",
        phase: "connecting",
        peerUserId: inc.callerId,
        peerName: inc.callerName,
        appId: creds.appId,
        rtcToken: creds.rtcToken,
        uid: creds.uid,
      });
      setIncomingCall(null);
      router.push({ pathname: "/call/[callId]", params: { callId: inc.callId } });
    } catch {
      clearIncoming();
    }
  }, [router, stopRinging, clearIncoming]);

  const declineIncoming = useCallback(async () => {
    const inc = incomingRef.current;
    if (!inc) return;
    clearIncoming();
    try {
      await apiRequest("POST", "/api/call/decline", { callId: inc.callId });
    } catch {
      // ignore
    }
  }, [clearIncoming]);

  const endCall = useCallback<CallContextValue["endCall"]>(async (reason) => {
    const cur = activeRef.current;
    setActiveCall(null);
    stopRinging();
    if (!cur) return;
    // Only tell the server if the call wasn't already terminated remotely.
    if (reason !== "declined" && reason !== "ended" && reason !== "missed") {
      try {
        await apiRequest("POST", "/api/call/end", { callId: cur.callId });
      } catch {
        // ignore
      }
    }
  }, [stopRinging]);

  const markConnected = useCallback(() => {
    setActiveCall((prev) => (prev ? { ...prev, phase: "connected" } : prev));
  }, []);

  // Accept a call identified by a push payload (tapped notification).
  const answerByCallId = useCallback(
    async (data: {
      callId?: string;
      callType?: CallType;
      callerId?: string;
      callerName?: string;
    }) => {
      const callId = data.callId;
      if (!callId || activeRef.current) return;
      stopRinging();
      try {
        const creds = await apiRequest<{
          channel: string;
          rtcToken: string;
          uid: number;
          appId: string;
          callType: CallType;
          callerId: string;
        }>("POST", "/api/call/accept", { callId });
        setActiveCall({
          callId,
          channel: creds.channel,
          callType: creds.callType || data.callType || "audio",
          direction: "incoming",
          phase: "connecting",
          peerUserId: data.callerId || creds.callerId,
          peerName: data.callerName || "Caller",
          appId: creds.appId,
          rtcToken: creds.rtcToken,
          uid: creds.uid,
        });
        setIncomingCall(null);
        router.push({ pathname: "/call/[callId]", params: { callId } });
      } catch {
        // Call likely already ended
      }
    },
    [router, stopRinging]
  );

  // Register for push + handle taps/actions on incoming-call notifications.
  useEffect(() => {
    if (!user) return;
    registerPushToken().catch(() => {});
    setupCallNotificationCategory().catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = extractCallData(response.notification.request.content.data);
      if (!data?.callId) return;
      if (response.actionIdentifier === "DECLINE") {
        apiRequest("POST", "/api/call/decline", { callId: data.callId }).catch(() => {});
      } else {
        answerByCallId(data);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, answerByCallId]);

  return (
    <CallContext.Provider value={{ activeCall, startCall, endCall, markConnected, wsConnected }}>
      {children}
      {incomingCall ? (
        <IncomingCallOverlay
          call={incomingCall}
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
        />
      ) : null}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);

// -------------------------------------------------------------------------
function IncomingCallOverlay({
  call,
  onAccept,
  onDecline,
}: {
  call: IncomingCall;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <SafeAreaView style={styles.overlayInner}>
        <View style={styles.callerBlock}>
          <View style={styles.avatarRing}>
            <Ionicons name="person" size={54} color={colors.subtleForeground} />
          </View>
          <Text style={styles.callerName}>{call.callerName}</Text>
          <Text style={styles.callSub}>
            Incoming {call.callType === "video" ? "video" : "voice"} call…
          </Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.actionCol}>
            <Pressable style={[styles.actionBtn, styles.decline]} onPress={onDecline}>
              <Ionicons name="close" size={30} color="#fff" />
            </Pressable>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>
          <View style={styles.actionCol}>
            <Pressable style={[styles.actionBtn, styles.accept]} onPress={onAccept}>
              <Ionicons
                name={call.callType === "video" ? "videocam" : "call"}
                size={30}
                color="#fff"
              />
            </Pressable>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.backgroundDeep,
    zIndex: 1000,
  },
  overlayInner: { flex: 1, justifyContent: "space-between", paddingVertical: spacing.xxl },
  callerBlock: { alignItems: "center", marginTop: spacing.xxl * 2 },
  avatarRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: gold.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  callerName: { fontSize: 30, fontWeight: "800", color: colors.foreground },
  callSub: { fontSize: 15, color: colors.mutedForeground, marginTop: spacing.sm },
  actions: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingBottom: spacing.xxl,
  },
  actionCol: { alignItems: "center", gap: spacing.sm },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  decline: { backgroundColor: colors.destructive },
  accept: { backgroundColor: colors.success },
  actionLabel: { color: colors.foreground, fontSize: 14 },
});
