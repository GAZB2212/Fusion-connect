import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
  type IRtcEngine,
  type IRtcEngineEventHandler,
} from "react-native-agora";
import { Text } from "@/components/ui";
import { useCall } from "@/calls";
import { colors, spacing, gold } from "@/theme";

export default function CallScreen() {
  const router = useRouter();
  const { activeCall, endCall, markConnected } = useCall();

  const engineRef = useRef<IRtcEngine | null>(null);
  const joinedRef = useRef(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [videoOff, setVideoOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const isVideo = activeCall?.callType === "video";
  const phase = activeCall?.phase;

  // ---- Duration timer (once connected) ---------------------------------
  useEffect(() => {
    if (phase !== "connected") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // ---- Auto-dismiss when the call ends ---------------------------------
  useEffect(() => {
    if (!activeCall) {
      teardown();
      if (router.canGoBack()) router.back();
      return;
    }
    if (activeCall.phase === "ended") {
      const t = setTimeout(() => {
        endCall(activeCall.endReason);
      }, 1400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.phase, activeCall === null]);

  // ---- Join the Agora channel once we have credentials -----------------
  useEffect(() => {
    if (!activeCall?.appId || !activeCall?.rtcToken || joinedRef.current) return;
    joinedRef.current = true;

    const engine = createAgoraRtcEngine();
    engineRef.current = engine;
    engine.initialize({ appId: activeCall.appId });

    const handler: IRtcEngineEventHandler = {
      onJoinChannelSuccess: () => {
        // local joined; wait for remote
      },
      onUserJoined: (_conn, uid) => {
        setRemoteUid(uid);
        markConnected();
      },
      onUserOffline: () => {
        setRemoteUid(null);
        endCall("ended");
      },
    };
    engine.registerEventHandler(handler);

    if (isVideo) {
      engine.enableVideo();
      engine.startPreview();
    } else {
      engine.disableVideo();
      engine.enableAudio();
    }
    engine.setEnableSpeakerphone(true);

    engine.joinChannel(activeCall.rtcToken, activeCall.channel, activeCall.uid ?? 0, {
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      publishCameraTrack: isVideo,
      autoSubscribeAudio: true,
      autoSubscribeVideo: isVideo,
    });

    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.appId, activeCall?.rtcToken]);

  function teardown() {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      engine.leaveChannel();
      engine.unregisterEventHandler({});
      engine.release();
    } catch {
      // ignore
    }
    engineRef.current = null;
    joinedRef.current = false;
  }

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.muteLocalAudioStream(next);
  };
  const toggleSpeaker = () => {
    const next = !speaker;
    setSpeaker(next);
    engineRef.current?.setEnableSpeakerphone(next);
  };
  const toggleVideo = () => {
    const next = !videoOff;
    setVideoOff(next);
    engineRef.current?.muteLocalVideoStream(next);
  };
  const flipCamera = () => engineRef.current?.switchCamera();

  const hangUp = () => endCall();

  const statusLabel = () => {
    if (!activeCall) return "";
    if (activeCall.phase === "ended") {
      if (activeCall.endReason === "declined") return "Call declined";
      if (activeCall.endReason === "missed") return "No answer";
      return "Call ended";
    }
    if (activeCall.phase === "connected") return formatDuration(elapsed);
    if (activeCall.direction === "outgoing") return "Ringing…";
    return "Connecting…";
  };

  const showRemoteVideo = isVideo && remoteUid !== null && activeCall?.phase === "connected";

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      {/* Remote video fills the screen; audio calls show a gradient + avatar */}
      {showRemoteVideo ? (
        <RtcSurfaceView style={styles.remote} canvas={{ uid: remoteUid! }} zOrderMediaOverlay={false} />
      ) : (
        <View style={styles.audioBg}>
          <View style={styles.avatarRing}>
            <Ionicons name="person" size={64} color={colors.subtleForeground} />
          </View>
        </View>
      )}

      {/* Local preview (video only) */}
      {isVideo && !videoOff && activeCall?.phase !== "ended" ? (
        <View style={styles.localWrap}>
          <RtcSurfaceView style={styles.local} canvas={{ uid: 0 }} zOrderMediaOverlay={true} />
        </View>
      ) : null}

      <SafeAreaView style={styles.hud} pointerEvents="box-none">
        <View style={styles.topInfo}>
          <Text style={styles.peerName}>{activeCall?.peerName ?? "Call"}</Text>
          <Text style={styles.status}>{statusLabel()}</Text>
        </View>

        <View style={styles.controls}>
          <ControlButton icon={muted ? "mic-off" : "mic"} active={muted} onPress={toggleMute} label="Mute" />
          {isVideo ? (
            <>
              <ControlButton
                icon={videoOff ? "videocam-off" : "videocam"}
                active={videoOff}
                onPress={toggleVideo}
                label="Video"
              />
              <ControlButton icon="camera-reverse" onPress={flipCamera} label="Flip" />
            </>
          ) : (
            <ControlButton
              icon="volume-high"
              active={speaker}
              onPress={toggleSpeaker}
              label="Speaker"
            />
          )}
          <ControlButton icon="call" hangup onPress={hangUp} label="End" />
        </View>
      </SafeAreaView>
    </View>
  );
}

function ControlButton({
  icon,
  onPress,
  active,
  hangup,
  label,
}: {
  icon: any;
  onPress: () => void;
  active?: boolean;
  hangup?: boolean;
  label: string;
}) {
  return (
    <View style={styles.ctrlCol}>
      <Pressable
        onPress={onPress}
        style={[styles.ctrl, active && styles.ctrlActive, hangup && styles.ctrlHangup]}
      >
        <Ionicons
          name={icon}
          size={26}
          color={hangup ? "#fff" : active ? colors.primaryForeground : colors.foreground}
          style={hangup ? { transform: [{ rotate: "135deg" }] } : undefined}
        />
      </Pressable>
      <Text style={styles.ctrlLabel}>{label}</Text>
    </View>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundDeep },
  remote: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  audioBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.backgroundDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: gold.border,
    alignItems: "center",
    justifyContent: "center",
  },
  localWrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    right: spacing.lg,
    width: 108,
    height: 160,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    zIndex: 20,
  },
  local: { flex: 1 },

  hud: { flex: 1, justifyContent: "space-between", zIndex: 30 },
  topInfo: { alignItems: "center", marginTop: spacing.xxl },
  peerName: { fontSize: 26, fontWeight: "800", color: colors.foreground },
  status: { fontSize: 15, color: colors.mutedForeground, marginTop: 6 },

  controls: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  ctrlCol: { alignItems: "center", gap: spacing.sm },
  ctrl: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlActive: { backgroundColor: colors.primary },
  ctrlHangup: { backgroundColor: colors.destructive },
  ctrlLabel: { color: colors.foreground, fontSize: 12 },
});
