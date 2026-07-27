import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { apiRequest } from "./api";

// Show call/chat notifications even when the app is foregrounded (the in-app
// call overlay still takes over for live calls; this is the safety net).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Actionable "Answer / Decline" buttons on incoming-call notifications. */
export async function setupCallNotificationCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync("incoming_call", [
      { identifier: "ANSWER", buttonTitle: "Answer", options: { opensAppToForeground: true } },
      {
        identifier: "DECLINE",
        buttonTitle: "Decline",
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
  } catch {
    // non-fatal
  }
}

/**
 * Ask for notification permission and register the device's push token with
 * our backend (which also forwards it to Sendbird). Returns true if a token
 * was registered.
 */
export async function registerPushToken(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted && existing.canAskAgain !== false) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return false;

  try {
    // Raw APNs token on iOS / FCM token on Android — what Sendbird + our APNs
    // sender expect (not the Expo push token).
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = typeof tokenData.data === "string" ? tokenData.data : String(tokenData.data);

    await apiRequest("POST", "/api/push/register", {
      token,
      type: Platform.OS === "ios" ? "apns" : "fcm",
      platform: Platform.OS,
      environment: "production",
    });
    return true;
  } catch {
    return false;
  }
}

/** Extract our call payload from a notification, tolerating nesting differences. */
export function extractCallData(raw: any): {
  type?: string;
  callId?: string;
  channel?: string;
  callerId?: string;
  callerName?: string;
  callType?: "audio" | "video";
} | null {
  if (!raw) return null;
  // Our payload may arrive at the top level or nested (e.g. Sendbird wraps it).
  const candidates = [raw, raw.data, raw.payload, raw.sendbird?.custom_type ? raw : null].filter(Boolean);
  for (const c of candidates) {
    let obj = c;
    if (typeof obj === "string") {
      try {
        obj = JSON.parse(obj);
      } catch {
        continue;
      }
    }
    if (obj && (obj.type === "rtc_call_invite" || obj.callId)) return obj;
  }
  return null;
}
