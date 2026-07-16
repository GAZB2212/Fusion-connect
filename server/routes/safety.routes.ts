// Blocking, reporting, and account deletion
import type { Express, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  users,
  profiles,
  swipes,
  matches,
  messages,
  chaperones,
  videoCalls,
  passwordResetTokens,
  pushSubscriptions,
  blockedUsers,
  userReports,
} from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";

export function registerSafetyRoutes(app: Express) {
  // Block User
  app.post("/api/users/:userId/block", isAuthenticated, async (req: any, res: Response) => {
    const blockerId = req.user.id;
    const blockedId = req.params.userId;

    try {
      if (blockerId === blockedId) {
        return res.status(400).json({ message: "Cannot block yourself" });
      }

      // Check if already blocked
      const [existing] = await db
        .select()
        .from(blockedUsers)
        .where(
          and(
            eq(blockedUsers.blockerId, blockerId),
            eq(blockedUsers.blockedId, blockedId)
          )
        )
        .limit(1);

      if (existing) {
        return res.json({ message: "User already blocked" });
      }

      await db.insert(blockedUsers).values({
        blockerId,
        blockedId,
        reason: req.body.reason || null,
      });

      // Remove any matches between these users
      await db
        .delete(matches)
        .where(
          or(
            and(eq(matches.user1Id, blockerId), eq(matches.user2Id, blockedId)),
            and(eq(matches.user1Id, blockedId), eq(matches.user2Id, blockerId))
          )
        );

      res.json({ message: "User blocked successfully" });
    } catch (error: any) {
      console.error('Error blocking user:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Unblock User
  app.post("/api/users/:userId/unblock", isAuthenticated, async (req: any, res: Response) => {
    const blockerId = req.user.id;
    const blockedId = req.params.userId;

    try {
      await db
        .delete(blockedUsers)
        .where(
          and(
            eq(blockedUsers.blockerId, blockerId),
            eq(blockedUsers.blockedId, blockedId)
          )
        );

      res.json({ message: "User unblocked successfully" });
    } catch (error: any) {
      console.error('Error unblocking user:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get Blocked Users
  app.get("/api/users/blocked", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const blocked = await db
        .select({
          id: blockedUsers.id,
          blockedId: blockedUsers.blockedId,
          reason: blockedUsers.reason,
          createdAt: blockedUsers.createdAt,
          profile: profiles,
        })
        .from(blockedUsers)
        .leftJoin(profiles, eq(profiles.userId, blockedUsers.blockedId))
        .where(eq(blockedUsers.blockerId, userId))
        .orderBy(desc(blockedUsers.createdAt));

      res.json(blocked);
    } catch (error: any) {
      console.error('Error getting blocked users:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Report User
  app.post("/api/users/:userId/report", isAuthenticated, async (req: any, res: Response) => {
    const reporterId = req.user.id;
    const reportedId = req.params.userId;

    try {
      if (reporterId === reportedId) {
        return res.status(400).json({ message: "Cannot report yourself" });
      }

      const [report] = await db
        .insert(userReports)
        .values({
          reporterId,
          reportedId,
          reason: req.body.reason,
          details: req.body.details || null,
        })
        .returning();

      res.json({ message: "Report submitted successfully", report });
    } catch (error: any) {
      console.error('Error reporting user:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(400).json({ message: error.message });
    }
  });

  // Delete Account
  app.delete("/api/account", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      // Delete user's data in order (respecting foreign keys)
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      await db.delete(videoCalls).where(or(eq(videoCalls.callerId, userId), eq(videoCalls.receiverId, userId)));
      await db.delete(messages).where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)));
      await db.delete(chaperones).where(eq(chaperones.userId, userId));
      await db.delete(userReports).where(or(eq(userReports.reporterId, userId), eq(userReports.reportedId, userId)));
      await db.delete(blockedUsers).where(or(eq(blockedUsers.blockerId, userId), eq(blockedUsers.blockedId, userId)));
      await db.delete(matches).where(or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)));
      await db.delete(swipes).where(or(eq(swipes.swiperId, userId), eq(swipes.swipedId, userId)));
      await db.delete(profiles).where(eq(profiles.userId, userId));
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
      await db.delete(users).where(eq(users.id, userId));

      // Logout the user
      req.logout((err: any) => {
        if (err) {
          console.error('Error logging out after account deletion:', err);
        }
      });

      res.json({ message: "Account deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting account:', error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });
}
