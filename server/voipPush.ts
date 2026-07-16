// Apple VoIP push sender (Phase 2 groundwork).
//
// VoIP pushes wake the app from a fully-terminated state so it can report an
// incoming call to CallKit — the "rings like a real phone even when closed"
// behaviour. This module signs an APNs JWT with the .p8 key and delivers the
// push over HTTP/2. It stays completely dormant until the APNS_* env vars are
// set, so importing/calling it is a no-op in the current build.
//
// Required env vars (add in Replit Secrets when wiring up the native layer):
//   APNS_KEY_P8      – contents of the AuthKey_XXXX.p8 file (PEM, may contain \n)
//   APNS_KEY_ID      – the key's 10-char Key ID (e.g. 562S242UPL)
//   APNS_TEAM_ID     – the Apple Developer Team ID (e.g. 9FPZ47Y5CK)
//   APNS_BUNDLE_ID   – app bundle id (defaults to com.gajocreative.fusion)
//   APNS_ENVIRONMENT – 'production' | 'sandbox' | 'both' (default 'production')
import http2 from "http2";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { pushTokens } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const BUNDLE_ID = process.env.APNS_BUNDLE_ID || "com.gajocreative.fusion";
const KEY_ID = process.env.APNS_KEY_ID;
const TEAM_ID = process.env.APNS_TEAM_ID;
// Env vars can't hold real newlines everywhere, so accept the escaped form too.
const KEY_P8 = process.env.APNS_KEY_P8?.replace(/\\n/g, "\n");

const APNS_HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
} as const;

export function isVoipConfigured(): boolean {
  return Boolean(KEY_ID && TEAM_ID && KEY_P8);
}

// Apple wants the auth JWT refreshed no more than every 20 min and no less than
// every 60 min. Cache it and regenerate after 40 min.
let cachedToken: { jwt: string; issuedAt: number } | null = null;

function getAuthToken(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now - cachedToken.issuedAt < 40 * 60) {
    return cachedToken.jwt;
  }
  const token = jwt.sign({ iss: TEAM_ID!, iat: now }, KEY_P8!, {
    algorithm: "ES256",
    header: { alg: "ES256", kid: KEY_ID! },
  });
  cachedToken = { jwt: token, issuedAt: now };
  return token;
}

interface VoipResult {
  success: boolean;
  status?: number;
  reason?: string;
}

function postToApns(
  host: string,
  deviceToken: string,
  payload: Record<string, unknown>
): Promise<VoipResult> {
  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", (err) => {
      resolve({ success: false, reason: err.message });
    });

    const body = JSON.stringify(payload);
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${getAuthToken()}`,
      "apns-topic": `${BUNDLE_ID}.voip`,
      "apns-push-type": "voip",
      "apns-priority": "10",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    });

    let status = 0;
    let responseBody = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"]) || 0;
    });
    req.setEncoding("utf8");
    req.on("data", (chunk) => (responseBody += chunk));
    req.on("end", () => {
      client.close();
      if (status === 200) {
        resolve({ success: true, status });
      } else {
        let reason = responseBody;
        try {
          reason = JSON.parse(responseBody).reason || responseBody;
        } catch {
          /* keep raw body */
        }
        resolve({ success: false, status, reason });
      }
    });
    req.on("error", (err) => {
      client.close();
      resolve({ success: false, reason: err.message });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Send a VoIP push to every registered VoIP token for a user. Safe to call
 * unconditionally — returns immediately if VoIP isn't configured or the user
 * has no VoIP tokens.
 */
export async function sendCallVoipPush(
  userId: string,
  payload: {
    callId: string;
    callerName: string;
    callType: "video" | "audio";
    channel: string;
    callerId: string;
  }
): Promise<void> {
  if (!isVoipConfigured()) return;

  const tokens = await db
    .select()
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.type, "voip"), eq(pushTokens.isActive, true)));

  if (tokens.length === 0) return;

  const envSetting = (process.env.APNS_ENVIRONMENT || "production").toLowerCase();

  await Promise.all(
    tokens.map(async (t) => {
      // Pick the host from the token's own environment, falling back to the
      // global setting. 'both' tries production then sandbox.
      const envs: Array<keyof typeof APNS_HOSTS> =
        envSetting === "both"
          ? ["production", "sandbox"]
          : [(t.environment === "sandbox" ? "sandbox" : envSetting) as keyof typeof APNS_HOSTS];

      for (const env of envs) {
        const result = await postToApns(APNS_HOSTS[env], t.token, {
          aps: {},
          ...payload,
        });
        if (result.success) {
          console.log(`[VoIP] Push delivered to user=${userId} env=${env}`);
          break;
        }
        console.error(
          `[VoIP] Push failed user=${userId} env=${env} status=${result.status} reason=${result.reason}`
        );
        // A bad token should be deactivated so we stop trying it.
        if (result.reason === "BadDeviceToken" || result.reason === "Unregistered") {
          await db.update(pushTokens).set({ isActive: false }).where(eq(pushTokens.id, t.id));
        }
      }
    })
  );
}
