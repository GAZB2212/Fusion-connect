import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import SendbirdChat from "@sendbird/chat";
import { GroupChannelModule } from "@sendbird/chat/groupChannel";
import type { SendbirdGroupChat } from "@sendbird/chat/groupChannel";
import { apiRequest } from "./api";
import { useAuth } from "./auth";

// Public Sendbird application id (safe to embed in the client).
export const SENDBIRD_APP_ID = "A68E730B-8E56-4655-BCBD-A709F3162376";

let sbInstance: SendbirdGroupChat | null = null;

/** Lazily create the singleton Sendbird SDK instance (Group Channel module). */
export function getSendbird(): SendbirdGroupChat {
  if (!sbInstance) {
    sbInstance = SendbirdChat.init({
      appId: SENDBIRD_APP_ID,
      modules: [new GroupChannelModule()],
      // Disable local cache so we don't need async-storage/mmkv wiring on device.
      localCacheEnabled: false,
    }) as SendbirdGroupChat;
  }
  return sbInstance;
}

let connectPromise: Promise<SendbirdGroupChat> | null = null;

/**
 * Connect to Sendbird using a short-lived session token minted by our backend.
 * De-duped: concurrent callers share one in-flight connect.
 */
export function connectSendbird(): Promise<SendbirdGroupChat> {
  const sb = getSendbird();
  if (sb.currentUser) return Promise.resolve(sb);
  if (!connectPromise) {
    connectPromise = (async () => {
      const { token, userId } = await apiRequest<{ token: string; userId: string }>(
        "GET",
        "/api/sendbird/token"
      );
      await sb.connect(userId, token);
      return sb;
    })().catch((e) => {
      connectPromise = null;
      throw e;
    });
  }
  return connectPromise;
}

export async function disconnectSendbird(): Promise<void> {
  connectPromise = null;
  if (sbInstance && sbInstance.currentUser) {
    try {
      await sbInstance.disconnect();
    } catch {
      // ignore
    }
  }
}

type SendbirdContextValue = {
  sb: SendbirdGroupChat | null;
  ready: boolean;
  error: string | null;
  reconnect: () => void;
};

const SendbirdContext = createContext<SendbirdContextValue>({
  sb: null,
  ready: false,
  error: null,
  reconnect: () => {},
});

/** Connects to Sendbird once the user is authenticated; exposes readiness. */
export function SendbirdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastUser = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setReady(false);
      setError(null);
      if (lastUser.current) {
        lastUser.current = null;
        disconnectSendbird();
      }
      return;
    }

    lastUser.current = user.id;
    setError(null);
    connectSendbird()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || "Couldn't connect to chat");
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, attempt]);

  return (
    <SendbirdContext.Provider
      value={{
        sb: ready ? getSendbird() : null,
        ready,
        error,
        reconnect: () => setAttempt((a) => a + 1),
      }}
    >
      {children}
    </SendbirdContext.Provider>
  );
}

export const useSendbird = () => useContext(SendbirdContext);
