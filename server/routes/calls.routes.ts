// Agora video/audio calls and call sessions
import type { Express, Response } from "express";
import { isAuthenticated } from "../auth";
import { broadcastToUser } from "../websocket";
import { db } from "../db";
import { SendbirdService } from "../sendbird";
import { randomBytes } from "crypto";
import {
  users,
  profiles,
  matches,
  videoCalls,
  pushTokens,
  blockedUsers,
  callSessions,
} from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { sendVideoCallNotification } from "../pushNotifications";
import { sendCallVoipPush, sendCallAlertPush } from "../voipPush";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { RtcTokenBuilder, RtcRole } = require("agora-token");

// How long an unanswered call rings before it's marked missed
const RING_TIMEOUT_MS = 30_000;

/**
 * Find the Sendbird channel (== match id) shared by two users, if any.
 * Call signals are delivered over this channel because Sendbird's realtime
 * transport is reliable in production where our raw /ws upgrade may be dropped.
 */
async function findMatchChannel(userA: string, userB: string): Promise<string | null> {
  const [match] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      or(
        and(eq(matches.user1Id, userA), eq(matches.user2Id, userB)),
        and(eq(matches.user1Id, userB), eq(matches.user2Id, userA))
      )
    )
    .limit(1);
  return match?.id ?? null;
}

/**
 * Deliver a call signal to `to` over BOTH transports:
 *  1. Sendbird channel message (primary — reliable realtime in production)
 *  2. our /ws WebSocket (secondary — instant when it connects)
 * The client de-dupes by callId, so receiving on both is harmless.
 */
async function emitCallSignal(
  channelUrl: string | null,
  signal: string,
  to: string,
  wsType: string,
  data: Record<string, any>
) {
  broadcastToUser(to, { type: wsType, data });
  if (channelUrl) {
    SendbirdService.sendCallSignal(channelUrl, signal, to, data).catch((err) =>
      console.error(`[Call] Sendbird signal '${signal}' failed:`, err)
    );
  }
}

/**
 * After the ring window, if the call is still 'ringing' (nobody accepted or
 * declined), mark it missed, stop the ring on both ends via WebSocket, and
 * post a "Missed call" note into the pair's chat.
 */
function scheduleRingTimeout(callId: string, callerUserId: string, calleeUserId: string) {
  setTimeout(async () => {
    try {
      const [call] = await db
        .select()
        .from(callSessions)
        .where(eq(callSessions.callId, callId))
        .limit(1);

      if (!call || call.status !== 'ringing') {
        return; // Already accepted, declined, or ended — nothing to do
      }

      await db
        .update(callSessions)
        .set({ status: 'missed', endedAt: new Date() })
        .where(eq(callSessions.callId, callId));

      // Stop the ringing UI on both devices (Sendbird primary + /ws secondary)
      const timeoutChannel = await findMatchChannel(callerUserId, calleeUserId);
      await emitCallSignal(timeoutChannel, 'call_cancelled', calleeUserId, 'call_cancelled', {
        callId,
        reason: 'missed',
      });
      await emitCallSignal(timeoutChannel, 'call_missed', callerUserId, 'call_missed', { callId });

      // Leave a note in the chat, if these two users have a match/channel
      if (timeoutChannel) {
        SendbirdService.sendSystemMessage(timeoutChannel, '📞 Missed call').catch(err => {
          console.error('[Call] Failed to post missed-call note:', err);
        });
      }

      console.log(`[Call] Call ${callId} timed out — marked missed`);
    } catch (err) {
      console.error('[Call] Ring timeout handler error:', err);
    }
  }, RING_TIMEOUT_MS);
}

