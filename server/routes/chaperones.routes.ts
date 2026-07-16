// Chaperone (Wali) management and portal access
import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { SendbirdService } from "../sendbird";
import { randomBytes } from "crypto";
import { sendChaperoneInvitationEmail } from "../email";
import {
  profiles,
  chaperones,
  insertChaperoneSchema,
  type Chaperone,
} from "@shared/schema";
import { eq, and, or } from "drizzle-orm";

export function registerChaperoneRoutes(app: Express) {
  // Chaperone endpoints
  app.get("/api/chaperones", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    const userChaperones = await db
      .select()
      .from(chaperones)
      .where(eq(chaperones.userId, userId));

    res.json(userChaperones);
  });

  app.post("/api/chaperones", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const validatedData = insertChaperoneSchema.parse(req.body);
      const accessType = validatedData.accessType || 'live';

      // Generate access token for the chaperone
      const accessToken = randomBytes(32).toString('hex');
      
      // Only create Sendbird user ID if access type is 'live'
      const sendbirdUserId = accessType === 'live' ? `chaperone_${randomBytes(8).toString('hex')}` : null;

      // Create chaperone record
      const [chaperone] = await db
        .insert(chaperones)
        .values({
          ...validatedData,
          userId,
          sendbirdUserId,
          accessToken,
          accessType,
        })
        .returning();

      // Get user's profile for name
      const [userProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      // Only set up Sendbird access if access type is 'live'
      if (accessType === 'live' && sendbirdUserId) {
        try {
          await SendbirdService.createOrUpdateUser({
            userId: sendbirdUserId,
            nickname: `${validatedData.chaperoneName} (Chaperone)`,
            profileUrl: 'https://via.placeholder.com/150',
          });

          // Get all user's match channels and invite chaperone
          const userChannels = await SendbirdService.getUserChannels(userId);
          for (const channel of userChannels) {
            try {
              await SendbirdService.inviteToChannel(channel.channel_url, [sendbirdUserId]);
              // Send system message announcing chaperone joined
              await SendbirdService.sendSystemMessage(
                channel.channel_url, 
                `${validatedData.chaperoneName} (${validatedData.relationshipType || 'Chaperone'}) has joined this conversation as a chaperone for ${userProfile?.displayName || 'the user'}.`
              );
            } catch (inviteError) {
              console.error(`Failed to invite chaperone to channel ${channel.channel_url}:`, inviteError);
            }
          }
        } catch (sendbirdError) {
          console.error('Sendbird error while setting up chaperone:', sendbirdError);
          // Continue even if Sendbird fails - chaperone record is saved
        }
      }

      // Send invitation email to the chaperone
      try {
        const domain = process.env.REPLIT_DOMAINS 
          ? 'https://' + process.env.REPLIT_DOMAINS.split(',')[0]
          : process.env.REPLIT_DEV_DOMAIN 
            ? 'https://' + process.env.REPLIT_DEV_DOMAIN 
            : 'http://localhost:5000';
        const accessLink = `${domain}/chaperone?token=${accessToken}`;
        
        await sendChaperoneInvitationEmail(
          validatedData.chaperoneEmail,
          validatedData.chaperoneName,
          userProfile?.displayName || 'A Fusion user',
          validatedData.relationshipType || null,
          accessLink,
          accessType as 'live' | 'report'
        );
        console.log(`[Chaperone] Invitation email sent to ${validatedData.chaperoneEmail}`);
      } catch (emailError) {
        console.error('[Chaperone] Failed to send invitation email:', emailError);
        // Continue even if email fails - chaperone record is saved
      }

      res.json(chaperone);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/chaperones/:chaperoneId", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { chaperoneId } = req.params;

    // First get the chaperone to get their Sendbird user ID
    const [chaperoneToDelete] = await db
      .select()
      .from(chaperones)
      .where(
        and(
          eq(chaperones.id, chaperoneId),
          eq(chaperones.userId, userId)
        )
      )
      .limit(1);

    if (!chaperoneToDelete) {
      return res.status(404).json({ message: "Chaperone not found" });
    }

    // Remove chaperone from all channels
    if (chaperoneToDelete.sendbirdUserId) {
      try {
        const userChannels = await SendbirdService.getUserChannels(userId);
        for (const channel of userChannels) {
          try {
            await SendbirdService.removeFromChannel(channel.channel_url, [chaperoneToDelete.sendbirdUserId]);
            await SendbirdService.sendSystemMessage(
              channel.channel_url,
              `${chaperoneToDelete.chaperoneName} is no longer a chaperone in this conversation.`
            );
          } catch (removeError) {
            console.error(`Failed to remove chaperone from channel ${channel.channel_url}:`, removeError);
          }
        }
        
        // Delete Sendbird user
        try {
          await SendbirdService.deleteUser(chaperoneToDelete.sendbirdUserId);
        } catch (deleteError) {
          console.error('Failed to delete chaperone Sendbird user:', deleteError);
        }
      } catch (sendbirdError) {
        console.error('Sendbird error while removing chaperone:', sendbirdError);
      }
    }

    // Delete from database
    await db
      .delete(chaperones)
      .where(eq(chaperones.id, chaperoneId));

    res.json({ success: true });
  });

  // Chaperone portal authentication endpoints
  app.post("/api/chaperone/login", async (req: Request, res: Response) => {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: "Access token is required" });
    }

    try {
      // Find chaperone by access token
      const [chaperone] = await db
        .select()
        .from(chaperones)
        .where(
          and(
            eq(chaperones.accessToken, accessToken),
            eq(chaperones.isActive, true)
          )
        )
        .limit(1);

      if (!chaperone) {
        return res.status(401).json({ message: "Invalid or expired access token" });
      }

      // Get the user this chaperone is watching
      const [userProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, chaperone.userId))
        .limit(1);

      // Generate Sendbird session token for the chaperone
      let sendbirdToken = null;
      if (chaperone.sendbirdUserId) {
        try {
          sendbirdToken = await SendbirdService.generateSessionToken(chaperone.sendbirdUserId);
        } catch (error) {
          console.error('Failed to generate Sendbird token for chaperone:', error);
        }
      }

      res.json({
        chaperone: {
          id: chaperone.id,
          name: chaperone.chaperoneName,
          relationshipType: chaperone.relationshipType,
          sendbirdUserId: chaperone.sendbirdUserId,
        },
        watchingUser: {
          name: userProfile?.displayName || 'User',
        },
        sendbirdToken,
      });
    } catch (error: any) {
      console.error('Chaperone login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Get Sendbird token for authenticated chaperone session
  app.post("/api/chaperone/sendbird-token", async (req: Request, res: Response) => {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: "Access token is required" });
    }

    try {
      const [chaperone] = await db
        .select()
        .from(chaperones)
        .where(
          and(
            eq(chaperones.accessToken, accessToken),
            eq(chaperones.isActive, true)
          )
        )
        .limit(1);

      if (!chaperone || !chaperone.sendbirdUserId) {
        return res.status(401).json({ message: "Invalid access token" });
      }

      const token = await SendbirdService.generateSessionToken(chaperone.sendbirdUserId);
      res.json({ token, userId: chaperone.sendbirdUserId });
    } catch (error: any) {
      console.error('Chaperone Sendbird token error:', error);
      res.status(500).json({ message: "Failed to generate token" });
    }
  });
}
