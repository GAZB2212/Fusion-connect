// Discover feed, swiping, and likes
import type { Express, Response } from "express";
import { isAuthenticated } from "../auth";
import { broadcastToUser } from "../websocket";
import { db } from "../db";
import { SendbirdService } from "../sendbird";
import { toAbsoluteUrl } from "../r2";
import {
  users,
  profiles,
  swipes,
  matches,
  chaperones,
  blockedUsers,
  type Profile,
  type Match,
  type Chaperone,
  type ProfileWithUser,
} from "@shared/schema";
import {
  eq,
  and,
  or,
  ne,
  notInArray,
  desc,
} from "drizzle-orm";
import { profileWithAbsoluteUrls } from "./helpers";

export function registerDiscoveryRoutes(app: Express) {
  // ===== End Fast Onboarding API Routes =====

  // Helper function to calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  // Discover endpoint - get profiles to swipe on (sorted by distance, nearest first)
  app.get("/api/discover", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    // Get user's profile
    const [userProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!userProfile) {
      return res.status(400).json({ message: "Please complete your profile first" });
    }

    // Ensure user has a gender set for proper filtering
    if (!userProfile.gender) {
      return res.status(400).json({ message: "Please set your gender in your profile" });
    }

    // Determine target gender (opposite gender matching)
    const targetGender = userProfile.gender === 'male' ? 'female' : 'male';
    console.log(`[DISCOVER] User ${userId} (${userProfile.gender}) looking for ${targetGender} profiles`);

    // Get IDs of already swiped profiles
    const alreadySwiped = await db
      .select({ swipedId: swipes.swipedId })
      .from(swipes)
      .where(eq(swipes.swiperId, userId));

    const swipedIds = alreadySwiped.map((s) => s.swipedId);

    // Get IDs of blocked users (both directions)
    const blockedByMe = await db
      .select({ blockedId: blockedUsers.blockedId })
      .from(blockedUsers)
      .where(eq(blockedUsers.blockerId, userId));
    const blockedMe = await db
      .select({ blockerId: blockedUsers.blockerId })
      .from(blockedUsers)
      .where(eq(blockedUsers.blockedId, userId));
    
    const blockedIds = [...blockedByMe.map(b => b.blockedId), ...blockedMe.map(b => b.blockerId)];

    // Get profiles to show (opposite gender only, not self, not already swiped, active profiles)
    let discoverProfiles = await db
      .select({
        profile: profiles,
        user: users,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(
        and(
          ne(profiles.userId, userId),
          eq(profiles.isActive, true),
          eq(profiles.isComplete, true),
          eq(profiles.gender, targetGender), // Explicit opposite gender match
          swipedIds.length > 0 ? notInArray(profiles.userId, swipedIds) : undefined,
          blockedIds.length > 0 ? notInArray(profiles.userId, blockedIds) : undefined
        )
      )
      .limit(100);

    console.log(`[DISCOVER] Found ${discoverProfiles.length} profiles for user ${userId}`);

    // DEV MODE: If no profiles found and we're in development, loop all profiles (ignore swipes but keep gender filter)
    if (discoverProfiles.length === 0 && process.env.NODE_ENV === 'development') {
      discoverProfiles = await db
        .select({
          profile: profiles,
          user: users,
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .where(
          and(
            ne(profiles.userId, userId),
            eq(profiles.isActive, true),
            eq(profiles.isComplete, true),
            eq(profiles.gender, targetGender) // Keep gender filter in dev mode too
          )
        )
        .limit(100);
      console.log(`[DISCOVER DEV] Fallback found ${discoverProfiles.length} profiles`);
    }

    // Sort by distance if user has coordinates
    let result: (ProfileWithUser & { distance?: number })[] = discoverProfiles.map((dp) => ({
      ...profileWithAbsoluteUrls(dp.profile),
      user: dp.user,
    }));

    if (userProfile.latitude && userProfile.longitude) {
      result = result.map((profile) => {
        let distance: number | undefined;
        if (profile.latitude && profile.longitude) {
          distance = calculateDistance(
            userProfile.latitude!,
            userProfile.longitude!,
            profile.latitude,
            profile.longitude
          );
        }
        return { ...profile, distance };
      });

      // Sort by distance (nearest first), profiles without coordinates go to the end
      result.sort((a, b) => {
        if (a.distance === undefined && b.distance === undefined) return 0;
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      });
    }

    // Return top 20 profiles (with absolute URLs for mobile app compatibility)
    res.json(result.slice(0, 20));
  });

  // Swipe endpoint
  app.post("/api/swipe", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { swipedId, direction } = req.body;

    if (!swipedId || typeof swipedId !== "string") {
      return res.status(400).json({ message: "Missing swipedId" });
    }
    if (direction !== "left" && direction !== "right") {
      return res.status(400).json({ message: "direction must be 'left' or 'right'" });
    }
    if (swipedId === userId) {
      return res.status(400).json({ message: "Cannot swipe on yourself" });
    }

    // MANDATORY: Check if user has completed face verification
    const [userProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!userProfile || !userProfile.faceVerified) {
      return res.status(403).json({
        message: "Face verification required",
        requiresVerification: true,
        details: "Please complete face verification before you can start swiping. This helps us ensure everyone on Fusion is genuine."
      });
    }

    // Record the swipe, updating the direction if this pair was already swiped
    // so repeat swipes can't pile up duplicate rows
    const [existingSwipe] = await db
      .select()
      .from(swipes)
      .where(and(eq(swipes.swiperId, userId), eq(swipes.swipedId, swipedId)))
      .limit(1);

    if (existingSwipe) {
      await db
        .update(swipes)
        .set({ direction })
        .where(eq(swipes.id, existingSwipe.id));
    } else {
      await db.insert(swipes).values({
        swiperId: userId,
        swipedId,
        direction,
      });
    }

    let isMatch = false;
    let matchId: string | null = null;

    // If this is a right swipe, check for mutual match
    if (direction === "right") {
      const [mutualSwipe] = await db
        .select()
        .from(swipes)
        .where(
          and(
            eq(swipes.swiperId, swipedId),
            eq(swipes.swipedId, userId),
            eq(swipes.direction, "right")
          )
        )
        .limit(1);

      if (mutualSwipe) {

        // Check if match already exists to prevent duplicates
        const [existingMatch] = await db
          .select()
          .from(matches)
          .where(
            or(
              and(eq(matches.user1Id, userId), eq(matches.user2Id, swipedId)),
              and(eq(matches.user1Id, swipedId), eq(matches.user2Id, userId))
            )
          )
          .limit(1);

        if (existingMatch) {
          console.log(`[SWIPE] Match already exists: ${existingMatch.id}`);
          isMatch = true;
          matchId = existingMatch.id;
        } else {
          // Check if at least one user has an active subscription
          // Matches can only be created if at least one user is a premium subscriber
          const [currentUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

          const [otherUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, swipedId))
            .limit(1);

          const currentUserHasSubscription = currentUser?.subscriptionStatus === 'active' || currentUser?.subscriptionStatus === 'trialing';
          const otherUserHasSubscription = otherUser?.subscriptionStatus === 'active' || otherUser?.subscriptionStatus === 'trialing';

          // A match requires at least one premium subscriber; the bypass is
          // for local testing only
          const allowAllMatches = process.env.NODE_ENV === 'development';
          if (allowAllMatches || currentUserHasSubscription || otherUserHasSubscription) {
            try {
              const [newMatch] = await db.insert(matches).values({
                user1Id: userId,
                user2Id: swipedId,
              }).returning();
              isMatch = true;
              matchId = newMatch.id;
              console.log(`[MATCH] ✅ Created match ${newMatch.id} between ${userId} and ${swipedId}`);
              
              // Broadcast new match to both users via WebSocket for real-time updates
              broadcastToUser(userId, { type: 'new_match', matchId: newMatch.id });
              broadcastToUser(swipedId, { type: 'new_match', matchId: newMatch.id });
              console.log(`[MATCH] Broadcasted new_match event to both users`);
              
              // Create Sendbird channel for the match
              try {
                // First ensure both users exist in Sendbird
                const [profile1] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
                const [profile2] = await db.select().from(profiles).where(eq(profiles.userId, swipedId)).limit(1);
                
                await SendbirdService.createOrUpdateUser({
                  userId: userId,
                  nickname: profile1?.displayName || currentUser?.firstName || 'User',
                  profileUrl: profile1?.photos?.[0] ? toAbsoluteUrl(profile1.photos[0]) : undefined,
                });
                console.log(`[Sendbird] Created/updated user ${userId} for match`);
                
                await SendbirdService.createOrUpdateUser({
                  userId: swipedId,
                  nickname: profile2?.displayName || otherUser?.firstName || 'User',
                  profileUrl: profile2?.photos?.[0] ? toAbsoluteUrl(profile2.photos[0]) : undefined,
                });
                console.log(`[Sendbird] Created/updated user ${swipedId} for match`);
                
                // Now create the channel
                await SendbirdService.createChannel([userId, swipedId], newMatch.id);
                console.log(`[Sendbird] Created channel for match ${newMatch.id}`);
                
                // Add any chaperones with 'live' access from both users to the new channel
                const allChaperones = await db
                  .select()
                  .from(chaperones)
                  .where(
                    and(
                      or(eq(chaperones.userId, userId), eq(chaperones.userId, swipedId)),
                      eq(chaperones.isActive, true),
                      eq(chaperones.accessType, 'live')
                    )
                  );
                
                for (const chaperone of allChaperones) {
                  if (chaperone.sendbirdUserId) {
                    try {
                      await SendbirdService.inviteToChannel(newMatch.id, [chaperone.sendbirdUserId]);
                      
                      // Get the user's profile to include in the message
                      const [chaperoneUserProfile] = await db
                        .select()
                        .from(profiles)
                        .where(eq(profiles.userId, chaperone.userId))
                        .limit(1);
                      
                      await SendbirdService.sendSystemMessage(
                        newMatch.id,
                        `${chaperone.chaperoneName} (${chaperone.relationshipType || 'Chaperone'}) has joined as a chaperone for ${chaperoneUserProfile?.displayName || 'one of the users'}.`
                      );
                      console.log(`[Sendbird] Added chaperone ${chaperone.chaperoneName} to match ${newMatch.id}`);
                    } catch (chaperoneError) {
                      console.error(`[Sendbird] Failed to add chaperone to channel:`, chaperoneError);
                    }
                  }
                }
              } catch (error) {
                console.error('[Sendbird] Failed to create channel:', error);
              }
            } catch (error) {
              console.error('[MATCH] Failed to create match:', error);
              throw error;
            }
          } else {
            console.log(`[SWIPE] Match not created - subscription required`);
          }
        }
      } else {
        console.log(`[SWIPE] No mutual swipe found yet`);
      }
    }

    res.json({ success: true, isMatch, matchId });
  });

  // Get users who liked current user (Likes You feature)
  app.get("/api/likes", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;

      // Check subscription status
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const hasActiveSubscription = user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing';

      // Get all users who swiped right on current user
      const likedBySwipes = await db
        .select()
        .from(swipes)
        .where(and(
          eq(swipes.swipedId, userId),
          eq(swipes.direction, 'right')
        ))
        .orderBy(desc(swipes.createdAt));

      // Get users that current user has already swiped on (to exclude)
      const currentUserSwipes = await db
        .select({ swipedId: swipes.swipedId })
        .from(swipes)
        .where(eq(swipes.swiperId, userId));

      const swipedUserIds = currentUserSwipes.map(s => s.swipedId);

      // Filter out users current user has already swiped on
      const pendingLikes = likedBySwipes.filter(s => !swipedUserIds.includes(s.swiperId));

      // Get profiles for these users
      const likesWithProfiles = [];
      for (const swipe of pendingLikes) {
        const [profileData] = await db
          .select({
            profile: profiles,
            user: users,
          })
          .from(profiles)
          .innerJoin(users, eq(profiles.userId, users.id))
          .where(eq(profiles.userId, swipe.swiperId))
          .limit(1);

        if (profileData) {
          likesWithProfiles.push({
            swipeId: swipe.id,
            swipedAt: swipe.createdAt,
            profile: {
              ...profileData.profile,
              photos: profileData.profile.photos?.map(url => toAbsoluteUrl(url)) || [],
            },
          });
        }
      }

      res.json({
        likes: likesWithProfiles,
        count: likesWithProfiles.length,
        hasActiveSubscription,
      });
    } catch (error) {
      console.error('[LIKES] Error fetching likes:', error);
      res.status(500).json({ message: "Failed to fetch likes" });
    }
  });

  // Get a specific user's profile by ID (for viewing from Likes page)
  app.get("/api/users/:userId/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.id;

      // Check subscription status
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, currentUserId))
        .limit(1);

      const hasActiveSubscription = user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing';

      // Get the profile
      const [profileData] = await db
        .select({
          profile: profiles,
          user: users,
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (!profileData) {
        return res.status(404).json({ message: "Profile not found" });
      }

      res.json({
        profile: {
          ...profileData.profile,
          photos: profileData.profile.photos?.map(url => toAbsoluteUrl(url)) || [],
          introVideoUrl: profileData.profile.introVideoUrl ? toAbsoluteUrl(profileData.profile.introVideoUrl) : null,
        },
        hasActiveSubscription,
      });
    } catch (error) {
      console.error('[PROFILE] Error fetching user profile:', error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });
}