export function registerCallRoutes(app: Express) {
  // Video Call endpoints
  app.post("/api/video-call/initiate", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { matchId, receiverId } = req.body;

    try {
      // Verify match exists and user is part of it
      const [match] = await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.id, matchId),
            or(eq(matches.user1Id, userId), eq(matches.user2Id, userId))
          )
        )
        .limit(1);

      if (!match) {
        return res.status(403).json({ message: "Not authorized to initiate call for this match" });
      }

      // Generate unique channel name
      const channelName = `call_${matchId}_${Date.now()}`;

      // Create video call record
      const [videoCall] = await db
        .insert(videoCalls)
        .values({
          matchId,
          callerId: userId,
          receiverId,
          channelName,
          status: 'initiated',
        })
        .returning();

      // Send push notification to receiver
      sendVideoCallNotification(receiverId, userId, matchId, videoCall.id).catch(error => {
        console.error('Failed to send video call push notification:', error);
      });

      // Broadcast incoming call to receiver via WebSocket
      broadcastToUser(receiverId, {
        type: 'incoming_call',
        data: videoCall,
      });

      // Send video call notification to Sendbird chat timeline
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      SendbirdService.sendSystemMessage(matchId, `📹 Video call started • ${timeStr}`).catch(err => {
        console.error('[Sendbird] Failed to send video call message:', err);
      });

      res.json(videoCall);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/video-call/incoming/:matchId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { matchId } = req.params;

    try {
      // Check for active or initiated calls where user is the receiver
      const [call] = await db
        .select()
        .from(videoCalls)
        .where(
          and(
            eq(videoCalls.matchId, matchId),
            eq(videoCalls.receiverId, userId),
            or(
              eq(videoCalls.status, 'initiated'),
              eq(videoCalls.status, 'active')
            )
          )
        )
        .orderBy(desc(videoCalls.createdAt))
        .limit(1);

      console.log('Incoming call check:', {
        userId,
        matchId,
        foundCall: call ? {
          id: call.id,
          callerId: call.callerId,
          receiverId: call.receiverId,
          status: call.status,
        } : null
      });

      if (!call) {
        return res.json(null);
      }

      res.json(call);
    } catch (error: any) {
      console.error('Error checking for incoming call:', error);
      res.status(500).json({ message: "Failed to check for incoming call" });
    }
  });

  app.get("/api/video-call/:callId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { callId } = req.params;

    try {
      // Get call details
      const [call] = await db
        .select()
        .from(videoCalls)
        .where(eq(videoCalls.id, callId))
        .limit(1);

      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      // Verify user is part of this call
      if (call.callerId !== userId && call.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized to access this call" });
      }

      res.json(call);
    } catch (error: any) {
      console.error('Error fetching call:', error);
      res.status(500).json({ message: "Failed to fetch call" });
    }
  });

  app.get("/api/video-call/token/:callId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { callId } = req.params;

    try {
      // Get call details
      const [call] = await db
        .select()
        .from(videoCalls)
        .where(eq(videoCalls.id, callId))
        .limit(1);

      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      // Verify user is part of this call
      if (call.callerId !== userId && call.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized to access this call" });
      }

      const appId = process.env.VITE_AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;
      const channelName = call.channelName;
      const uid = 0; // Use 0 for wildcard UID
      const role = RtcRole.PUBLISHER; // Both users can publish
      
      // Token expires in 1 hour
      const expirationTimeInSeconds = 3600;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const tokenExpireTime = currentTimestamp + expirationTimeInSeconds;
      const privilegeExpireTime = currentTimestamp + expirationTimeInSeconds;

      // Generate token
      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        role,
        tokenExpireTime,
        privilegeExpireTime
      );

      res.json({
        token,
        channelName,
        appId,
        uid,
        expiresAt: privilegeExpireTime,
      });
    } catch (error: any) {
      console.error('Token generation error:', error);
      res.status(500).json({ message: "Failed to generate token" });
    }
  });

  app.patch("/api/video-call/:callId/status", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { callId } = req.params;
    const { status } = req.body;

    try {
      // Get call details
      const [call] = await db
        .select()
        .from(videoCalls)
        .where(eq(videoCalls.id, callId))
        .limit(1);

      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }

      // Verify user is part of this call
      if (call.callerId !== userId && call.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this call" });
      }

      const updateData: any = { status };

      // Update timestamps based on status
      if (status === 'active' && !call.startedAt) {
        updateData.startedAt = new Date();
      } else if (status === 'ended' && call.startedAt) {
        updateData.endedAt = new Date();
        // Calculate duration in seconds
        const duration = Math.floor((new Date().getTime() - new Date(call.startedAt).getTime()) / 1000);
        updateData.duration = duration;
      }

      const [updatedCall] = await db
        .update(videoCalls)
        .set(updateData)
        .where(eq(videoCalls.id, callId))
        .returning();

      // Broadcast call status update to both parties via WebSocket
      const otherUserId = call.callerId === userId ? call.receiverId : call.callerId;
      broadcastToUser(otherUserId, {
        type: 'call_status_update',
        data: updatedCall,
      });

      // Send call end notification to Sendbird chat timeline
      const endTime = new Date();
      const endTimeStr = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      
      if (status === 'ended' && updateData.duration) {
        const minutes = Math.floor(updateData.duration / 60);
        const seconds = updateData.duration % 60;
        const durationText = minutes > 0 
          ? `${minutes}m ${seconds}s` 
          : `${seconds}s`;
        SendbirdService.sendSystemMessage(call.matchId, `📹 Video call ended (${durationText}) • ${endTimeStr}`).catch(err => {
          console.error('[Sendbird] Failed to send call end message:', err);
        });
      } else if (status === 'declined' || status === 'missed') {
        const statusText = status === 'declined' ? 'Call declined' : 'Missed call';
        SendbirdService.sendSystemMessage(call.matchId, `📹 ${statusText} • ${endTimeStr}`).catch(err => {
          console.error('[Sendbird] Failed to send call status message:', err);
        });
      }

      res.json(updatedCall);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/video-call/history/:matchId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { matchId } = req.params;

    try {
      // Verify user is part of this match
      const [match] = await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.id, matchId),
            or(eq(matches.user1Id, userId), eq(matches.user2Id, userId))
          )
        )
        .limit(1);

      if (!match) {
        return res.status(403).json({ message: "Not authorized to view call history for this match" });
      }

      const callHistory = await db
        .select()
        .from(videoCalls)
        .where(eq(videoCalls.matchId, matchId))
        .orderBy(desc(videoCalls.createdAt));

      res.json(callHistory);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ============================================
  // CALL ENDPOINTS (Agora RTC)
  // ============================================
  
  // Rate limiting for call invites (simple in-memory)
  const callInviteRateLimits = new Map<string, { count: number; resetAt: number }>();
  const CALL_RATE_LIMIT = 15; // Max 15 calls per minute
  const CALL_RATE_WINDOW = 60000; // 1 minute

  // POST /api/call/invite - Send call invitation to another user
  app.post("/api/call/invite", isAuthenticated, async (req: any, res: Response) => {
    const callerUserId = req.user.id;
    const { calleeUserId, callType } = req.body;

    try {
      // Validate input
      if (!calleeUserId || !callType) {
        return res.status(400).json({ message: "calleeUserId and callType are required" });
      }
      if (!['video', 'audio'].includes(callType)) {
        return res.status(400).json({ message: "callType must be 'video' or 'audio'" });
      }
      if (callerUserId === calleeUserId) {
        return res.status(400).json({ message: "Cannot call yourself" });
      }

      // Rate limiting
      const now = Date.now();
      const rateLimit = callInviteRateLimits.get(callerUserId);
      if (rateLimit && now < rateLimit.resetAt) {
        if (rateLimit.count >= CALL_RATE_LIMIT) {
          return res.status(429).json({ message: "Too many call invites. Please wait a minute." });
        }
        rateLimit.count++;
      } else {
        callInviteRateLimits.set(callerUserId, { count: 1, resetAt: now + CALL_RATE_WINDOW });
      }

      // Check if callee exists and is not blocked
      const [callee] = await db.select().from(users).where(eq(users.id, calleeUserId)).limit(1);
      if (!callee) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if blocked
      const [blocked] = await db.select().from(blockedUsers).where(
        or(
          and(eq(blockedUsers.blockerId, callerUserId), eq(blockedUsers.blockedId, calleeUserId)),
          and(eq(blockedUsers.blockerId, calleeUserId), eq(blockedUsers.blockedId, callerUserId))
        )
      ).limit(1);
      if (blocked) {
        return res.status(403).json({ message: "Cannot call this user" });
      }

      // Generate call ID and channel name
      const callId = randomBytes(12).toString('hex');
      const channelName = `fusion_${callId}`;

      console.log(`[Call] Creating call invite: callId=${callId} channel=${channelName} caller=${callerUserId} callee=${calleeUserId} type=${callType}`);

      // Create call session
      await db.insert(callSessions).values({
        callId,
        channelName,
        callerUserId,
        calleeUserId,
        callType,
        status: 'ringing',
      });

      // Get caller profile for notification
      const [callerProfile] = await db.select().from(profiles).where(eq(profiles.userId, callerUserId)).limit(1);
      const callerName = callerProfile?.displayName || 'Someone';

      // Get callee's push tokens
      const calleeTokens = await db
        .select()
        .from(pushTokens)
        .where(
          and(
            eq(pushTokens.userId, calleeUserId),
            eq(pushTokens.isActive, true)
          )
        );

      console.log(`[Call] Found ${calleeTokens.length} push tokens for callee=${calleeUserId}`);

      // Prepare push notification data
      const pushData = {
        type: 'rtc_call_invite',
        callId,
        channel: channelName,
        callerId: callerUserId,
        callerName,
        callType,
      };
      const pushTitle = 'Incoming call';
      const pushBody = `${callerName} is calling you`;

      // Send push notifications
      let iosPushSent = 0;
      let androidPushSent = 0;

      for (const token of calleeTokens) {
        try {
          if (token.type === 'apns') {
            // iOS: Send via Sendbird (since APNs is already working via Sendbird)
            await SendbirdService.sendPushToUser(calleeUserId, pushTitle, pushBody, pushData);
            iosPushSent++;
            console.log(`[Call] Sent iOS push via Sendbird to user=${calleeUserId}`);
          } else if (token.type === 'fcm') {
            // Android: Send via FCM (requires Firebase Admin SDK)
            // For now, also try sending via Sendbird as fallback
            await SendbirdService.sendPushToUser(calleeUserId, pushTitle, pushBody, pushData);
            androidPushSent++;
            console.log(`[Call] Sent Android push via Sendbird to user=${calleeUserId}`);
          }
        } catch (pushError) {
          console.error(`[Call] Failed to send push to token type=${token.type}:`, pushError);
        }
      }

      console.log(`[Call] Push summary: iOS=${iosPushSent} Android=${androidPushSent}`);

      // Ring the callee over the Sendbird channel — the same transport that
      // reliably delivers chat + push. Sent as a real message so an offline /
      // closed phone gets a home-screen "Incoming call" push; online members
      // receive it in-app instantly. /ws is a best-effort instant secondary.
      const signalChannel = await findMatchChannel(callerUserId, calleeUserId);
      broadcastToUser(calleeUserId, { type: 'incoming_call', data: pushData });
      if (signalChannel) {
        const verb = callType === 'video' ? 'is video calling you' : 'is calling you';
        await SendbirdService.sendCallRing(
          signalChannel,
          callerUserId,
          calleeUserId,
          pushData,
          `📞 ${callerName} ${verb}`
        );
      }

      // VoIP push (Phase 2): wakes a fully-closed app to show the native
      // CallKit incoming-call screen. No-op until APNS_* env vars are set.
      const voipPayload = {
        callId,
        callerName,
        callType,
        channel: channelName,
        callerId: callerUserId,
      };
      sendCallVoipPush(calleeUserId, voipPayload).catch(err => console.error('[Call] VoIP push failed:', err));
      // Visible "Incoming call" alert (rings + Answer/Decline) for backgrounded apps.
      sendCallAlertPush(calleeUserId, voipPayload).catch(err => console.error('[Call] Alert push failed:', err));

      // Ring timeout: if nobody answers within the window, mark the call
      // missed, stop the ring on both ends, and leave a note in the chat.
      scheduleRingTimeout(callId, callerUserId, calleeUserId);

      res.json({
        callId,
        channel: channelName,
        callType,
        calleeUserId,
      });
    } catch (error: any) {
      console.error('[Call] Error creating call invite:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/call/accept - Accept an incoming call
  app.post("/api/call/accept", isAuthenticated, async (req: any, res: Response) => {
    const calleeUserId = req.user.id;
    const { callId } = req.body;

    try {
      if (!callId) {
        return res.status(400).json({ message: "callId is required" });
      }

      // Find the call session
      const [callSession] = await db
        .select()
        .from(callSessions)
        .where(
          and(
            eq(callSessions.callId, callId),
            eq(callSessions.calleeUserId, calleeUserId)
          )
        )
        .limit(1);

      if (!callSession) {
        return res.status(404).json({ message: "Call not found" });
      }

      if (callSession.status !== 'ringing') {
        return res.status(400).json({ message: `Call is already ${callSession.status}` });
      }

      console.log(`[Call] Accepting call: callId=${callId} callee=${calleeUserId}`);

      // Update call status to accepted
      await db
        .update(callSessions)
        .set({ status: 'accepted', startedAt: new Date() })
        .where(eq(callSessions.callId, callId));

      // Generate Agora RTC token for the callee
      const agoraAppId = process.env.AGORA_APP_ID || process.env.VITE_AGORA_APP_ID;
      const agoraCertificate = process.env.AGORA_APP_CERTIFICATE;

      if (!agoraAppId || !agoraCertificate) {
        const missing = [
          !agoraAppId ? "AGORA_APP_ID" : null,
          !agoraCertificate ? "AGORA_APP_CERTIFICATE" : null,
        ].filter(Boolean).join(", ");
        console.error(`[Call] Agora credentials not configured — missing: ${missing}`);
        return res.status(500).json({ message: `Video calling not configured (missing: ${missing})` });
      }

      const uid = Math.floor(Math.random() * 100000);
      const expirationTimeInSeconds = 3600; // 1 hour
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const rtcToken = RtcTokenBuilder.buildTokenWithUid(
        agoraAppId,
        agoraCertificate,
        callSession.channelName,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs
      );

      console.log(`[Call] Generated RTC token for callee=${calleeUserId} channel=${callSession.channelName} uid=${uid}`);

      // Notify caller that call was accepted (Sendbird primary + /ws secondary)
      const acceptChannel = await findMatchChannel(callSession.callerUserId, calleeUserId);
      await emitCallSignal(acceptChannel, 'call_accepted', callSession.callerUserId, 'call_accepted', {
        callId,
        channel: callSession.channelName,
        calleeUserId,
      });

      res.json({
        channel: callSession.channelName,
        rtcToken,
        uid,
        callType: callSession.callType,
        callerId: callSession.callerUserId,
        appId: agoraAppId,
      });
    } catch (error: any) {
      console.error('[Call] Error accepting call:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/call/decline - Decline an incoming call
  app.post("/api/call/decline", isAuthenticated, async (req: any, res: Response) => {
    const calleeUserId = req.user.id;
    const { callId } = req.body;

    try {
      if (!callId) {
        return res.status(400).json({ message: "callId is required" });
      }

      // Find the call session
      const [callSession] = await db
        .select()
        .from(callSessions)
        .where(
          and(
            eq(callSessions.callId, callId),
            eq(callSessions.calleeUserId, calleeUserId)
          )
        )
        .limit(1);

      if (!callSession) {
        return res.status(404).json({ message: "Call not found" });
      }

      console.log(`[Call] Declining call: callId=${callId} callee=${calleeUserId}`);

      // Update call status to declined
      await db
        .update(callSessions)
        .set({ status: 'declined', endedAt: new Date() })
        .where(eq(callSessions.callId, callId));

      // Notify caller that call was declined (Sendbird primary + /ws secondary)
      const declineChannel = await findMatchChannel(callSession.callerUserId, calleeUserId);
      await emitCallSignal(declineChannel, 'call_declined', callSession.callerUserId, 'call_declined', {
        callId,
        calleeUserId,
      });

      res.json({ message: "Call declined" });
    } catch (error: any) {
      console.error('[Call] Error declining call:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/call/end - End an active call
  app.post("/api/call/end", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { callId } = req.body;

    try {
      if (!callId) {
        return res.status(400).json({ message: "callId is required" });
      }

      // Find the call session (must be caller or callee)
      const [callSession] = await db
        .select()
        .from(callSessions)
        .where(
          and(
            eq(callSessions.callId, callId),
            or(
              eq(callSessions.callerUserId, userId),
              eq(callSessions.calleeUserId, userId)
            )
          )
        )
        .limit(1);

      if (!callSession) {
        return res.status(404).json({ message: "Call not found" });
      }

      console.log(`[Call] Ending call: callId=${callId} by user=${userId}`);

      // Update call status to ended
      await db
        .update(callSessions)
        .set({ status: 'ended', endedAt: new Date() })
        .where(eq(callSessions.callId, callId));

      // Notify the other party (Sendbird primary + /ws secondary)
      const otherUserId = userId === callSession.callerUserId
        ? callSession.calleeUserId
        : callSession.callerUserId;

      const endChannel = await findMatchChannel(userId, otherUserId);
      await emitCallSignal(endChannel, 'call_ended', otherUserId, 'call_ended', {
        callId,
        endedBy: userId,
      });

      res.json({ message: "Call ended" });
    } catch (error: any) {
      console.error('[Call] Error ending call:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/call/token - Get Agora RTC token for caller to join channel
  app.get("/api/call/token", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { callId } = req.query;

    try {
      if (!callId) {
        return res.status(400).json({ message: "callId is required" });
      }

      // Find the call session
      const [callSession] = await db
        .select()
        .from(callSessions)
        .where(eq(callSessions.callId, callId as string))
        .limit(1);

      if (!callSession) {
        return res.status(404).json({ message: "Call not found" });
      }

      // Verify user is part of this call
      if (callSession.callerUserId !== userId && callSession.calleeUserId !== userId) {
        return res.status(403).json({ message: "Not authorized for this call" });
      }

      // Generate Agora RTC token
      const agoraAppId = process.env.AGORA_APP_ID || process.env.VITE_AGORA_APP_ID;
      const agoraCertificate = process.env.AGORA_APP_CERTIFICATE;

      if (!agoraAppId || !agoraCertificate) {
        const missing = [
          !agoraAppId ? "AGORA_APP_ID" : null,
          !agoraCertificate ? "AGORA_APP_CERTIFICATE" : null,
        ].filter(Boolean).join(", ");
        console.error(`[Call] Agora credentials not configured — missing: ${missing}`);
        return res.status(500).json({ message: `Video calling not configured (missing: ${missing})` });
      }

      const uid = Math.floor(Math.random() * 100000);
      const expirationTimeInSeconds = 3600;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const rtcToken = RtcTokenBuilder.buildTokenWithUid(
        agoraAppId,
        agoraCertificate,
        callSession.channelName,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs
      );

      res.json({
        channel: callSession.channelName,
        rtcToken,
        uid,
        callType: callSession.callType,
        appId: agoraAppId,
      });
    } catch (error: any) {
      console.error('[Call] Error getting call token:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/call/pending - The call (if any) currently ringing for me as the
  // callee. The app polls this when it comes to the foreground (e.g. after the
  // user taps an "Incoming call" push) so the answer screen still appears even
  // if the live signal was missed while the app was closed.
  app.get("/api/call/pending", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    try {
      const [callSession] = await db
        .select()
        .from(callSessions)
        .where(
          and(
            eq(callSessions.calleeUserId, userId),
            eq(callSessions.status, 'ringing')
          )
        )
        .orderBy(desc(callSessions.createdAt))
        .limit(1);

      if (!callSession || !callSession.createdAt) {
        return res.json(null);
      }

      // Ignore stale rings past the ring window.
      const age = Date.now() - new Date(callSession.createdAt).getTime();
      if (age > RING_TIMEOUT_MS) {
        return res.json(null);
      }

      const [callerProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, callSession.callerUserId))
        .limit(1);

      res.json({
        callId: callSession.callId,
        channel: callSession.channelName,
        callType: callSession.callType,
        callerId: callSession.callerUserId,
        callerName: callerProfile?.displayName || 'Someone',
      });
    } catch (error: any) {
      console.error('[Call] Error fetching pending call:', error);
      res.status(500).json({ message: error.message });
    }
  });
}
