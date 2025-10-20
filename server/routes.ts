import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import { db } from "./db";
import { 
  users, 
  profiles, 
  swipes, 
  matches, 
  messages, 
  chaperones,
  insertProfileSchema,
  insertMessageSchema,
  insertChaperoneSchema,
  type Profile,
  type Match,
  type Message,
  type Chaperone,
  type ProfileWithUser,
  type MatchWithProfiles,
  type MessageWithSender,
} from "@shared/schema";
import { eq, and, or, ne, notInArray, desc, sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Profile endpoints
  app.get("/api/profile", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  });

  app.post("/api/profile", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;

    try {
      const validatedData = insertProfileSchema.parse(req.body);

      // Check if profile already exists
      const [existing] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (existing) {
        return res.status(400).json({ message: "Profile already exists" });
      }

      const [profile] = await db
        .insert(profiles)
        .values({
          ...validatedData,
          userId,
          isComplete: true,
        })
        .returning();

      res.json(profile);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/profile", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;

    const [profile] = await db
      .update(profiles)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))
      .returning();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  });

  // Discover endpoint - get profiles to swipe on
  app.get("/api/discover", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;

    // Get user's profile
    const [userProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!userProfile) {
      return res.status(400).json({ message: "Please complete your profile first" });
    }

    // Get IDs of already swiped profiles
    const alreadySwiped = await db
      .select({ swipedId: swipes.swipedId })
      .from(swipes)
      .where(eq(swipes.swiperId, userId));

    const swipedIds = alreadySwiped.map((s) => s.swipedId);

    // Get profiles to show (opposite gender, not self, not already swiped, active profiles)
    const discoverProfiles = await db
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
          ne(profiles.gender, userProfile.gender),
          swipedIds.length > 0 ? notInArray(profiles.userId, swipedIds) : undefined
        )
      )
      .limit(20);

    const result: ProfileWithUser[] = discoverProfiles.map((dp) => ({
      ...dp.profile,
      user: dp.user,
    }));

    res.json(result);
  });

  // Swipe endpoint
  app.post("/api/swipe", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;
    const { swipedId, direction } = req.body;

    if (!swipedId || !direction) {
      return res.status(400).json({ message: "Missing swipedId or direction" });
    }

    // Record the swipe
    await db.insert(swipes).values({
      swiperId: userId,
      swipedId,
      direction,
    });

    let isMatch = false;

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
        // Create match
        await db.insert(matches).values({
          user1Id: userId,
          user2Id: swipedId,
        });
        isMatch = true;
      }
    }

    res.json({ success: true, isMatch });
  });

  // Get matches
  app.get("/api/matches", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;

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
            ...user1Profile.profile,
            user: user1Profile.user,
          },
          user2Profile: {
            ...user2Profile.profile,
            user: user2Profile.user,
          },
        });
      }
    }

    res.json(result);
  });

  // Get single match
  app.get("/api/match/:matchId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;
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
        ...user1Profile.profile,
        user: user1Profile.user,
      },
      user2Profile: {
        ...user2Profile.profile,
        user: user2Profile.user,
      },
    };

    res.json(result);
  });

  // Messages endpoints
  app.get("/api/messages/:matchId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;
    const { matchId } = req.params;

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
      return res.status(403).json({ message: "Not authorized to view these messages" });
    }

    const matchMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.matchId, matchId))
      .orderBy(messages.createdAt);

    const result: MessageWithSender[] = [];

    for (const msg of matchMessages) {
      const [senderProfile] = await db
        .select({
          profile: profiles,
          user: users,
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .where(eq(profiles.userId, msg.senderId))
        .limit(1);

      if (senderProfile) {
        result.push({
          ...msg,
          senderProfile: {
            ...senderProfile.profile,
            user: senderProfile.user,
          },
        });
      }
    }

    res.json(result);
  });

  app.post("/api/messages", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;

    try {
      const validatedData = insertMessageSchema.parse(req.body);

      // Verify match exists and user is part of it
      const [match] = await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.id, validatedData.matchId),
            or(eq(matches.user1Id, userId), eq(matches.user2Id, userId))
          )
        )
        .limit(1);

      if (!match) {
        return res.status(403).json({ message: "Not authorized to send messages to this match" });
      }

      const [message] = await db
        .insert(messages)
        .values({
          ...validatedData,
          senderId: userId,
        })
        .returning();

      res.json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Chaperone endpoints
  app.get("/api/chaperones", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;

    const userChaperones = await db
      .select()
      .from(chaperones)
      .where(eq(chaperones.userId, userId));

    res.json(userChaperones);
  });

  app.post("/api/chaperones", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;

    try {
      const validatedData = insertChaperoneSchema.parse(req.body);

      const [chaperone] = await db
        .insert(chaperones)
        .values({
          ...validatedData,
          userId,
        })
        .returning();

      res.json(chaperone);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/chaperones/:chaperoneId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.claims.sub;
    const { chaperoneId } = req.params;

    const [deleted] = await db
      .delete(chaperones)
      .where(
        and(
          eq(chaperones.id, chaperoneId),
          eq(chaperones.userId, userId)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Chaperone not found" });
    }

    res.json({ success: true });
  });

  const httpServer = createServer(app);

  return httpServer;
}
