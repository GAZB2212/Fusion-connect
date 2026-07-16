// Sendbird chat tokens and channel management
import type { Express, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { SendbirdService } from "../sendbird";
import { toAbsoluteUrl } from "../r2";
import {
  users,
  profiles,
  matches,
  type Match,
} from "@shared/schema";
import { eq, or } from "drizzle-orm";

export function registerSendbirdRoutes(app: Express) {
  // Sendbird session token endpoint
  app.get("/api/sendbird/token", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    
    try {
      console.log(`[Sendbird] Token request for user ${userId}`);
      
      // Get user's profile for photo
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
      
      const profilePhotoUrl = profile?.photos?.[0] ? toAbsoluteUrl(profile.photos[0]) : undefined;
      console.log(`[Sendbird] User ${userId} profile photo URL:`, profilePhotoUrl);
      
      // Ensure user exists in Sendbird first with profile photo
      // Try with photo first, fallback to no photo if it fails
      try {
        await SendbirdService.createOrUpdateUser({
          userId: userId,
          nickname: `${req.user.firstName}${req.user.lastName ? ' ' + req.user.lastName : ''}`,
          profileUrl: profilePhotoUrl,
        });
      } catch (userCreateError: any) {
        console.warn('[Sendbird] User creation with photo failed, trying without photo:', userCreateError.message);
        // Retry without profile photo
        await SendbirdService.createOrUpdateUser({
          userId: userId,
          nickname: `${req.user.firstName}${req.user.lastName ? ' ' + req.user.lastName : ''}`,
          profileUrl: undefined,
        });
      }
      
      // Also sync profile photos for all match partners (in background)
      (async () => {
        try {
          const userMatches = await db
            .select()
            .from(matches)
            .where(or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)));
          
          for (const match of userMatches) {
            const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;
            const [partnerProfile] = await db
              .select()
              .from(profiles)
              .where(eq(profiles.userId, partnerId))
              .limit(1);
            
            const [partnerUser] = await db
              .select()
              .from(users)
              .where(eq(users.id, partnerId))
              .limit(1);
            
            if (partnerUser && partnerProfile) {
              const partnerPhotoUrl = partnerProfile.photos?.[0] ? toAbsoluteUrl(partnerProfile.photos[0]) : undefined;
              await SendbirdService.createOrUpdateUser({
                userId: partnerId,
                nickname: partnerProfile.displayName || `${partnerUser.firstName || ''} ${partnerUser.lastName || ''}`.trim(),
                profileUrl: partnerPhotoUrl,
              });
            }
          }
        } catch (err) {
          console.error('[Sendbird] Error syncing partner profiles:', err);
        }
      })();
      
      console.log(`[Sendbird] User created/updated, generating token...`);
      
      // Generate session token
      const token = await SendbirdService.generateSessionToken(userId);
      
      console.log(`[Sendbird] Token generated successfully for user ${userId}`);
      res.json({ token, userId });
    } catch (error: any) {
      console.error('[Sendbird] Error in token endpoint:', error);
      console.error('[Sendbird] Error stack:', error.stack);
      res.status(500).json({ 
        message: "Failed to generate Sendbird token",
        error: error.message 
      });
    }
  });

  // Ensure Sendbird channel exists for a match
  app.post("/api/sendbird/ensure-channel/:matchId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { matchId } = req.params;
    
    try {
      console.log(`[Sendbird] Ensuring channel exists for match ${matchId}, user ${userId}`);
      
      // Get the match from database
      const [match] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);
      
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }
      
      // Verify user is part of this match
      if (match.user1Id !== userId && match.user2Id !== userId) {
        return res.status(403).json({ message: "You are not part of this match" });
      }
      
      const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;
      
      // Try to get existing channel
      try {
        const existingChannel = await SendbirdService.getChannel(matchId);
        console.log(`[Sendbird] Channel ${matchId} already exists`);
        
        // Check if user is a member
        const members = existingChannel.members || [];
        const userIsMember = members.some((m: any) => m.user_id === userId);
        
        if (!userIsMember) {
          // Invite user to channel
          await SendbirdService.inviteToChannel(matchId, [userId]);
          console.log(`[Sendbird] Invited user ${userId} to channel ${matchId}`);
        }
        
        return res.json({ 
          success: true, 
          channelUrl: existingChannel.channel_url,
          created: false 
        });
      } catch (channelError: any) {
        // Channel doesn't exist, create it
        console.log(`[Sendbird] Channel ${matchId} not found, creating...`);
        
        // Ensure both users exist in Sendbird first
        const [userProfile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.userId, userId))
          .limit(1);
        
        const [partnerProfile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.userId, partnerId))
          .limit(1);
        
        const [partnerUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, partnerId))
          .limit(1);
        
        // Create/update users in Sendbird
        await SendbirdService.createOrUpdateUser({
          userId: userId,
          nickname: `${req.user.firstName}${req.user.lastName ? ' ' + req.user.lastName : ''}`,
          profileUrl: userProfile?.photos?.[0] ? toAbsoluteUrl(userProfile.photos[0]) : undefined,
        });
        
        if (partnerUser) {
          await SendbirdService.createOrUpdateUser({
            userId: partnerId,
            nickname: partnerProfile?.displayName || `${partnerUser.firstName || ''} ${partnerUser.lastName || ''}`.trim(),
            profileUrl: partnerProfile?.photos?.[0] ? toAbsoluteUrl(partnerProfile.photos[0]) : undefined,
          });
        }
        
        // Create the channel with the match ID as the URL
        const newChannel = await SendbirdService.createChannel([userId, partnerId], matchId);
        console.log(`[Sendbird] Created channel ${matchId}`);
        
        return res.json({ 
          success: true, 
          channelUrl: newChannel.channel_url,
          created: true 
        });
      }
    } catch (error: any) {
      console.error('[Sendbird] Error ensuring channel:', error);
      res.status(500).json({ 
        message: "Failed to ensure channel exists",
        error: error.message 
      });
    }
  });
}
