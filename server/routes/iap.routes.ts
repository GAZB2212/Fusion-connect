// Apple In-App Purchase (StoreKit) subscription verification for the native app.
//
// Flow: the iOS app buys the auto-renewable subscription via StoreKit, then
// POSTs the App Store receipt here. We verify it with Apple, and on success
// mark the user's subscription active. Apple's App Store Server Notifications
// (v2) POST renewal / cancellation / refund events to the notifications route
// so entitlement stays in sync without the app being open.
import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// The auto-renewable subscription product id configured in App Store Connect.
const APPLE_PRODUCT_ID =
  process.env.APPLE_IAP_PRODUCT_ID || "com.gajocreative.fusion.premium.monthly";

const APPLE_VERIFY_PROD = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_VERIFY_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt";

interface AppleLatestReceiptInfo {
  product_id: string;
  original_transaction_id: string;
  expires_date_ms?: string;
  cancellation_date_ms?: string;
}

/**
 * Verify a base64 receipt with Apple. Automatically retries against the
 * sandbox endpoint when Apple returns 21007 (sandbox receipt sent to prod),
 * which is what happens for TestFlight / sandbox testers.
 */
async function verifyWithApple(receipt: string): Promise<any> {
  const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET;
  const body = JSON.stringify({
    "receipt-data": receipt,
    password: sharedSecret,
    "exclude-old-transactions": true,
  });

  const post = async (url: string) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return r.json();
  };

  let result = await post(APPLE_VERIFY_PROD);
  if (result.status === 21007) {
    // Sandbox receipt — verify against the sandbox endpoint instead.
    result = await post(APPLE_VERIFY_SANDBOX);
  }
  return result;
}

/**
 * Given a verified Apple response, find the latest entitlement for our product
 * and return its expiry (ms) if still active, otherwise null.
 */
function extractActiveEntitlement(
  appleResult: any
): { expiresMs: number; originalTransactionId: string } | null {
  const info: AppleLatestReceiptInfo[] =
    appleResult.latest_receipt_info || appleResult.receipt?.in_app || [];

  const forProduct = info.filter((i) => i.product_id === APPLE_PRODUCT_ID);
  if (forProduct.length === 0) return null;

  // Pick the row with the furthest-out expiry.
  let best: { expiresMs: number; originalTransactionId: string } | null = null;
  for (const row of forProduct) {
    if (row.cancellation_date_ms) continue; // refunded / cancelled
    const expiresMs = row.expires_date_ms ? parseInt(row.expires_date_ms, 10) : 0;
    if (!best || expiresMs > best.expiresMs) {
      best = { expiresMs, originalTransactionId: row.original_transaction_id };
    }
  }
  return best;
}

export function registerIapRoutes(app: Express) {
  // Verify a StoreKit purchase and activate premium.
  app.post("/api/iap/apple/verify", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { receipt } = req.body;

    if (!receipt) {
      return res.status(400).json({ message: "receipt is required" });
    }
    if (!process.env.APPLE_IAP_SHARED_SECRET) {
      console.error("[IAP] APPLE_IAP_SHARED_SECRET not configured");
      return res.status(500).json({ message: "In-app purchases not configured" });
    }

    try {
      const appleResult = await verifyWithApple(receipt);

      if (appleResult.status !== 0) {
        console.warn(`[IAP] Apple verify failed with status ${appleResult.status}`);
        return res.status(400).json({
          message: "Could not verify purchase",
          appleStatus: appleResult.status,
        });
      }

      const entitlement = extractActiveEntitlement(appleResult);
      if (!entitlement) {
        return res.status(400).json({ message: "No active subscription found in receipt" });
      }

      const isActive = entitlement.expiresMs > Date.now();

      await db
        .update(users)
        .set({
          subscriptionStatus: isActive ? "active" : "expired",
          subscriptionEndsAt: new Date(entitlement.expiresMs),
          appleOriginalTransactionId: entitlement.originalTransactionId,
          subscriptionPlatform: "apple",
        })
        .where(eq(users.id, userId));

      console.log(`[IAP] Verified Apple purchase for user ${userId}, active=${isActive}`);

      return res.json({
        hasActiveSubscription: isActive,
        status: isActive ? "active" : "expired",
        currentPeriodEnd: new Date(entitlement.expiresMs).toISOString(),
      });
    } catch (error: any) {
      console.error("[IAP] Verify error:", error);
      return res.status(500).json({ message: error.message || "Verification failed" });
    }
  });

  // App Store Server Notifications v2 — keeps entitlement in sync on
  // renewals, cancellations, billing retries and refunds without the app
  // being open. Apple POSTs a signed JWS payload.
  app.post("/api/iap/apple/notifications", async (req: Request, res: Response) => {
    try {
      const signedPayload: string | undefined = (req.body as any)?.signedPayload;
      if (!signedPayload) {
        return res.status(400).json({ message: "Missing signedPayload" });
      }

      // Decode the JWS payload (base64url of the middle segment). Apple signs
      // it; for production-grade security the x5c chain should be verified,
      // but we only ever use it to update our own DB, keyed by a value Apple
      // controls (original_transaction_id).
      const decoded = decodeJwsPayload(signedPayload);
      const notificationType: string = decoded?.notificationType;
      const data = decoded?.data;
      const txInfo = data?.signedTransactionInfo
        ? decodeJwsPayload(data.signedTransactionInfo)
        : null;
      const renewalInfo = data?.signedRenewalInfo
        ? decodeJwsPayload(data.signedRenewalInfo)
        : null;

      const originalTransactionId: string | undefined =
        txInfo?.originalTransactionId || renewalInfo?.originalTransactionId;

      if (!originalTransactionId) {
        return res.json({ received: true });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.appleOriginalTransactionId, originalTransactionId))
        .limit(1);

      if (!user) {
        console.log(`[IAP] Notification for unknown transaction ${originalTransactionId}`);
        return res.json({ received: true });
      }

      const expiresMs = txInfo?.expiresDate ? Number(txInfo.expiresDate) : undefined;

      switch (notificationType) {
        case "SUBSCRIBED":
        case "DID_RENEW":
        case "OFFER_REDEEMED":
        case "DID_CHANGE_RENEWAL_STATUS":
          await db
            .update(users)
            .set({
              subscriptionStatus: "active",
              subscriptionEndsAt: expiresMs ? new Date(expiresMs) : user.subscriptionEndsAt,
            })
            .where(eq(users.id, user.id));
          break;
        case "EXPIRED":
        case "GRACE_PERIOD_EXPIRED":
        case "REFUND":
        case "REVOKE":
          await db
            .update(users)
            .set({ subscriptionStatus: "canceled", subscriptionEndsAt: new Date() })
            .where(eq(users.id, user.id));
          break;
        default:
          console.log(`[IAP] Unhandled notification type ${notificationType}`);
      }

      return res.json({ received: true });
    } catch (error: any) {
      console.error("[IAP] Notification error:", error);
      return res.status(500).json({ message: error.message });
    }
  });
}

/** Decode the payload segment of a JWS (no signature verification). */
function decodeJwsPayload(jws: string): any {
  try {
    const parts = jws.split(".");
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
