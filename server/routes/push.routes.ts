// Push notification subscriptions and tokens
import type { Express, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { SendbirdService } from "../sendbird";
import { pushSubscriptions, pushTokens, insertPushSubscriptionSchema, insertPushTokenSchema } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";

export function registerPushRoutes(app: Express) {
  // Push notification endpoints
  app.post("/api/push/subscribe", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const validatedData = insertPushSubscriptionSchema.parse({
        userId,
        ...req.body
      });

      // Check if subscription already exists
      const [existing] = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.endpoint, validatedData.endpoint)
          )
        )
        .limit(1);

      if (existing) {
        return res.json({ message: "Subscription already exists", subscription: existing });
      }

      // Create new subscription
      const [subscription] = await db
        .insert(pushSubscriptions)
        .values(validatedData)
        .returning();

      res.json({ message: "Push subscription created", subscription });
    } catch (error: any) {
      console.error('Error saving push subscription:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/push/unsubscribe", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      // Delete all subscriptions for this user
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));

      res.json({ message: "Push subscriptions removed" });
    } catch (error: any) {
      console.error('Error removing push subscription:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Unified Push Token Registration (supports web, FCM, and APNs)
  app.post("/api/push/register", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const validatedData = insertPushTokenSchema.parse({
        userId,
        ...req.body
      });

      // Determine platform from type if not provided (voip is iOS-only)
      const platform = validatedData.platform ||
        (validatedData.type === 'apns' || validatedData.type === 'voip' ? 'ios' :
         validatedData.type === 'fcm' ? 'android' : 'web');
      
      // Default environment to production (TestFlight uses production APNs)
      const environment = validatedData.environment || 'production';

      console.log(`[Push] Registering token for user=${userId} platform=${platform} type=${validatedData.type} env=${environment}`);

      // For web push, use endpoint as the unique identifier
      // For native push, use the token itself
      const tokenIdentifier = validatedData.type === 'web' 
        ? validatedData.endpoint 
        : validatedData.token;

      if (!tokenIdentifier) {
        return res.status(400).json({ message: "Token or endpoint required" });
      }

      // Check if this exact token already exists (globally, not just for this user)
      const [existingToken] = await db
        .select()
        .from(pushTokens)
        .where(eq(pushTokens.token, validatedData.token))
        .limit(1);

      if (existingToken) {
        // Token exists - update it (may belong to different user if device was reassigned)
        await db
          .update(pushTokens)
          .set({ 
            userId, // Update to current user
            isActive: true, 
            updatedAt: new Date(),
            platform,
            environment,
            endpoint: validatedData.endpoint || existingToken.endpoint,
            auth: validatedData.auth || existingToken.auth,
            p256dh: validatedData.p256dh || existingToken.p256dh,
          })
          .where(eq(pushTokens.id, existingToken.id));
        
        console.log(`[Push] Updated existing token for user=${userId}`);
        
        // Re-register with Sendbird in case it was removed
        if (validatedData.type === 'apns') {
          try {
            await SendbirdService.registerApnsPushToken(userId, validatedData.token);
            console.log(`[Push] Re-registered iOS APNs token with Sendbird for user=${userId}`);
          } catch (e) {
            console.error('[Push] Failed to re-register APNs with Sendbird:', e);
          }
        } else if (validatedData.type === 'fcm') {
          try {
            await SendbirdService.registerFcmPushToken(userId, validatedData.token);
            console.log(`[Push] Re-registered Android FCM token with Sendbird for user=${userId}`);
          } catch (e) {
            console.error('[Push] Failed to re-register FCM with Sendbird:', e);
          }
        }
        
        return res.json({ message: "Push token updated" });
      }

      // For iOS APNs: remove old tokens for this user to avoid BadDeviceToken errors
      if (validatedData.type === 'apns') {
        const oldIosTokens = await db
          .select()
          .from(pushTokens)
          .where(
            and(
              eq(pushTokens.userId, userId),
              eq(pushTokens.type, 'apns'),
              eq(pushTokens.environment, environment)
            )
          );
        
        // Unregister old tokens from Sendbird first
        for (const oldToken of oldIosTokens) {
          try {
            await SendbirdService.unregisterApnsPushToken(userId, oldToken.token);
            console.log(`[Push] Unregistered old APNs token from Sendbird: ${oldToken.token.substring(0, 10)}...`);
          } catch (e) {
            // Ignore errors - token may already be invalid
          }
        }
        
        // Delete old tokens from our database
        if (oldIosTokens.length > 0) {
          await db
            .delete(pushTokens)
            .where(
              and(
                eq(pushTokens.userId, userId),
                eq(pushTokens.type, 'apns'),
                eq(pushTokens.environment, environment)
              )
            );
          console.log(`[Push] Removed ${oldIosTokens.length} old iOS tokens for user=${userId} env=${environment}`);
        }
      }

      // Create new token registration
      await db.insert(pushTokens).values({
        userId,
        type: validatedData.type,
        token: validatedData.token,
        endpoint: validatedData.endpoint,
        auth: validatedData.auth,
        p256dh: validatedData.p256dh,
        deviceId: validatedData.deviceId,
        platform,
        environment,
        isActive: true,
      });
      
      console.log(`[Push] Created new token registration for user=${userId} platform=${platform}`);

      // Also register native push tokens with Sendbird for chat notifications
      if (validatedData.type === 'apns') {
        try {
          await SendbirdService.registerApnsPushToken(userId, validatedData.token);
          console.log(`[Push] Registered iOS APNs token with Sendbird for user=${userId}`);
        } catch (sendbirdError) {
          console.error('[Push] Failed to register APNs token with Sendbird:', sendbirdError);
        }
      } else if (validatedData.type === 'fcm') {
        try {
          await SendbirdService.registerFcmPushToken(userId, validatedData.token);
          console.log(`[Push] Registered Android FCM token with Sendbird for user=${userId}`);
        } catch (sendbirdError) {
          console.error('[Push] Failed to register FCM token with Sendbird:', sendbirdError);
        }
      }

      res.json({ message: "Push token registered" });
    } catch (error: any) {
      console.error('Error registering push token:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Unregister push token
  app.post("/api/push/unregister", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { token, deviceId } = req.body;

    try {
      // If specific token provided, deactivate just that one
      if (token) {
        await db
          .update(pushTokens)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(pushTokens.userId, userId),
              eq(pushTokens.token, token)
            )
          );
      } else if (deviceId) {
        // Deactivate by device ID
        await db
          .update(pushTokens)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(pushTokens.userId, userId),
              eq(pushTokens.deviceId, deviceId)
            )
          );
      } else {
        // Deactivate all tokens for this user
        await db
          .update(pushTokens)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(pushTokens.userId, userId));
      }

      res.json({ message: "Push token unregistered" });
    } catch (error: any) {
      console.error('Error unregistering push token:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get unread message count for badge updates
  app.get("/api/push/unread-count", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    
    try {
      const unreadCount = await SendbirdService.getUnreadMessageCount(userId);
      res.json({ unreadCount });
    } catch (error: any) {
      console.error('Error getting unread count:', error);
      res.json({ unreadCount: 0 });
    }
  });
}
