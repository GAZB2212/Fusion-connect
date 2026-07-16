// Development/testing utilities — all gated behind requireDev
import type { Express, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { SendbirdService } from "../sendbird";
import { toAbsoluteUrl } from "../r2";
import {
  users,
  profiles,
  swipes,
  matches,
  messages,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireDev } from "./helpers";

export function registerDevRoutes(app: Express) {
  // DEVELOPMENT: Reset all matches
  app.post("/api/dev/reset-matches", requireDev, isAuthenticated, async (req: any, res: Response) => {
    try {
      console.log(`[DEV] Resetting all matches`);
      
      // Delete all matches
      await db.delete(matches);
      
      // Reset swipes for fresh matching
      await db.delete(swipes);
      
      console.log(`[DEV] All matches and swipes deleted successfully`);
      
      res.json({ 
        success: true, 
        message: "All matches and swipes have been reset" 
      });
    } catch (error: any) {
      console.error("[DEV] Reset matches error:", error);
      res.status(500).json({ 
        message: "Failed to reset matches", 
        error: error.message 
      });
    }
  });

  // DEVELOPMENT: Backfill Sendbird channels for existing matches
  app.post('/api/dev/backfill-channels', requireDev, isAuthenticated, async (req: any, res: Response) => {
    try {
      console.log('[BACKFILL] Starting channel backfill for existing matches');
      
      // Get all matches with user profile data
      const allMatches = await db
        .select({
          matchId: matches.id,
          user1Id: matches.user1Id,
          user2Id: matches.user2Id,
          user1Profile: profiles,
          user1: users,
        })
        .from(matches)
        .leftJoin(profiles, eq(profiles.userId, matches.user1Id))
        .leftJoin(users, eq(users.id, matches.user1Id));

      console.log(`[BACKFILL] Found ${allMatches.length} total matches`);

      const results = {
        total: allMatches.length,
        created: 0,
        errors: 0,
        skipped: 0
      };

      for (const match of allMatches) {
        try {
          console.log(`[BACKFILL] Processing match ${match.matchId}`);
          
          // Create/update both users in Sendbird first
          const [profile1] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.userId, match.user1Id))
            .limit(1);
          
          const [user1] = await db
            .select()
            .from(users)
            .where(eq(users.id, match.user1Id))
            .limit(1);

          const [profile2] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.userId, match.user2Id))
            .limit(1);
          
          const [user2] = await db
            .select()
            .from(users)
            .where(eq(users.id, match.user2Id))
            .limit(1);

          // Create user1 in Sendbird
          if (user1 && profile1) {
            await SendbirdService.createOrUpdateUser({
              userId: user1.id,
              nickname: profile1.displayName || user1.firstName || user1.email,
              profileUrl: profile1.photos?.[0] ? toAbsoluteUrl(profile1.photos[0]) : undefined
            });
            console.log(`[BACKFILL] Created/updated Sendbird user: ${user1.id}`);
          }

          // Create user2 in Sendbird
          if (user2 && profile2) {
            await SendbirdService.createOrUpdateUser({
              userId: user2.id,
              nickname: profile2.displayName || user2.firstName || user2.email,
              profileUrl: profile2.photos?.[0] ? toAbsoluteUrl(profile2.photos[0]) : undefined
            });
            console.log(`[BACKFILL] Created/updated Sendbird user: ${user2.id}`);
          }

          // Now create the channel
          await SendbirdService.createChannel([match.user1Id, match.user2Id], match.matchId);
          results.created++;
          console.log(`[BACKFILL] ✅ Created channel for match ${match.matchId}`);
        } catch (error: any) {
          // Channel might already exist
          if (error.message?.includes('already exists') || error.message?.includes('400201')) {
            results.skipped++;
            console.log(`[BACKFILL] ⏭️  Channel already exists for match ${match.matchId}`);
          } else {
            results.errors++;
            console.error(`[BACKFILL] ❌ Error creating channel for match ${match.matchId}:`, error.message);
          }
        }
      }

      console.log('[BACKFILL] Complete:', results);
      res.json({ success: true, results });
    } catch (error: any) {
      console.error('[BACKFILL] Error:', error);
      res.status(500).json({ message: "Failed to backfill channels" });
    }
  });

  // DEVELOPMENT: Cleanup duplicate welcome messages from all channels
  app.post('/api/dev/cleanup-welcome-messages', requireDev, isAuthenticated, async (req: any, res: Response) => {
    try {
      console.log('[CLEANUP] Starting cleanup of duplicate welcome messages');
      
      // Get all matches to find their channel URLs
      const allMatches = await db
        .select({ matchId: matches.id })
        .from(matches);

      let totalDeleted = 0;
      let channelsProcessed = 0;

      for (const match of allMatches) {
        const deleted = await SendbirdService.cleanupDuplicateWelcomeMessages(match.matchId);
        totalDeleted += deleted;
        channelsProcessed++;
      }

      console.log(`[CLEANUP] Complete: Processed ${channelsProcessed} channels, deleted ${totalDeleted} duplicate messages`);
      res.json({ success: true, channelsProcessed, totalDeleted });
    } catch (error: any) {
      console.error('[CLEANUP] Error:', error);
      res.status(500).json({ message: "Failed to cleanup messages" });
    }
  });

  // DEVELOPMENT: Cleanup orphaned Sendbird channels (channels without matching database records)
  app.post('/api/dev/cleanup-orphaned-channels', requireDev, isAuthenticated, async (req: any, res: Response) => {
    try {
      console.log('[CLEANUP-CHANNELS] Starting cleanup of orphaned Sendbird channels');
      
      // Get all Sendbird channels
      const allChannels = await SendbirdService.getAllChannels();
      console.log(`[CLEANUP-CHANNELS] Found ${allChannels.length} channels in Sendbird`);
      
      // Get all match IDs from database
      const allMatches = await db
        .select({ matchId: matches.id })
        .from(matches);
      
      const validMatchIds = new Set(allMatches.map(m => m.matchId));
      console.log(`[CLEANUP-CHANNELS] Found ${validMatchIds.size} valid matches in database`);
      
      let deleted = 0;
      let kept = 0;
      
      for (const channel of allChannels) {
        const channelUrl = channel.channel_url;
        
        // Check if this channel has a corresponding match
        if (!validMatchIds.has(channelUrl)) {
          try {
            await SendbirdService.deleteChannel(channelUrl);
            deleted++;
            console.log(`[CLEANUP-CHANNELS] ✅ Deleted orphaned channel: ${channelUrl}`);
          } catch (err: any) {
            console.error(`[CLEANUP-CHANNELS] ❌ Failed to delete channel ${channelUrl}:`, err.message);
          }
        } else {
          kept++;
        }
      }
      
      console.log(`[CLEANUP-CHANNELS] Complete: Deleted ${deleted} orphaned channels, kept ${kept} valid channels`);
      res.json({ success: true, deleted, kept, totalChannels: allChannels.length });
    } catch (error: any) {
      console.error('[CLEANUP-CHANNELS] Error:', error);
      res.status(500).json({ message: "Failed to cleanup orphaned channels" });
    }
  });

  // DEVELOPMENT: Backfill Sendbird users for ALL existing users
  app.post('/api/dev/backfill-sendbird-users', requireDev, isAuthenticated, async (req: any, res: Response) => {
    try {
      console.log('[BACKFILL-USERS] Starting Sendbird user backfill for all users');
      
      // Get all users with their profiles
      const allUsers = await db
        .select({
          user: users,
          profile: profiles,
        })
        .from(users)
        .leftJoin(profiles, eq(users.id, profiles.userId));
      
      const results = { created: 0, updated: 0, errors: 0, total: allUsers.length };
      
      for (const { user, profile } of allUsers) {
        try {
          const nickname = profile?.displayName || 
            `${user.firstName || ''}${user.lastName ? ' ' + user.lastName : ''}`.trim() || 
            user.email;
          
          await SendbirdService.createOrUpdateUser({
            userId: user.id,
            nickname: nickname,
            profileUrl: profile?.photos?.[0] ? toAbsoluteUrl(profile.photos[0]) : undefined,
          });
          
          results.created++;
          console.log(`[BACKFILL-USERS] ✅ Created/updated Sendbird user: ${user.id} (${nickname})`);
        } catch (error: any) {
          results.errors++;
          console.error(`[BACKFILL-USERS] ❌ Error for user ${user.id}:`, error.message);
        }
      }
      
      console.log('[BACKFILL-USERS] Complete:', results);
      res.json({ success: true, results });
    } catch (error: any) {
      console.error('[BACKFILL-USERS] Error:', error);
      res.status(500).json({ message: "Failed to backfill Sendbird users" });
    }
  });
}
