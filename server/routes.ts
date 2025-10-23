import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import { db } from "./db";
import passport from "passport";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "./email";
import { 
  users, 
  profiles, 
  swipes, 
  matches, 
  messages, 
  chaperones,
  passwordResetTokens,
  insertProfileSchema,
  insertMessageSchema,
  insertChaperoneSchema,
  registerUserSchema,
  loginSchema,
  type Profile,
  type Match,
  type Message,
  type Chaperone,
  type ProfileWithUser,
  type MatchWithProfiles,
  type MessageWithSender,
} from "@shared/schema";
import { eq, and, or, ne, notInArray, desc, sql, lt } from "drizzle-orm";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Register new user
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const validatedData = registerUserSchema.parse(req.body);

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, validatedData.email.toLowerCase()))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: validatedData.email.toLowerCase(),
          password: hashedPassword,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName || null,
        })
        .returning();

      // Log the user in automatically
      req.login({ id: newUser.id, email: newUser.email, firstName: newUser.firstName, lastName: newUser.lastName }, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        
        const { password: _, ...userWithoutPassword } = newUser;
        res.json({ user: userWithoutPassword });
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login
  app.post("/api/login", (req: Request, res: Response, next) => {
    try {
      loginSchema.parse(req.body);
    } catch (error: any) {
      return res.status(400).json({ message: error.errors[0].message });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({ user });
      });
    })(req, res, next);
  });

  // Change password
  app.post("/api/change-password", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    try {
      // Get user with password
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || !user.password) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, userId));

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Request password reset
  app.post("/api/forgot-password", async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    try {
      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      // Always return success even if user doesn't exist (security best practice)
      if (!user) {
        return res.json({ success: true, message: "If an account exists with that email, you will receive a password reset link" });
      }

      // Generate secure random token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store token in database
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      // Send email
      await sendPasswordResetEmail(user.email, token, user.firstName || '');

      res.json({ success: true, message: "If an account exists with that email, you will receive a password reset link" });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Reset password with token
  app.post("/api/reset-password", async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    try {
      // Find valid token
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false)
          )
        )
        .limit(1);

      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Reset token has expired" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({ success: true, message: "Password has been reset successfully" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // DEV MODE: Activate premium without payment
  app.post('/api/dev/activate-premium', isAuthenticated, async (req: any, res: Response) => {
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ message: "Only available in development mode" });
    }

    const userId = req.user.id;

    try {
      // Update user to have active premium subscription
      await db
        .update(users)
        .set({
          subscriptionStatus: 'active',
          subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        })
        .where(eq(users.id, userId));

      res.json({
        success: true,
        message: "Premium activated (dev mode)",
        subscriptionStatus: 'active',
      });
    } catch (error: any) {
      console.error('Dev premium activation error:', error);
      return res.status(400).json({ message: error.message });
    }
  });

  // Subscription endpoints - from blueprint:javascript_stripe
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      // Get current user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If user already has active subscription, return existing
      if (user.stripeSubscriptionId && user.subscriptionStatus === 'active') {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['latest_invoice.payment_intent'],
        });
        
        const latestInvoice = subscription.latest_invoice;
        if (typeof latestInvoice === 'string') {
          return res.status(400).json({ message: "Invalid invoice" });
        }
        
        const paymentIntent = (latestInvoice as any)?.payment_intent;
        if (!paymentIntent || typeof paymentIntent === 'string') {
          return res.status(400).json({ message: "Invalid payment intent" });
        }

        return res.json({
          subscriptionId: subscription.id,
          clientSecret: paymentIntent.client_secret,
          status: subscription.status,
        });
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        });
        customerId = customer.id;

        // Save customer ID
        await db
          .update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, userId));
      }

      // Create subscription with £9.99/month price
      // Using GBP instead of USD as per requirement
      const price = await stripe.prices.create({
        currency: 'gbp',
        unit_amount: 999, // £9.99 in pence
        recurring: { interval: 'month' },
        product_data: {
          name: 'Fusion Premium',
        },
      });

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: price.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });

      // Save subscription ID
      await db
        .update(users)
        .set({
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
        })
        .where(eq(users.id, userId));

      const latestInvoice = subscription.latest_invoice;
      if (typeof latestInvoice === 'string') {
        return res.status(400).json({ message: "Invalid invoice" });
      }
      
      const paymentIntent = (latestInvoice as any)?.payment_intent;
      if (!paymentIntent || typeof paymentIntent === 'string') {
        return res.status(400).json({ message: "Invalid payment intent" });
      }

      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
        status: subscription.status,
      });
    } catch (error: any) {
      console.error('Subscription creation error:', error);
      return res.status(400).json({ message: error.message });
    }
  });

  // Check subscription status
  app.get('/api/subscription-status', isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    // Prevent caching of subscription status
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check database subscription status first
    const hasActiveDbSubscription = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';

    // If no Stripe subscription ID, return database status
    if (!user.stripeSubscriptionId) {
      return res.json({
        hasActiveSubscription: hasActiveDbSubscription,
        status: user.subscriptionStatus || 'none',
        currentPeriodEnd: user.subscriptionEndsAt ? user.subscriptionEndsAt.toISOString() : null,
        cancelAtPeriodEnd: false,
      });
    }

    // Fetch latest subscription status from Stripe
    try {
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

      // Update local database with latest status
      await db
        .update(users)
        .set({
          subscriptionStatus: subscription.status,
          subscriptionEndsAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
        })
        .where(eq(users.id, userId));

      const isActive = subscription.status === 'active' || subscription.status === 'trialing';

      res.json({
        hasActiveSubscription: isActive,
        status: subscription.status,
        currentPeriodEnd: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    } catch (error: any) {
      console.error('Subscription status check error:', error);
      // Fall back to database status if Stripe check fails
      res.json({
        hasActiveSubscription: hasActiveDbSubscription,
        status: user.subscriptionStatus || 'error',
        currentPeriodEnd: user.subscriptionEndsAt ? user.subscriptionEndsAt.toISOString() : null,
        cancelAtPeriodEnd: false,
      });
    }
  });

  // Cancel subscription
  app.post('/api/cancel-subscription', isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ message: "No active subscription found" });
    }

    try {
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await db
        .update(users)
        .set({
          subscriptionStatus: subscription.status,
          subscriptionEndsAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
        })
        .where(eq(users.id, userId));

      res.json({
        success: true,
        message: "Subscription will be canceled at period end",
        cancelAt: subscription.cancel_at,
      });
    } catch (error: any) {
      console.error('Subscription cancellation error:', error);
      return res.status(400).json({ message: error.message });
    }
  });

  // Profile endpoints
  app.get("/api/profile", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

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
    const userId = req.user.id;

    try {
      const validatedData = insertProfileSchema.parse(req.body);

      // Check if profile already exists
      const [existing] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (existing) {
        // Update existing profile
        const [profile] = await db
          .update(profiles)
          .set({
            ...validatedData,
            isComplete: true,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, userId))
          .returning();

        return res.json(profile);
      }

      // Create new profile
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
    const userId = req.user.id;

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

    // Get IDs of already swiped profiles
    const alreadySwiped = await db
      .select({ swipedId: swipes.swipedId })
      .from(swipes)
      .where(eq(swipes.swiperId, userId));

    const swipedIds = alreadySwiped.map((s) => s.swipedId);

    // Get profiles to show (opposite gender, not self, not already swiped, active profiles)
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
          ne(profiles.gender, userProfile.gender),
          swipedIds.length > 0 ? notInArray(profiles.userId, swipedIds) : undefined
        )
      )
      .limit(20);

    // DEV MODE: If no profiles found and we're in development, loop all profiles (ignore swipes)
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
            ne(profiles.gender, userProfile.gender)
          )
        )
        .limit(20);
    }

    const result: ProfileWithUser[] = discoverProfiles.map((dp) => ({
      ...dp.profile,
      user: dp.user,
    }));

    res.json(result);
  });

  // Swipe endpoint
  app.post("/api/swipe", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
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

        // Only create match if at least one user has an active subscription
        if (currentUserHasSubscription || otherUserHasSubscription) {
          await db.insert(matches).values({
            user1Id: userId,
            user2Id: swipedId,
          });
          isMatch = true;
        }
      }
    }

    res.json({ success: true, isMatch });
  });

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

    if (!hasActiveSubscription) {
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
    const userId = req.user.id;
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
    const userId = req.user.id;

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
    const userId = req.user.id;
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
