import { Platform } from "react-native";

/**
 * Thin, crash-safe bridge over `expo-callkit-telecom` (native CallKit + VoIP
 * PushKit). Every native entry point is guarded so that in a JS-only context —
 * e.g. an OTA update landing on a build that predates this native module — the
 * whole thing quietly no-ops instead of throwing. The feature only truly
 * activates on a fresh native build that bundles the module.
 */

// Loaded lazily and defensively: requiring the JS wrapper is safe, but calling
// into it without the linked native module throws — hence `safe()` everywhere.
let CK: typeof import("expo-callkit-telecom") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  CK = require("expo-callkit-telecom");
} catch {
  CK = null;
}

type Sub = { remove: () => void };
const NOOP_SUB: Sub = { remove: () => {} };

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

export type IncomingCallInfo = {
  serverCallId: string;
  callType: "audio" | "video";
  channel?: string;
  callerId?: string;
  callerName?: string;
};

// Map the OS-assigned native call UUID -> our backend call info, populated when
// a call session is added, read when the user answers / ends from the OS UI.
const byNativeId = new Map<string, IncomingCallInfo>();

/** True only on a build where the native CallKit module is actually linked. */
export const callKitAvailable = !!CK && Platform.OS === "ios";

/** Register for VoIP push. Call once the user is authenticated. */
export function registerVoipPush(): void {
  if (!CK) return;
  safe(() => CK!.registerVoIPPush());
}

export function getVoipToken(): string | null {
  if (!CK) return null;
  return safe(() => CK!.getVoIPPushToken())?.token ?? null;
}

/** Fire `cb` with the current VoIP token and on every refresh. */
export function onVoipToken(cb: (token: string) => void): Sub {
  if (!CK) return NOOP_SUB;
  const current = getVoipToken();
  if (current) cb(current);
  return (
    safe(() =>
      CK!.addVoIPPushTokenUpdatedListener((e) => {
        if (e.token) cb(e.token);
      })
    ) ?? NOOP_SUB
  );
}

function infoFromSession(session: any): IncomingCallInfo | null {
  const ev = session?.incomingCallEvent;
  if (!ev) return null;
  const meta = (ev.metadata || {}) as Record<string, unknown>;
  return {
    serverCallId: ev.serverCallId,
    callType: ev.hasVideo ? "video" : "audio",
    channel: meta.channel as string | undefined,
    callerId: ev.caller?.id,
    callerName: ev.caller?.displayName,
  };
}

/** Track incoming sessions so native call ids resolve to our backend call ids. */
export function onIncomingReported(
  cb: (info: IncomingCallInfo & { nativeId: string }) => void
): Sub {
  if (!CK) return NOOP_SUB;
  return (
    safe(() =>
      CK!.addCallSessionAddedListener((e) => {
        const session = e.session;
        if (session.origin !== "incoming") return;
        const info = infoFromSession(session);
        if (!info) return;
        byNativeId.set(session.id, info);
        cb({ ...info, nativeId: session.id });
      })
    ) ?? NOOP_SUB
  );
}

/** The user answered from the native CallKit UI. */
export function onAnswered(
  cb: (info: IncomingCallInfo & { nativeId: string; requestId: string }) => void
): Sub {
  if (!CK) return NOOP_SUB;
  return (
    safe(() =>
      CK!.addCallAnsweredListener((e) => {
        let info = byNativeId.get(e.id);
        if (!info) {
          const active = safe(() => CK!.getActiveCallSession());
          info = active ? infoFromSession(active) ?? undefined : undefined;
        }
        if (!info) return;
        cb({ ...info, nativeId: e.id, requestId: e.requestId });
      })
    ) ?? NOOP_SUB
  );
}

/** The call ended/declined from the native UI (or the OS ended it). */
export function onEnded(cb: (info: { nativeId: string; serverCallId?: string }) => void): Sub {
  if (!CK) return NOOP_SUB;
  return (
    safe(() =>
      CK!.addCallEndedListener((e) => {
        const info = byNativeId.get(e.id);
        byNativeId.delete(e.id);
        cb({ nativeId: e.id, serverCallId: info?.serverCallId });
      })
    ) ?? NOOP_SUB
  );
}

/** Tell CallKit the answered call's media is connected (call becomes active). */
export function fulfillConnected(requestId: string): void {
  if (!CK) return;
  safe(() => CK!.fulfillIncomingCallConnected(requestId));
}

/** Tell CallKit the answer flow failed (CallKit then ends the call). */
export function failConnected(nativeId: string, requestId: string): void {
  if (!CK) return;
  safe(() => CK!.failIncomingCallConnected(nativeId, requestId));
}

/** Hang up the native call UI for a given native call id. */
export function endNativeCall(nativeId: string): void {
  if (!CK) return;
  safe(() => CK!.endCall(nativeId));
}

/** Find the live native call id for one of our backend call ids, if any. */
export function nativeIdForServerCall(serverCallId: string): string | null {
  for (const [nid, info] of byNativeId) {
    if (info.serverCallId === serverCallId) return nid;
  }
  return null;
}
