import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import { db } from "./db";
import passport from "passport";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "./email";
import { createRequire } from "module";
import QRCode from "qrcode";
import { createCanvas, loadImage } from "canvas";
const require = createRequire(import.meta.url);
const { RtcTokenBuilder, RtcRole } = require("agora-token");
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
  earlySignups,
  insertProfileSchema,
  insertMessageSchema,
  insertChaperoneSchema,
  insertPushSubscriptionSchema,
  insertBlockedUserSchema,
  insertUserReportSchema,
  registerUserSchema,
  loginSchema,
  type Profile,
  type Match,
  type Message,
  type Chaperone,
  type VideoCall,
  type ProfileWithUser,
  type MatchWithProfiles,
  type MessageWithSender,
  type EarlySignup,
} from "@shared/schema";
import { eq, and, or, ne, notInArray, desc, sql, lt } from "drizzle-orm";
import { sendVideoCallNotification } from "./pushNotifications";

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

  // Subscription endpoints - Using Checkout Sessions API (modern approach)
  app.post('/api/create-checkout-session', isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { promoCode } = req.body;

    try {
      // Get or create the fixed price ID
      const { getOrCreatePriceId } = await import('./stripeSetup');
      const priceId = await getOrCreatePriceId();

      // Get current user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate promo code if provided
      let trialDays = 0;
      let promoCodeRecord = null;
      
      if (promoCode) {
        const [signup] = await db
          .select()
          .from(earlySignups)
          .where(eq(earlySignups.promoCode, promoCode.toUpperCase()))
          .limit(1);

        if (!signup) {
          return res.status(400).json({ message: "Invalid promo code" });
        }

        if (signup.used) {
          return res.status(400).json({ message: "This promo code has already been used" });
        }

        // Valid unused promo code - apply 2 months (60 days) trial
        trialDays = 60;
        promoCodeRecord = signup;
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;

        // Save customer ID
        await db
          .update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, userId));
      }

      // Create Checkout Session with custom UI mode
      // Get the correct domain for return URL
      const getDomain = () => {
        if (process.env.REPLIT_DOMAINS) {
          const domains = process.env.REPLIT_DOMAINS.split(',');
          return `https://${domains[0]}`;
        }
        if (process.env.REPLIT_DEV_DOMAIN) {
          return process.env.REPLIT_DEV_DOMAIN.startsWith('http') 
            ? process.env.REPLIT_DEV_DOMAIN 
            : `https://${process.env.REPLIT_DEV_DOMAIN}`;
        }
        return 'http://localhost:5000';
      };

      const sessionConfig: any = {
        ui_mode: 'custom',
        customer: customerId,
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        return_url: `${getDomain()}/matches?session_id={CHECKOUT_SESSION_ID}`,
      };

      // Apply trial period if promo code is valid
      if (trialDays > 0) {
        sessionConfig.subscription_data = {
          trial_period_days: trialDays,
          metadata: {
            promoCode: promoCode.toUpperCase(),
          },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      // Mark promo code as used if provided and valid
      if (promoCodeRecord) {
        await db
          .update(earlySignups)
          .set({ 
            used: true, 
            usedBy: userId,
            usedAt: new Date(),
          })
          .where(eq(earlySignups.id, promoCodeRecord.id));
      }

      res.json({
        clientSecret: session.client_secret,
        sessionId: session.id,
        trialDays: trialDays,
      });
    } catch (error: any) {
      console.error('Checkout session creation error:', error);
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

  // Stripe Webhook Handler - Handles subscription lifecycle events
  app.post('/api/webhook', async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      return res.status(400).send('Missing stripe signature');
    }

    let event;

    try {
      // For development, we may not have a webhook secret
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // In development without webhook secret, just parse the body
        event = JSON.parse(req.body);
        console.warn('⚠️  Webhook verification skipped (no STRIPE_WEBHOOK_SECRET)');
      }
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          // Find user by Stripe customer ID
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1);

          if (user) {
            // Update user with subscription info
            await db
              .update(users)
              .set({
                stripeSubscriptionId: subscriptionId,
                subscriptionStatus: 'active',
              })
              .where(eq(users.id, user.id));

            console.log('✅ Subscription activated for user:', user.email);
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const customerId = subscription.customer as string;

          // Find user by Stripe customer ID
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1);

          if (user) {
            // Update subscription status and end date
            await db
              .update(users)
              .set({
                stripeSubscriptionId: subscription.id,
                subscriptionStatus: subscription.status,
                subscriptionEndsAt: subscription.current_period_end 
                  ? new Date(subscription.current_period_end * 1000) 
                  : null,
              })
              .where(eq(users.id, user.id));

            console.log('✅ Subscription updated for user:', user.email, 'Status:', subscription.status);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription.customer as string;

          // Find user by Stripe customer ID
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1);

          if (user) {
            // Mark subscription as canceled
            await db
              .update(users)
              .set({
                subscriptionStatus: 'canceled',
                subscriptionEndsAt: new Date(),
              })
              .where(eq(users.id, user.id));

            console.log('✅ Subscription canceled for user:', user.email);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const customerId = invoice.customer as string;

          // Find user by Stripe customer ID
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1);

          if (user) {
            // Mark subscription as past_due
            await db
              .update(users)
              .set({
                subscriptionStatus: 'past_due',
              })
              .where(eq(users.id, user.id));

            console.log('⚠️  Payment failed for user:', user.email);
            // TODO: Send email notification to user
          }
          break;
        }

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Face verification endpoint
  app.post("/api/verify-face", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({ message: "Image URL is required" });
      }

      const { verifyFrontFacingPhoto } = await import("./faceVerification");
      const result = await verifyFrontFacingPhoto(imageUrl);

      res.json(result);
    } catch (error: any) {
      console.error("Face verification error:", error);
      res.status(500).json({ 
        message: "Face verification failed", 
        error: error.message 
      });
    }
  });

  // Compare faces for identity verification
  app.post("/api/compare-faces", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { uploadedPhoto, liveSelfie } = req.body;

      if (!uploadedPhoto || !liveSelfie) {
        return res.status(400).json({ message: "Both uploaded photo and live selfie are required" });
      }

      const { compareFaces } = await import("./faceVerification");
      const result = await compareFaces(uploadedPhoto, liveSelfie);

      // If verification successful, update profile
      if (result.isMatch) {
        const userId = req.user.id;
        await db
          .update(profiles)
          .set({
            faceVerified: true,
            photoVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, userId));
      }

      res.json(result);
    } catch (error: any) {
      console.error("Face comparison error:", error);
      res.status(500).json({ 
        message: "Face comparison failed", 
        error: error.message 
      });
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

  // AI-Powered Suggestions endpoint - get compatible profiles with compatibility scores
  app.get("/api/suggestions", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
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

      // Get IDs of blocked users
      const blockedByMe = await db
        .select({ blockedId: blockedUsers.blockedId })
        .from(blockedUsers)
        .where(eq(blockedUsers.blockerId, userId));

      const blockedByMeIds = blockedByMe.map((b) => b.blockedId);

      // Get all potential matches (opposite gender, not self, not swiped, not blocked, active profiles)
      const potentialMatches = await db
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
            swipedIds.length > 0 ? notInArray(profiles.userId, swipedIds) : undefined,
            blockedByMeIds.length > 0 ? notInArray(profiles.userId, blockedByMeIds) : undefined
          )
        )
        .limit(50);

      // Calculate compatibility score for each profile
      const profilesWithScores = potentialMatches.map(({ profile, user }) => {
        let totalScore = 0;
        let maxScore = 0;
        const matchReasons: string[] = [];

        // 1. Islamic Values Compatibility (30 points max)
        maxScore += 30;
        if (userProfile.sect && profile.sect) {
          if (userProfile.sect === profile.sect) {
            totalScore += 15;
            matchReasons.push(`Same Islamic sect: ${profile.sect}`);
          } else if (userProfile.sect.includes('Sunni') && profile.sect.includes('Sunni')) {
            totalScore += 10;
            matchReasons.push('Both follow Sunni tradition');
          } else if (userProfile.sect.includes('Shia') && profile.sect.includes('Shia')) {
            totalScore += 10;
            matchReasons.push('Both follow Shia tradition');
          }
        }

        if (userProfile.religiosity && profile.religiosity) {
          if (userProfile.religiosity === profile.religiosity) {
            totalScore += 10;
            matchReasons.push(`Similar religious outlook: ${profile.religiosity}`);
          } else if (
            (userProfile.religiosity.includes('Very') && profile.religiosity.includes('Moderately')) ||
            (userProfile.religiosity.includes('Moderately') && profile.religiosity.includes('Very'))
          ) {
            totalScore += 5;
          }
        }

        if (userProfile.religiousPractice && profile.religiousPractice) {
          if (userProfile.religiousPractice === profile.religiousPractice) {
            totalScore += 5;
            matchReasons.push(`Similar practice level`);
          }
        }

        // 2. Shared Interests (25 points max)
        maxScore += 25;
        const userInterests = userProfile.interests || [];
        const profileInterests = profile.interests || [];
        const sharedInterests = userInterests.filter(i => profileInterests.includes(i));
        
        if (sharedInterests.length > 0) {
          const interestScore = Math.min(25, sharedInterests.length * 5);
          totalScore += interestScore;
          if (sharedInterests.length >= 5) {
            matchReasons.push(`${sharedInterests.length} shared interests including ${sharedInterests.slice(0, 3).join(', ')}`);
          } else if (sharedInterests.length >= 2) {
            matchReasons.push(`Shared interests: ${sharedInterests.join(', ')}`);
          }
        }

        // 3. Age Preferences Match (20 points max)
        maxScore += 20;
        const partnerPrefs = userProfile.partnerPreferences as any;
        if (partnerPrefs && partnerPrefs.ageMin && partnerPrefs.ageMax && profile.age) {
          if (profile.age >= partnerPrefs.ageMin && profile.age <= partnerPrefs.ageMax) {
            totalScore += 20;
            matchReasons.push('Age matches your preferences');
          } else if (
            (profile.age >= partnerPrefs.ageMin - 2 && profile.age <= partnerPrefs.ageMax + 2)
          ) {
            totalScore += 10;
          }
        } else {
          // Default score if no preferences set
          totalScore += 10;
        }

        // 4. Education & Profession Alignment (15 points max)
        maxScore += 15;
        if (userProfile.education && profile.education) {
          if (userProfile.education === profile.education) {
            totalScore += 10;
            matchReasons.push(`Similar education level`);
          }
        }

        if (userProfile.profession && profile.profession) {
          if (userProfile.profession === profile.profession) {
            totalScore += 5;
            matchReasons.push(`Works in similar field`);
          }
        }

        // 5. Life Goals & Values (10 points max)
        maxScore += 10;
        if (userProfile.wantsChildren && profile.wantsChildren) {
          if (userProfile.wantsChildren === profile.wantsChildren) {
            totalScore += 10;
            if (userProfile.wantsChildren === 'Yes') {
              matchReasons.push('Both want children');
            }
          }
        }

        // Calculate final percentage score
        const compatibilityScore = Math.round((totalScore / maxScore) * 100);

        return {
          profile: { ...profile, user },
          compatibilityScore,
          matchReasons: matchReasons.slice(0, 3), // Top 3 reasons
        };
      });

      // Sort by compatibility score (highest first) and take top 10
      const topSuggestions = profilesWithScores
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, 10);

      res.json(topSuggestions);
    } catch (error: any) {
      console.error('Error fetching suggestions:', error);
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
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

        // For testing: Allow all matches regardless of subscription
        // In production, only create match if at least one user has an active subscription
        const allowAllMatches = true; // Set to false in production
        if (allowAllMatches || currentUserHasSubscription || otherUserHasSubscription) {
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

  // Push notification endpoints
  app.post("/api/push/subscribe", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const validatedData = insertPushSubscriptionSchema.parse({
        userId,
        ...req.body
      });

      // Check if subscription already exists
      const [existing] = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.endpoint, validatedData.endpoint)
          )
        )
        .limit(1);

      if (existing) {
        return res.json({ message: "Subscription already exists", subscription: existing });
      }

      // Create new subscription
      const [subscription] = await db
        .insert(pushSubscriptions)
        .values(validatedData)
        .returning();

      res.json({ message: "Push subscription created", subscription });
    } catch (error: any) {
      console.error('Error saving push subscription:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/push/unsubscribe", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      // Delete all subscriptions for this user
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));

      res.json({ message: "Push subscriptions removed" });
    } catch (error: any) {
      console.error('Error removing push subscription:', error);
      res.status(400).json({ message: error.message });
    }
  });

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

  // Early Signup - Waitlist (Public route)
  app.post("/api/early-signup", async (req: Request, res: Response) => {
    try {
      const { email, firstName } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if email already signed up
      const [existing] = await db
        .select()
        .from(earlySignups)
        .where(eq(earlySignups.email, email.toLowerCase()))
        .limit(1);

      if (existing) {
        return res.status(400).json({ message: "Email already registered for early access" });
      }

      // Check if we've hit the limit
      const signupCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(earlySignups);
      
      const currentCount = Number(signupCount[0].count);
      
      if (currentCount >= 1500) {
        return res.status(400).json({ message: "Early access is full" });
      }

      // Generate unique promo code
      const generatePromoCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'FUSION-';
        for (let i = 0; i < 5; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      let promoCode = generatePromoCode();
      
      // Ensure promo code is unique
      while (true) {
        const [existingPromo] = await db
          .select()
          .from(earlySignups)
          .where(eq(earlySignups.promoCode, promoCode))
          .limit(1);
        
        if (!existingPromo) break;
        promoCode = generatePromoCode();
      }

      // Create signup
      const [signup] = await db
        .insert(earlySignups)
        .values({
          email: email.toLowerCase(),
          firstName: firstName || null,
          promoCode,
          position: currentCount + 1,
        })
        .returning();

      res.json({ signup, message: "Successfully joined the waitlist!" });
    } catch (error: any) {
      console.error('Error creating early signup:', error);
      res.status(500).json({ message: "Failed to join waitlist" });
    }
  });

  // Get early signup count (Public route)
  app.get("/api/early-signup/count", async (req: Request, res: Response) => {
    try {
      const signupCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(earlySignups);
      
      const actualCount = Number(signupCount[0].count);
      const total = actualCount + 500; // Start at 501 to show social proof
      const remaining = Math.max(0, 1500 - total);

      res.json({ total, remaining });
    } catch (error: any) {
      console.error('Error getting signup count:', error);
      res.status(500).json({ message: "Failed to get signup count" });
    }
  });

  // Validate promo code (Authenticated route)
  app.post("/api/validate-promo-code", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { promoCode } = req.body;

      if (!promoCode) {
        return res.status(400).json({ valid: false, message: "Promo code is required" });
      }

      // Find the promo code
      const [signup] = await db
        .select()
        .from(earlySignups)
        .where(eq(earlySignups.promoCode, promoCode.toUpperCase()))
        .limit(1);

      if (!signup) {
        return res.json({ valid: false, message: "Invalid promo code" });
      }

      if (signup.used) {
        return res.json({ valid: false, message: "This promo code has already been used" });
      }

      res.json({ 
        valid: true, 
        message: "Valid promo code! You'll get 2 months free premium access.",
        benefit: "2 months free"
      });
    } catch (error: any) {
      console.error('Error validating promo code:', error);
      res.status(500).json({ valid: false, message: "Failed to validate promo code" });
    }
  });

  // Generate QR code for launch page (Public route)
  app.get("/api/generate-qr-code", async (req: Request, res: Response) => {
    try {
      const url = "https://www.fusioncouples.com/launch";
      const goldColor = "#D4AF37";
      const backgroundColor = "#111422";

      // Generate QR code as buffer
      const qrBuffer = await QRCode.toBuffer(url, {
        width: 600,
        margin: 2,
        color: {
          dark: goldColor,
          light: backgroundColor,
        },
        errorCorrectionLevel: 'H' // High error correction to allow logo overlay
      });

      // Create canvas to add logo
      const canvas = createCanvas(600, 600);
      const ctx = canvas.getContext('2d');

      // Draw QR code
      const qrImage = await loadImage(qrBuffer);
      ctx.drawImage(qrImage, 0, 0, 600, 600);

      // Try to load and add logo in center
      try {
        const logo = await loadImage('./attached_assets/NEW logo 2_1761675667388.png');
        
        // Calculate logo size (about 20% of QR code)
        const logoSize = 120;
        const logoX = (600 - logoSize) / 2;
        const logoY = (600 - logoSize) / 2;

        // Draw white background circle for logo
        ctx.fillStyle = backgroundColor;
        ctx.beginPath();
        ctx.arc(300, 300, logoSize / 2 + 10, 0, Math.PI * 2);
        ctx.fill();

        // Draw logo
        ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
      } catch (logoError) {
        console.log('Could not load logo, QR code generated without logo overlay');
      }

      // Convert to buffer
      const finalBuffer = canvas.toBuffer('image/png');

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'inline; filename="fusion-launch-qr.png"');
      res.send(finalBuffer);
    } catch (error: any) {
      console.error('Error generating QR code:', error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
