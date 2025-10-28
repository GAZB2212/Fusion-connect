import * as webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions, users, profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Initialize web-push with VAPID keys
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn('Missing VAPID keys - push notifications will not work');
} else {
  webpush.setVapidDetails(
    'mailto:support@fusionapp.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  url?: string;
  callId?: string;
  matchId?: string;
  userId?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
}

export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  try {
    // Get all push subscriptions for this user
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return { success: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              auth: subscription.auth,
              p256dh: subscription.p256dh
            }
          };

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload)
          );

          console.log(`Push notification sent to user ${userId}`);
          return { success: true };
        } catch (error: any) {
          console.error(`Failed to send push notification:`, error);

          // Remove invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Removing invalid subscription for user ${userId}`);
            await db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, subscription.id));
          }

          return { success: false };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    return { success: successful, failed };
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return { success: 0, failed: 0 };
  }
}

export async function sendVideoCallNotification(
  receiverId: string,
  callerId: string,
  matchId: string,
  callId: string
): Promise<void> {
  try {
    // Get caller's profile for notification
    const [callerProfile] = await db
      .select({
        displayName: profiles.displayName,
        mainPhoto: profiles.photos
      })
      .from(profiles)
      .where(eq(profiles.userId, callerId))
      .limit(1);

    const callerName = callerProfile?.displayName || 'Someone';
    const callerPhoto = callerProfile?.mainPhoto?.[0];

    await sendPushNotification(receiverId, {
      title: `${callerName} is calling`,
      body: 'Tap to join the video call',
      icon: callerPhoto || '/icon-192.png',
      url: `/messages/${matchId}`,
      callId,
      matchId,
      userId: callerId,
      tag: `video-call-${callId}`,
      requireInteraction: true,
      actions: [
        { action: 'view', title: 'Join Call' },
        { action: 'close', title: 'Dismiss' }
      ]
    });
  } catch (error) {
    console.error('Error sending video call notification:', error);
  }
}
