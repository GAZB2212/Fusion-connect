import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

/**
 * Bridge to native CallKit + VoIP PushKit (the `expo-callkit-telecom` module).
 *
 * It talks to the native module directly through `requireOptionalNativeModule`
 * rather than importing the package's JS, so this file has NO bundle-time
 * dependency on the package. That makes native CallKit a pure build-time
 * switch: if the package is installed it is autolinked and this bridge goes
 * live; if it is removed, `Native` is null and every function here no-ops while
 * the in-app incoming-call overlay keeps working. See mobile/app.config.js.
 */

type Sub = { remove: () => void };
const NOOP_SUB: Sub = { remove: () => {} };

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Native: any =
  Platform.OS === "ios"
    ? safe(() => requireOptionalNativeModule("ExpoCallKitTelecom")) ?? null
    : null;

/** True only on an iOS build where the native CallKit module is linked. */
export const callKitAvailable = !!Native;

export type IncomingCallInfo = {
  serverCallId: string;
  callType: "audio" | "video";
  channel?: string;
  callerId?: string;
  callerName?: string;
};

// OS-assigned native call UUID -> our backend call.
const byNativeId = new Map<string, IncomingCallInfo>();
// Backend call ids that CallKit has presented (so the in-app overlay stands down).
const reportedServerCalls = new Set<string>();
// Native calls we ended ourselves — their "ended" event must not be treated as
// the user declining / hanging up.
const endedByUs = new Set<string>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function infoFromSession(session: any): IncomingCallInfo | null {
  const ev = session?.incomingCallEvent;
  if (!ev?.serverCallId) return null;
  const meta = (ev.metadata || {}) as Record<string, unknown>;
  return {
    serverCallId: ev.serverCallId,
    callType: ev.hasVideo ? "video" : "audio",
    channel: typeof meta.channel === "string" ? meta.channel : undefined,
    callerId: ev.caller?.id,
    callerName: ev.caller?.displayName,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function remember(session: any): IncomingCallInfo | null {
  if (!session?.id || session.origin !== "incoming") return null;
  const info = infoFromSession(session);
  if (!info) return null;
  byNativeId.set(session.id, info);
  reportedServerCalls.add(info.serverCallId);
  return info;
}

function listen(event: string, handler: (e: any) => void): Sub {
  if (!Native) return NOOP_SUB;
  return safe(() => Native.addListener(event, handler) as Sub) ?? NOOP_SUB;
}

/** Has CallKit already presented this backend call? */
export function isHandledByCallKit(serverCallId: string): boolean {
  return reportedServerCalls.has(serverCallId);
}

/** Register for VoIP push. Call once the user is authenticated. */
export function registerVoipPush(): void {
  if (!Native) return;
  safe(() => Native.registerVoIPPush());
}

/** Fire `cb` with the current VoIP token (if any) and on every refresh. */
export function onVoipToken(cb: (token: string) => void): Sub {
  if (!Native) return NOOP_SUB;
  const current = safe(() => Native.getVoIPPushToken())?.token;
  if (current) cb(current);
  return listen("onVoIPPushTokenUpdated", (e) => {
    if (e?.token) cb(e.token);
  });
}

/** CallKit presented an incoming call (also replayed after a cold start). */
export function onIncomingReported(
  cb: (info: IncomingCallInfo & { nativeId: string }) => void
): Sub {
  return listen("onCallSessionAdded", (e) => {
    const info = remember(e?.session);
    if (info) cb({ ...info, nativeId: e.session.id });
  });
}

/** The user answered from the native CallKit UI. */
export function onAnswered(
  cb: (info: IncomingCallInfo & { nativeId: string; requestId: string }) => void
): Sub {
  return listen("onCallAnswered", async (e) => {
    if (!e?.id) return;
    let info = byNativeId.get(e.id) ?? null;
    if (!info) {
      // Cold start: the answer can arrive before the session-added replay.
      try {
        info = remember(await Native.getActiveCallSession());
      } catch {
        info = null;
      }
    }
    if (!info) {
      // We can't tell which backend call this is — fail it so CallKit doesn't
      // sit on a "connecting" call forever.
      safe(() => Native.failIncomingCallConnected(e.requestId));
      return;
    }
    cb({ ...info, nativeId: e.id, requestId: e.requestId });
  });
}

/**
 * The call was declined / hung up from the native UI (or the OS ended it).
 * Not fired for calls this app ended itself via `endNativeCallFor`.
 */
export function onEnded(cb: (info: { nativeId: string; serverCallId?: string }) => void): Sub {
  return listen("onCallEnded", (e) => {
    if (!e?.id) return;
    const info = byNativeId.get(e.id);
    byNativeId.delete(e.id);
    if (endedByUs.delete(e.id)) return;
    cb({ nativeId: e.id, serverCallId: info?.serverCallId });
  });
}

/** Tell CallKit the answered call's media is connected (call becomes active). */
export function fulfillConnected(requestId: string): void {
  if (!Native) return;
  safe(() => Native.fulfillIncomingCallAnswered(requestId));
}

/** Tell CallKit the answer flow failed (CallKit then ends the call). */
export function failConnected(requestId: string): void {
  if (!Native) return;
  safe(() => Native.failIncomingCallConnected(requestId));
}

/**
 * Close the native call UI for one of our backend calls, if CallKit has it.
 *  - "remote": the other side cancelled / hung up / it timed out.
 *  - "local":  this user hung up from the in-app call screen.
 */
export function endNativeCallFor(serverCallId: string, by: "remote" | "local"): void {
  if (!Native) return;
  for (const [nativeId, info] of byNativeId) {
    if (info.serverCallId !== serverCallId) continue;
    byNativeId.delete(nativeId);
    if (by === "remote") {
      safe(() => Native.reportCallEnded(nativeId, "remoteEnded"));
    } else {
      endedByUs.add(nativeId);
      safe(() => Native.endCall(nativeId));
    }
  }
}
