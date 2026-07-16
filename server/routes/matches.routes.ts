// Match listing and unmatching
import type { Express, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { SendbirdService } from "../sendbird";
import {
  users,
  profiles,
  matches,
  type Profile,
  type Match,
  type MatchWithProfiles,
} from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { profileWithAbsoluteUrls } from "./helpers";

export function registerMatchRoutes(app: Express) {
  // Get matches
  app.get("/api/matches", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    // Check subscription status - users must have active subscription to view matches
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const hasActiveSubscription = user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing';

    // For testing: Allow viewing matches regardless of subscription
    const allowAllAccess = true; // Set to false in production
    if (!allowAllAccess && !hasActiveSubscription) {
      return res.status(403).json({ 
        message: "Subscription required to view matches",
        requiresSubscription: true,
      });
    }

    const userMatches = await db
      .select()
      .from(matches)
      .where(or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)))
      .orderBy(desc(matches.createdAt));

    const result: MatchWithProfiles[] = [];

    for (const match of userMatches) {
      const [user1Profile] = await db
        .select({
          profile: profiles,
          user: users,
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .where(eq(profiles.userId, match.user1Id))
        .limit(1);

      const [user2Profile] = await db
        .select({
          profile: profiles,
          user: users,
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .where(eq(profiles.userId, match.user2Id))
        .limit(1);

      if (user1Profile && user2Profile) {
        result.push({
          ...match,
          user1Profile: {
            ...profileWithAbsoluteUrls(user1Profile.profile),
            user: user1Profile.user,
          },
          user2Profile: {
            ...profileWithAbsoluteUrls(user2Profile.profile),
            user: user2Profile.user,
          },
        });
      }
    }

    res.json(result);
  });

  // Get single match
  app.get("/api/match/:matchId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { matchId } = req.params;

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
      return res.status(404).json({ message: "Match not found" });
    }

    const [user1Profile] = await db
      .select({
        profile: profiles,
        user: users,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(eq(profiles.userId, match.user1Id))
      .limit(1);

    const [user2Profile] = await db
      .select({
        profile: profiles,
        user: users,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(eq(profiles.userId, match.user2Id))
      .limit(1);

    if (!user1Profile || !user2Profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const result: MatchWithProfiles = {
      ...match,
      user1Profile: {
        ...profileWithAbsoluteUrls(user1Profile.profile),
        user: user1Profile.user,
      },
      user2Profile: {
        ...profileWithAbsoluteUrls(user2Profile.profile),
        user: user2Profile.user,
      },
    };

    res.json(result);
  });

  // Delete/Unmatch - Remove a match and leave the conversation
  app.delete("/api/matches/:matchId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { matchId } = req.params;

    try {
      // Verify the match exists and user is part of it
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
        return res.status(404).json({ message: "Match not found" });
      }

      // Delete the match
      await db.delete(matches).where(eq(matches.id, matchId));

      // Try to delete the Sendbird channel
      try {
        await SendbirdService.deleteChannel(matchId);
      } catch (error) {
        console.error('[Sendbird] Failed to delete channel:', error);
      }

      res.json({ message: "Chat deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting match:', error);
      res.status(500).json({ message: "Failed to delete chat" });
    }
  });
}
