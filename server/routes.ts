import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import { broadcastToUser } from "./websocket";
import { db } from "./db";
import { SendbirdService } from "./sendbird";
import passport from "passport";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail, sendChaperoneInvitationEmail } from "./email";
import { createRequire } from "module";
import QRCode from "qrcode";
import { createCanvas, loadImage } from "canvas";
import multer from "multer";
import { uploadPhotoToR2, uploadVideoToR2, base64ToBuffer, detectContentType, r2Client, BUCKET_NAME } from "./r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
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
  pushTokens,
  blockedUsers,
  userReports,
  earlySignups,
  userFeedback,
  onboardingConversations,
  insertProfileSchema,
  insertMessageSchema,
  insertChaperoneSchema,
  insertPushSubscriptionSchema,
  insertPushTokenSchema,
  insertBlockedUserSchema,
  insertUserReportSchema,
  insertUserFeedbackSchema,
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
import OpenAI from "openai";
import { eq, and, or, ne, notInArray, desc, sql, lt } from "drizzle-orm";
import { sendVideoCallNotification } from "./pushNotifications";
import { getCached, setCached, deleteCached } from "./caching";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

// Configure multer for photo uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
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

      // Create Sendbird user
      try {
        await SendbirdService.createOrUpdateUser({
          userId: newUser.id,
          nickname: `${newUser.firstName}${newUser.lastName ? ' ' + newUser.lastName : ''}`,
        });
        console.log(`Created Sendbird user for ${newUser.id}`);
      } catch (error) {
        console.error('Failed to create Sendbird user:', error);
      }

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
      try {
        await sendPasswordResetEmail(user.email, token, user.firstName || '');
        console.log(`Password reset email sent successfully to ${user.email}`);
      } catch (emailError: any) {
        console.error("Failed to send password reset email:", emailError);
        // Still return success for security (don't reveal if email exists)
        // but log the error so we can debug
      }

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

  // DEVELOPMENT: Activate premium without payment (always available for testing)
  app.post('/api/dev/activate-premium', isAuthenticated, async (req: any, res: Response) => {
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

  // ADMIN: Seed demo profiles for testing (call this on production to populate test data)
  app.post('/api/admin/seed-demo-profiles', async (req: Request, res: Response) => {
    const { adminKey } = req.body;
    
    // Simple admin key protection - change this to a secure value
    if (adminKey !== 'fusion-seed-2024') {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const hashedPassword = await bcrypt.hash('Demo123!', 10);
      const createdAccounts: string[] = [];

      // Demo female profiles
      const femaleProfiles = [
        { email: 'aisha.demo@fusion.com', firstName: 'Aisha', displayName: 'Aisha', age: 26, location: 'London, UK', bio: 'Software engineer who loves hiking and photography. Looking for someone kind and ambitious.', sect: 'Sunni', prayerLevel: 'Regular', lookingFor: 'Marriage' },
        { email: 'fatima.demo@fusion.com', firstName: 'Fatima', displayName: 'Fatima', age: 28, location: 'Manchester, UK', bio: 'Doctor by profession, artist by passion. Family-oriented and love good conversations.', sect: 'Sunni', prayerLevel: 'Regular', lookingFor: 'Marriage' },
        { email: 'mariam.demo@fusion.com', firstName: 'Mariam', displayName: 'Mariam', age: 25, location: 'Birmingham, UK', bio: 'Teacher who loves reading and traveling. Looking for a partner who values education and growth.', sect: 'Sunni', prayerLevel: 'Sometimes', lookingFor: 'Marriage' },
        { email: 'sara.demo@fusion.com', firstName: 'Sara', displayName: 'Sara', age: 27, location: 'Leeds, UK', bio: 'Marketing professional with a love for food and culture. Seeking a genuine connection.', sect: 'Sunni', prayerLevel: 'Regular', lookingFor: 'Marriage' },
        { email: 'zainab.demo@fusion.com', firstName: 'Zainab', displayName: 'Zainab', age: 24, location: 'London, UK', bio: 'Law student passionate about justice and community service. Looking for someone with similar values.', sect: 'Shia', prayerLevel: 'Regular', lookingFor: 'Marriage' },
      ];

      // Demo male profiles
      const maleProfiles = [
        { email: 'ahmed.demo@fusion.com', firstName: 'Ahmed', displayName: 'Ahmed', age: 29, location: 'London, UK', bio: 'Entrepreneur building tech startups. Love sports, especially football. Family means everything.', sect: 'Sunni', prayerLevel: 'Regular', lookingFor: 'Marriage' },
        { email: 'omar.demo@fusion.com', firstName: 'Omar', displayName: 'Omar', age: 31, location: 'Manchester, UK', bio: 'Architect who designs dreams. Enjoy traveling and exploring new cuisines. Ready to settle down.', sect: 'Sunni', prayerLevel: 'Regular', lookingFor: 'Marriage' },
        { email: 'yusuf.demo@fusion.com', firstName: 'Yusuf', displayName: 'Yusuf', age: 27, location: 'Birmingham, UK', bio: 'Accountant with a passion for charity work. Looking for someone who shares my values.', sect: 'Sunni', prayerLevel: 'Sometimes', lookingFor: 'Marriage' },
        { email: 'hassan.demo@fusion.com', firstName: 'Hassan', displayName: 'Hassan', age: 30, location: 'London, UK', bio: 'Doctor who loves making a difference. Enjoy reading, gym, and quality time with loved ones.', sect: 'Sunni', prayerLevel: 'Regular', lookingFor: 'Marriage' },
        { email: 'ali.demo@fusion.com', firstName: 'Ali', displayName: 'Ali', age: 28, location: 'Leeds, UK', bio: 'Software developer and fitness enthusiast. Looking for a partner to build a meaningful life with.', sect: 'Shia', prayerLevel: 'Regular', lookingFor: 'Marriage' },
      ];

      // Create female accounts and profiles
      for (const profile of femaleProfiles) {
        // Check if user already exists
        const [existing] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
        if (existing) continue;

        // Create user
        const [newUser] = await db.insert(users).values({
          email: profile.email,
          password: hashedPassword,
          firstName: profile.firstName,
          subscriptionStatus: 'active',
          subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        }).returning();

        // Create profile
        await db.insert(profiles).values({
          userId: newUser.id,
          displayName: profile.displayName,
          gender: 'female',
          age: profile.age,
          location: profile.location,
          bio: profile.bio,
          sect: profile.sect,
          prayerFrequency: profile.prayerLevel,
          lookingFor: profile.lookingFor,
          photos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'],
          isActive: true,
          isComplete: true,
          isVerified: true,
        });

        createdAccounts.push(profile.email);
      }

      // Create male accounts and profiles
      for (const profile of maleProfiles) {
        // Check if user already exists
        const [existing] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
        if (existing) continue;

        // Create user
        const [newUser] = await db.insert(users).values({
          email: profile.email,
          password: hashedPassword,
          firstName: profile.firstName,
          subscriptionStatus: 'active',
          subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        }).returning();

        // Create profile
        await db.insert(profiles).values({
          userId: newUser.id,
          displayName: profile.displayName,
          gender: 'male',
          age: profile.age,
          location: profile.location,
          bio: profile.bio,
          sect: profile.sect,
          prayerFrequency: profile.prayerLevel,
          lookingFor: profile.lookingFor,
          photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'],
          isActive: true,
          isComplete: true,
          isVerified: true,
        });

        createdAccounts.push(profile.email);
      }

      res.json({
        success: true,
        message: `Created ${createdAccounts.length} demo accounts`,
        accounts: createdAccounts,
        password: 'Demo123!',
        note: 'All accounts have premium activated. Log in with any email above and password Demo123!'
      });
    } catch (error: any) {
      console.error('Seed demo profiles error:', error);
      return res.status(500).json({ message: error.message });
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

  // Create Stripe Customer Portal session for subscription management
  app.post('/api/create-portal-session', isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "No subscription found. Please subscribe first." });
      }

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

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${getDomain()}/settings`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Portal session creation error:', error);
      return res.status(400).json({ message: error.message || "Failed to create portal session" });
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

  // Helper function to convert R2 proxy URL to base64 (defined here for use in face endpoints)
  async function convertProxyUrlToBase64ForVerify(url: string): Promise<string> {
    // If already a data URL, return as-is
    if (url.startsWith('data:image/')) {
      return url;
    }
    
    // If it's a proxy URL, fetch from R2 and convert to base64
    if (url.startsWith('/api/images/')) {
      const fileKey = url.replace('/api/images/', '');
      
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      });

      const response = await r2Client.send(command);
      
      if (!response.Body) {
        throw new Error("Image not found in storage");
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as NodeJS.ReadableStream;
      
      for await (const chunk of stream) {
        chunks.push(chunk as Uint8Array);
      }
      
      const buffer = Buffer.concat(chunks);
      const base64 = buffer.toString('base64');
      const contentType = response.ContentType || 'image/jpeg';
      
      return `data:${contentType};base64,${base64}`;
    }
    
    // If it's an external HTTPS URL, return as-is (OpenAI can access these)
    if (url.startsWith('https://')) {
      return url;
    }
    
    throw new Error("Invalid image URL format");
  }

  // Face verification endpoint
  app.post("/api/verify-face", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { imageUrl } = req.body;
      const userId = req.user.id;

      console.log(`[Verify Face] Starting verification for user ${userId}`);

      if (!imageUrl) {
        console.log(`[Verify Face] FAILED: No image URL provided`);
        return res.status(400).json({ message: "Image URL is required" });
      }

      // Convert proxy URL to base64 if needed
      const convertedImageUrl = await convertProxyUrlToBase64ForVerify(imageUrl);

      const { verifyFrontFacingPhoto } = await import("./faceVerification");
      const result = await verifyFrontFacingPhoto(convertedImageUrl);

      console.log(`[Verify Face] Result for user ${userId}:`, {
        passed: result.isFrontFacing,
        confidence: result.confidence,
        message: result.message
      });

      res.json(result);
    } catch (error: any) {
      console.error("[Verify Face] ERROR:", error);
      res.status(500).json({ 
        message: "Face verification failed", 
        error: error.message 
      });
    }
  });

  // Compare faces for identity verification using AWS Rekognition
  app.post("/api/compare-faces", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { uploadedPhoto, liveSelfie } = req.body;
      const userId = req.user.id;

      console.log(`[Compare Faces] Starting face comparison for user ${userId}`);

      if (!uploadedPhoto || !liveSelfie) {
        console.log(`[Compare Faces] FAILED: Missing photos`);
        return res.status(400).json({ message: "Both uploaded photo and live selfie are required", isMatch: false });
      }

      console.log(`[Compare Faces] Input photos:`);
      console.log(`  - Uploaded photo: ${uploadedPhoto.substring(0, 80)}...`);
      console.log(`  - Live selfie type: ${liveSelfie.startsWith('data:') ? 'base64' : 'url'} (length: ${liveSelfie.length})`);
      
      // Get image buffers directly (more efficient than base64 conversion)
      const { getImageBufferFromR2Url, base64ToBuffer } = await import("./r2");
      
      // Fetch profile photo from R2 storage
      const uploadedPhotoBuffer = await getImageBufferFromR2Url(uploadedPhoto);
      
      // Convert live selfie from base64
      const liveSelfieBuffer = base64ToBuffer(liveSelfie);
      
      console.log(`[Compare Faces] Image buffers:`);
      console.log(`  - Uploaded photo buffer size: ${uploadedPhotoBuffer.length} bytes`);
      console.log(`  - Live selfie buffer size: ${liveSelfieBuffer.length} bytes`);

      // Use AWS Rekognition for robust face comparison
      const { compareFacesWithRekognition } = await import("./rekognitionService");
      const result = await compareFacesWithRekognition(uploadedPhotoBuffer, liveSelfieBuffer, 85);

      console.log(`[Compare Faces] Result for user ${userId}:`, {
        isMatch: result.isMatch,
        confidence: result.confidence,
        message: result.message,
        details: result.details
      });

      // If verification successful, update profile
      if (result.isMatch) {
        await db
          .update(profiles)
          .set({
            faceVerified: true,
            photoVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, userId));
        
        console.log(`[Compare Faces] SUCCESS: User ${userId} verified and profile updated`);
      } else {
        console.log(`[Compare Faces] FAILED: Faces do not match for user ${userId}`);
      }

      res.json(result);
    } catch (error: any) {
      console.error("[Compare Faces] ERROR:", error);
      
      // Handle specific AWS errors
      if (error.name === "InvalidParameterException") {
        return res.status(400).json({
          isMatch: false,
          message: "Invalid image format or no face detected",
          details: error.message,
        });
      }
      
      res.status(500).json({ 
        message: "Face comparison failed", 
        error: error.message,
        isMatch: false
      });
    }
  });

  // DEVELOPMENT: Manual verification bypass (always available for testing)
  app.post("/api/dev-verify", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      
      console.log(`[DEV VERIFY] Manually verifying user ${userId}`);
      
      // Check if profile exists first
      const [existingProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
      
      if (!existingProfile) {
        console.log(`[DEV VERIFY] No profile found for user ${userId}`);
        return res.status(400).json({ 
          success: false, 
          message: "No profile found. Please complete your profile first." 
        });
      }
      
      console.log(`[DEV VERIFY] Found profile ${existingProfile.id}, current faceVerified: ${existingProfile.faceVerified}`);
      
      const [updatedProfile] = await db
        .update(profiles)
        .set({
          faceVerified: true,
          photoVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, userId))
        .returning();
      
      console.log(`[DEV VERIFY] User ${userId} manually verified successfully. New faceVerified: ${updatedProfile.faceVerified}`);
      
      res.json({ 
        success: true, 
        message: "Verification bypassed for development",
        faceVerified: updatedProfile.faceVerified
      });
    } catch (error: any) {
      console.error("[DEV VERIFY] ERROR:", error);
      res.status(500).json({ 
        message: "Manual verification failed", 
        error: error.message 
      });
    }
  });

  // DEVELOPMENT: Reset all matches
  app.post("/api/dev/reset-matches", isAuthenticated, async (req: any, res: Response) => {
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
      
      const profilePhotoUrl = profile?.photos?.[0];
      console.log(`[Sendbird] User ${userId} profile photo URL:`, profilePhotoUrl);
      
      // Ensure user exists in Sendbird first with profile photo
      // Try with photo first, fallback to no photo if it fails
      try {
        await SendbirdService.createOrUpdateUser({
          userId: userId,
          nickname: `${req.user.firstName}${req.user.lastName ? ' ' + req.user.lastName : ''}`,
          profileUrl: profilePhotoUrl || undefined,
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
              await SendbirdService.createOrUpdateUser({
                userId: partnerId,
                nickname: partnerProfile.displayName || `${partnerUser.firstName || ''} ${partnerUser.lastName || ''}`.trim(),
                profileUrl: partnerProfile.photos?.[0] || undefined,
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

  // Upload profile photos to R2
  app.post("/api/photos/upload", isAuthenticated, upload.array('photos', 6), async (req: any, res: Response) => {
    const userId = req.user.id;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    try {
      // Upload all photos to R2 in parallel
      const uploadPromises = files.map((file) =>
        uploadPhotoToR2(file.buffer, file.mimetype, userId, 'profile')
      );

      const photoUrls = await Promise.all(uploadPromises);

      console.log(`[Photo Upload] Successfully uploaded ${photoUrls.length} photos for user ${userId}`);

      res.json({ 
        success: true, 
        photoUrls,
        message: `${photoUrls.length} photo(s) uploaded successfully`
      });
    } catch (error: any) {
      console.error("[Photo Upload] Error:", error);
      res.status(500).json({ 
        message: "Failed to upload photos", 
        error: error.message 
      });
    }
  });

  // Image proxy endpoint - serves images from R2 storage
  app.get("/api/images/*", async (req: Request, res: Response) => {
    try {
      // Get the file key from the URL path (everything after /api/images/)
      const fileKey = req.params[0];
      
      if (!fileKey) {
        return res.status(400).json({ message: "No file key provided" });
      }

      // Fetch from R2
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      });

      const response = await r2Client.send(command);
      
      if (!response.Body) {
        return res.status(404).json({ message: "Image not found" });
      }

      // Set appropriate headers
      res.set('Content-Type', response.ContentType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.set('Access-Control-Allow-Origin', '*');

      // Stream the response
      const stream = response.Body as NodeJS.ReadableStream;
      stream.pipe(res);
    } catch (error: any) {
      console.error("[Image Proxy] Error:", error.message);
      if (error.name === 'NoSuchKey') {
        return res.status(404).json({ message: "Image not found" });
      }
      res.status(500).json({ message: "Failed to load image" });
    }
  });

  // Upload a single photo (base64) - for face verification compatibility
  app.post("/api/photos/upload-base64", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { photo, photoType = 'profile' } = req.body;

    if (!photo) {
      return res.status(400).json({ message: "No photo data provided" });
    }

    try {
      const buffer = base64ToBuffer(photo);
      const contentType = detectContentType(photo);
      
      const photoUrl = await uploadPhotoToR2(buffer, contentType, userId, photoType);

      console.log(`[Photo Upload Base64] Successfully uploaded ${photoType} photo for user ${userId}`);

      res.json({ 
        success: true, 
        photoUrl,
        message: "Photo uploaded successfully"
      });
    } catch (error: any) {
      console.error("[Photo Upload Base64] Error:", error);
      res.status(500).json({ 
        message: "Failed to upload photo", 
        error: error.message 
      });
    }
  });

  // Upload intro video (20 seconds max) - base64 encoded
  app.post("/api/video/upload", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { video } = req.body;

    if (!video) {
      return res.status(400).json({ message: "No video data provided" });
    }

    try {
      // Check video size (rough estimate from base64 length - max 20MB)
      const estimatedSize = (video.length * 3) / 4;
      const maxSize = 20 * 1024 * 1024; // 20MB
      
      if (estimatedSize > maxSize) {
        return res.status(400).json({ message: "Video too large. Maximum size is 20MB." });
      }

      const buffer = base64ToBuffer(video);
      const contentType = detectContentType(video);
      
      // Verify it's a video
      if (!contentType.startsWith('video/')) {
        return res.status(400).json({ message: "Invalid file type. Please upload a video." });
      }

      const videoUrl = await uploadVideoToR2(buffer, contentType, userId);

      // Update profile with video URL
      await db
        .update(profiles)
        .set({ introVideoUrl: videoUrl, updatedAt: new Date() })
        .where(eq(profiles.userId, userId));

      console.log(`[Video Upload] Successfully uploaded intro video for user ${userId}`);

      res.json({ 
        success: true, 
        videoUrl,
        message: "Video uploaded successfully"
      });
    } catch (error: any) {
      console.error("[Video Upload] Error:", error);
      res.status(500).json({ 
        message: "Failed to upload video", 
        error: error.message 
      });
    }
  });

  // Delete intro video
  app.delete("/api/video", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      // Update profile to remove video URL
      await db
        .update(profiles)
        .set({ introVideoUrl: null, updatedAt: new Date() })
        .where(eq(profiles.userId, userId));

      console.log(`[Video Delete] Successfully deleted intro video for user ${userId}`);

      res.json({ 
        success: true, 
        message: "Video deleted successfully"
      });
    } catch (error: any) {
      console.error("[Video Delete] Error:", error);
      res.status(500).json({ 
        message: "Failed to delete video", 
        error: error.message 
      });
    }
  });

  // ===== Fast Onboarding API Routes =====
  
  const FAST_ONBOARDING_SYSTEM_PROMPT = `You are helping a user complete their profile on Fusion, a Muslim-focused marriage-intent dating app.

YOUR ROLE:
- Ask ONE question at a time
- Keep responses SHORT (1-2 sentences max)
- Be warm, respectful, and non-judgmental
- Never pressure the user
- Always respect if they want to skip optional questions

CONVERSATION FLOW (ask in this order):

1. First name (REQUIRED)
2. Gender (REQUIRED) - Ask: "Are you a brother or sister?" Map to male/female
3. Age (REQUIRED) - Must be 18+
4. City/Location (REQUIRED) - Where they live
5. Ethnicity - Ask: "What's your ethnic background?"
6. Marital status - Ask: "Have you been married before?" (never_married, divorced, widowed)
7. Children - Ask: "Do you have any children?" If yes, ask how many
8. Wants children - Ask: "Would you like to have children in the future?" (yes, no, open)
9. Education - Ask: "What's your highest level of education?"
10. Occupation - Ask: "What do you do for work?"
11. Religious sect - Ask: "Which sect do you identify with?" (Sunni, Shia, Just Muslim, Other)
12. Prayer frequency - Ask: "How often do you pray?"
13. Religious practice - Ask: "How would you describe your religious practice overall?" Store EXACT words
14. Bio - Ask: "Tell me a little about yourself - your personality, hobbies, what makes you unique?"
15. What you're looking for - Ask: "What are you looking for in a partner?"

RULES:
- If they give unclear/ambiguous answer, politely ask for clarification
- If they want to skip an optional question, that's fine - move on
- For age, verify they're 18+ (if not, politely explain app requirement)
- For religious topics, NEVER interpret, judge, or provide rulings
- Store their exact phrasing for sensitive topics
- Never give advice, therapy, or religious guidance

IMPORTANT: You MUST respond with valid JSON only. After each user response, respond with this exact JSON format:
{
  "reply": "Your conversational response to the user",
  "extractedData": {
    "firstName": null,
    "gender": null,
    "age": null,
    "city": null,
    "ethnicity": null,
    "maritalStatus": null,
    "hasChildren": null,
    "numberOfChildren": null,
    "wantsChildren": null,
    "education": null,
    "occupation": null,
    "sect": null,
    "prayerFrequency": null,
    "religiosityRaw": null,
    "bio": null,
    "lookingForDescription": null
  },
  "currentQuestion": 1,
  "isComplete": false
}

For gender use: "male" or "female"
For maritalStatus use: "never_married", "divorced", or "widowed"
For wantsChildren use: "yes", "no", or "open"
Set isComplete to true only after question 15 has been answered.
Only include values that were actually extracted in this response.`;

  // AI Chat endpoint for fast onboarding
  app.post("/api/onboarding/ai-chat", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const { conversationHistory, currentExtractedData } = req.body;

      if (!conversationHistory || !Array.isArray(conversationHistory)) {
        return res.status(400).json({ message: "Invalid conversation history" });
      }

      // Initialize OpenAI client
      const openai = new OpenAI();

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: FAST_ONBOARDING_SYSTEM_PROMPT },
          ...conversationHistory.map((msg: any) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        throw new Error("No response from AI");
      }

      // Parse JSON response from AI
      let aiResponse;
      try {
        // Extract JSON from the response (handle markdown code blocks)
        const jsonMatch = responseContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                         responseContent.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseContent;
        aiResponse = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("[Onboarding] Failed to parse AI response:", responseContent);
        // Fallback response if parsing fails
        aiResponse = {
          reply: responseContent,
          extractedData: currentExtractedData || {},
          currentQuestion: 1,
          isComplete: false,
        };
      }

      // Save or update conversation in database
      const existing = await db
        .select()
        .from(onboardingConversations)
        .where(and(
          eq(onboardingConversations.userId, userId),
          eq(onboardingConversations.completed, false)
        ))
        .limit(1);

      const updatedConversation = [
        ...conversationHistory,
        { role: "assistant", content: aiResponse.reply }
      ];

      const mergedExtractedData = { ...currentExtractedData, ...aiResponse.extractedData };

      if (existing.length > 0) {
        await db
          .update(onboardingConversations)
          .set({
            conversationLog: updatedConversation,
            extractedData: mergedExtractedData,
            currentQuestion: aiResponse.currentQuestion,
          })
          .where(eq(onboardingConversations.id, existing[0].id));
      } else {
        await db.insert(onboardingConversations).values({
          userId,
          conversationLog: updatedConversation,
          extractedData: mergedExtractedData,
          currentQuestion: aiResponse.currentQuestion,
          completed: false,
        });
      }

      res.json({
        reply: aiResponse.reply,
        extractedData: aiResponse.extractedData,
        currentQuestion: aiResponse.currentQuestion,
        isComplete: aiResponse.isComplete,
      });
    } catch (error: any) {
      console.error("[Onboarding AI Chat] Error:", error);
      res.status(500).json({ 
        message: "Failed to process chat", 
        error: error.message 
      });
    }
  });

  // Get existing onboarding conversation (for resume)
  app.get("/api/onboarding/conversation", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const existing = await db
        .select()
        .from(onboardingConversations)
        .where(and(
          eq(onboardingConversations.userId, userId),
          eq(onboardingConversations.completed, false)
        ))
        .limit(1);

      if (existing.length > 0) {
        res.json({
          exists: true,
          conversation: existing[0],
        });
      } else {
        res.json({ exists: false });
      }
    } catch (error: any) {
      console.error("[Onboarding Get] Error:", error);
      res.status(500).json({ message: "Failed to get conversation" });
    }
  });

  // Complete fast onboarding and save profile
  app.post("/api/onboarding/complete", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const { profileData, conversationLog } = req.body;

      if (!profileData || !profileData.firstName || !profileData.age || !profileData.city || !profileData.gender) {
        return res.status(400).json({ 
          message: "Missing required fields (firstName, gender, age, city)" 
        });
      }

      // Validate age
      if (profileData.age < 18) {
        return res.status(400).json({ 
          message: "You must be 18 or older to use Fusion" 
        });
      }

      // Check if user already has a profile
      const existingProfile = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      const profileValues = {
        displayName: profileData.firstName,
        gender: profileData.gender,
        age: profileData.age,
        location: profileData.city,
        lookingFor: "Marriage" as const,
        onboardingMethod: "fast",
        // New comprehensive fields
        ethnicities: profileData.ethnicity ? [profileData.ethnicity] : [],
        maritalStatus: profileData.maritalStatus || "",
        hasChildren: profileData.hasChildren || false,
        wantsChildren: profileData.wantsChildren || "",
        education: profileData.education || "",
        occupation: profileData.occupation || "",
        profession: profileData.occupation || "",
        sect: profileData.sect || "",
        prayerFrequency: profileData.prayerFrequency || "",
        religiosity: profileData.religiosityRaw || "",
        bio: profileData.bio || "",
        // Store the raw looking for description for reference
        religiosityRaw: profileData.religiosityRaw,
        photos: [], // User will add photos next
        isComplete: false, // Profile not complete until photos added
        updatedAt: new Date(),
      };

      if (existingProfile.length > 0) {
        await db
          .update(profiles)
          .set(profileValues)
          .where(eq(profiles.userId, userId));
      } else {
        await db.insert(profiles).values({
          userId,
          ...profileValues,
        });
      }

      // Mark conversation as completed
      await db
        .update(onboardingConversations)
        .set({ 
          completed: true, 
          completedAt: new Date() 
        })
        .where(and(
          eq(onboardingConversations.userId, userId),
          eq(onboardingConversations.completed, false)
        ));

      console.log(`[Onboarding Complete] User ${userId} completed fast onboarding`);

      res.json({ 
        success: true, 
        message: "Profile data saved successfully",
        nextStep: "photos", // User needs to add photos next
      });
    } catch (error: any) {
      console.error("[Onboarding Complete] Error:", error);
      res.status(500).json({ 
        message: "Failed to save profile", 
        error: error.message 
      });
    }
  });

  // Clear onboarding conversation (start over)
  app.delete("/api/onboarding/conversation", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      await db
        .delete(onboardingConversations)
        .where(and(
          eq(onboardingConversations.userId, userId),
          eq(onboardingConversations.completed, false)
        ));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Onboarding Clear] Error:", error);
      res.status(500).json({ message: "Failed to clear conversation" });
    }
  });

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

    // Get IDs of already swiped profiles
    const alreadySwiped = await db
      .select({ swipedId: swipes.swipedId })
      .from(swipes)
      .where(eq(swipes.swiperId, userId));

    const swipedIds = alreadySwiped.map((s) => s.swipedId);

    // Get profiles to show (opposite gender, not self, not already swiped, active profiles)
    // Fetch more than needed to allow for distance sorting
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
      .limit(100); // Fetch more to allow sorting

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
        .limit(100);
    }

    // Sort by distance if user has coordinates
    let result: (ProfileWithUser & { distance?: number })[] = discoverProfiles.map((dp) => ({
      ...dp.profile,
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

    // Return top 20 profiles
    res.json(result.slice(0, 20));
  });

  // AI-Powered Suggestions endpoint - get compatible profiles with compatibility scores
  app.get("/api/suggestions", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      // Check cache first (5-minute TTL) - massive performance boost
      const cacheKey = `suggestions:${userId}`;
      const cached = getCached<any[]>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

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

      // Cache for 5 minutes (300 seconds) - reduces 2.2s load to instant
      setCached(cacheKey, topSuggestions, 300);

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

    console.log(`[SWIPE] User ${userId} swiped ${direction} on ${swipedId}`);

    if (!swipedId || !direction) {
      return res.status(400).json({ message: "Missing swipedId or direction" });
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

    // Record the swipe
    await db.insert(swipes).values({
      swiperId: userId,
      swipedId,
      direction,
    });

    // Invalidate suggestions cache since user's available profiles changed
    deleteCached(`suggestions:${userId}`);

    let isMatch = false;

    // If this is a right swipe, check for mutual match
    if (direction === "right") {
      console.log(`[SWIPE] Checking for mutual match between ${userId} and ${swipedId}`);
      
      // Debug: Show all swipes from the other user
      const allSwipesFromOther = await db
        .select()
        .from(swipes)
        .where(eq(swipes.swiperId, swipedId));
      console.log(`[SWIPE DEBUG] All swipes from ${swipedId}:`, JSON.stringify(allSwipesFromOther));
      
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

      console.log(`[SWIPE DEBUG] Mutual swipe lookup result:`, mutualSwipe ? JSON.stringify(mutualSwipe) : 'null');

      if (mutualSwipe) {
        console.log(`[SWIPE] Found mutual swipe! Creating match...`);
        
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

          console.log(`[SWIPE] Subscription check - Current: ${currentUserHasSubscription}, Other: ${otherUserHasSubscription}`);

          // For testing: Allow all matches regardless of subscription
          // In production, only create match if at least one user has an active subscription
          const allowAllMatches = true; // Set to false in production
          if (allowAllMatches || currentUserHasSubscription || otherUserHasSubscription) {
            try {
              const [newMatch] = await db.insert(matches).values({
                user1Id: userId,
                user2Id: swipedId,
              }).returning();
              isMatch = true;
              console.log(`[MATCH] ✅ Created match ${newMatch.id} between ${userId} and ${swipedId}`);
              
              // Create Sendbird channel for the match
              try {
                // First ensure both users exist in Sendbird
                const [profile1] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
                const [profile2] = await db.select().from(profiles).where(eq(profiles.userId, swipedId)).limit(1);
                
                await SendbirdService.createOrUpdateUser({
                  userId: userId,
                  nickname: profile1?.displayName || currentUser?.firstName || 'User',
                  profileUrl: profile1?.photos?.[0] || undefined,
                });
                console.log(`[Sendbird] Created/updated user ${userId} for match`);
                
                await SendbirdService.createOrUpdateUser({
                  userId: swipedId,
                  nickname: profile2?.displayName || otherUser?.firstName || 'User',
                  profileUrl: profile2?.photos?.[0] || undefined,
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
  // Get all conversations with latest message
  // OPTIMIZED: Single SQL query with JOINs - eliminates N+1 query problem
  app.get("/api/conversations", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const startTime = Date.now();

      // CRITICAL FIX: Use single SQL query with subqueries to fetch everything at once
      // This replaces the N+1 query pattern that caused 1.5M queries at scale
      const conversationsRaw = await db.execute(sql`
        WITH latest_messages AS (
          SELECT DISTINCT ON (match_id)
            id, match_id, sender_id, receiver_id, content, message_type, 
            call_duration, is_read, created_at
          FROM messages
          ORDER BY match_id, created_at DESC
        ),
        unread_counts AS (
          SELECT 
            match_id,
            COUNT(*) as unread_count
          FROM messages
          WHERE receiver_id = ${userId} AND is_read = false
          GROUP BY match_id
        )
        SELECT 
          m.id as match_id,
          m.created_at as match_created_at,
          m.user1_id,
          m.user2_id,
          -- Other user's profile (conditional based on who is viewing)
          CASE 
            WHEN m.user1_id = ${userId} THEN p2.user_id
            ELSE p1.user_id
          END as other_user_id,
          CASE 
            WHEN m.user1_id = ${userId} THEN p2.display_name
            ELSE p1.display_name
          END as other_full_name,
          CASE 
            WHEN m.user1_id = ${userId} THEN p2.age
            ELSE p1.age
          END as other_dob,
          CASE 
            WHEN m.user1_id = ${userId} THEN p2.gender
            ELSE p1.gender
          END as other_gender,
          CASE 
            WHEN m.user1_id = ${userId} THEN p2.location
            ELSE p1.location
          END as other_location,
          CASE 
            WHEN m.user1_id = ${userId} THEN p2.photos
            ELSE p1.photos
          END as other_photos,
          CASE 
            WHEN m.user1_id = ${userId} THEN p2.bio
            ELSE p1.bio
          END as other_bio,
          CASE 
            WHEN m.user1_id = ${userId} THEN p2.profession
            ELSE p1.profession
          END as other_profession,
          CASE 
            WHEN m.user1_id = ${userId} THEN p2.photo_verified
            ELSE p1.photo_verified
          END as other_face_verified,
          CASE 
            WHEN m.user1_id = ${userId} THEN u2.email
            ELSE u1.email
          END as other_email,
          CASE 
            WHEN m.user1_id = ${userId} THEN (u2.subscription_status = 'active')
            ELSE (u1.subscription_status = 'active')
          END as other_is_premium,
          -- Latest message
          lm.id as latest_message_id,
          lm.content as latest_message_content,
          lm.message_type as latest_message_type,
          lm.created_at as latest_message_created_at,
          lm.sender_id as latest_message_sender_id,
          lm.is_read as latest_message_is_read,
          -- Unread count
          COALESCE(uc.unread_count, 0) as unread_count
        FROM matches m
        LEFT JOIN profiles p1 ON m.user1_id = p1.user_id
        LEFT JOIN users u1 ON p1.user_id = u1.id
        LEFT JOIN profiles p2 ON m.user2_id = p2.user_id
        LEFT JOIN users u2 ON p2.user_id = u2.id
        LEFT JOIN latest_messages lm ON m.id = lm.match_id
        LEFT JOIN unread_counts uc ON m.id = uc.match_id
        WHERE m.user1_id = ${userId} OR m.user2_id = ${userId}
        ORDER BY COALESCE(lm.created_at, m.created_at) DESC
      `);

      // Transform raw SQL results into proper structure
      const conversations = conversationsRaw.rows.map((row: any) => ({
        matchId: row.match_id,
        otherUser: {
          userId: row.other_user_id,
          fullName: row.other_full_name,
          dateOfBirth: row.other_dob,
          gender: row.other_gender,
          location: row.other_location,
          photos: row.other_photos,
          bio: row.other_bio,
          profession: row.other_profession,
          faceVerified: row.other_face_verified,
          user: {
            email: row.other_email,
            isPremium: row.other_is_premium,
          }
        },
        latestMessage: row.latest_message_id ? {
          id: row.latest_message_id,
          content: row.latest_message_content,
          messageType: row.latest_message_type,
          createdAt: row.latest_message_created_at,
          senderId: row.latest_message_sender_id,
          isRead: row.latest_message_is_read,
        } : null,
        unreadCount: Number(row.unread_count),
        matchCreatedAt: row.match_created_at,
      }));

      const duration = Date.now() - startTime;
      console.log(`[Conversations] Fetched ${conversations.length} conversations in ${duration}ms (optimized single query)`);

      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

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

  // OPTIMIZED: Async moderation + in-memory rate limiting
  app.post("/api/messages", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const startTime = Date.now();

    try {
      const validatedData = insertMessageSchema.parse(req.body);

      // OPTIMIZATION 1: Client-side pre-filtering (catches 90% of bad content instantly)
      const { preFilterMessage, moderateMessageAsync, shouldRateLimit } = await import("./contentModeration");
      const { getMessageCount, incrementMessageCount } = await import("./caching");
      
      const preFilterResult = preFilterMessage(validatedData.content);
      if (preFilterResult?.flagged) {
        console.warn(`[Message] Pre-filter blocked message from ${userId}:`, preFilterResult.category);
        return res.status(400).json({ 
          message: preFilterResult.message,
          category: preFilterResult.category 
        });
      }

      // Get user profile for verification
      const [userProfile] = await db
        .select({
          profile: profiles,
          user: users,
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (!userProfile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // OPTIMIZATION 2: Use in-memory cache for rate limiting (no DB query!)
      const accountAge = userProfile.user.createdAt 
        ? Math.floor((Date.now() - new Date(userProfile.user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      const messageCount = getMessageCount(userId);
      const rateLimitResult = shouldRateLimit(
        messageCount,
        accountAge,
        userProfile.profile.faceVerified || false
      );

      if (rateLimitResult.limited) {
        return res.status(429).json({ message: rateLimitResult.reason });
      }

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

      // OPTIMIZATION 3: Insert message IMMEDIATELY (don't wait for moderation)
      const [message] = await db
        .insert(messages)
        .values({
          ...validatedData,
          senderId: userId,
        })
        .returning();

      // Increment in-memory message counter
      incrementMessageCount(userId);

      // OPTIMIZATION 4: Broadcast message IMMEDIATELY to receiver
      broadcastToUser(validatedData.receiverId, {
        type: 'new_message',
        data: message,
      });

      const sendTime = Date.now() - startTime;
      console.log(`[Message] Sent in ${sendTime}ms (async moderation enabled)`);

      // OPTIMIZATION 5: Run OpenAI moderation in BACKGROUND (non-blocking)
      // If flagged, message will be deleted and users notified
      moderateMessageAsync(message.id, validatedData.content, async (messageId, moderationResult) => {
        console.warn(`[Message] Background moderation flagged message ${messageId}:`, moderationResult);
        
        // Delete the flagged message from database
        await db
          .delete(messages)
          .where(eq(messages.id, messageId));

        // Notify both users that message was removed
        broadcastToUser(userId, {
          type: 'message_removed',
          data: { 
            messageId,
            reason: moderationResult.message,
            category: moderationResult.category,
          },
        });

        broadcastToUser(validatedData.receiverId, {
          type: 'message_removed',
          data: { 
            messageId,
            reason: "Message removed by automated moderation",
          },
        });
      }).catch(err => {
        console.error(`[Message] Background moderation error for ${message.id}:`, err);
      });

      // Return immediately (moderation runs in background)
      res.json(message);
    } catch (error: any) {
      console.error("Error sending message:", error);
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

  // Unified Push Token Registration (supports web, FCM, and APNs)
  app.post("/api/push/register", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const validatedData = insertPushTokenSchema.parse({
        userId,
        ...req.body
      });

      // For web push, use endpoint as the unique identifier
      // For native push, use the token itself
      const tokenIdentifier = validatedData.type === 'web' 
        ? validatedData.endpoint 
        : validatedData.token;

      if (!tokenIdentifier) {
        return res.status(400).json({ message: "Token or endpoint required" });
      }

      // Check if this token already exists for this user
      const [existing] = await db
        .select()
        .from(pushTokens)
        .where(
          and(
            eq(pushTokens.userId, userId),
            eq(pushTokens.token, validatedData.token)
          )
        )
        .limit(1);

      if (existing) {
        // Update the existing token (mark as active, update timestamp)
        await db
          .update(pushTokens)
          .set({ 
            isActive: true, 
            updatedAt: new Date(),
            // Update web push keys if provided
            endpoint: validatedData.endpoint || existing.endpoint,
            auth: validatedData.auth || existing.auth,
            p256dh: validatedData.p256dh || existing.p256dh,
          })
          .where(eq(pushTokens.id, existing.id));
        
        return res.json({ message: "Push token updated" });
      }

      // Create new token registration
      await db.insert(pushTokens).values({
        userId,
        type: validatedData.type,
        token: validatedData.token,
        endpoint: validatedData.endpoint,
        auth: validatedData.auth,
        p256dh: validatedData.p256dh,
        deviceId: validatedData.deviceId,
        isActive: true,
      });

      res.json({ message: "Push token registered" });
    } catch (error: any) {
      console.error('Error registering push token:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Unregister push token
  app.post("/api/push/unregister", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    const { token, deviceId } = req.body;

    try {
      // If specific token provided, deactivate just that one
      if (token) {
        await db
          .update(pushTokens)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(pushTokens.userId, userId),
              eq(pushTokens.token, token)
            )
          );
      } else if (deviceId) {
        // Deactivate by device ID
        await db
          .update(pushTokens)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(pushTokens.userId, userId),
              eq(pushTokens.deviceId, deviceId)
            )
          );
      } else {
        // Deactivate all tokens for this user
        await db
          .update(pushTokens)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(pushTokens.userId, userId));
      }

      res.json({ message: "Push token unregistered" });
    } catch (error: any) {
      console.error('Error unregistering push token:', error);
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

      if (!firstName || !firstName.trim()) {
        return res.status(400).json({ message: "First name is required" });
      }

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

      // Create signup - start from 501 since we show 500 already signed up
      const position = currentCount + 501;
      const [signup] = await db
        .insert(earlySignups)
        .values({
          email: email.toLowerCase(),
          firstName: firstName || null,
          promoCode,
          position,
        })
        .returning();

      // Send welcome email with promo code
      try {
        const { sendEarlyAccessEmail } = await import('./email');
        await sendEarlyAccessEmail(email.toLowerCase(), firstName || null, promoCode, position);
        console.log(`[EarlySignup] Welcome email sent to ${email}`);
      } catch (emailError: any) {
        console.error(`[EarlySignup] Failed to send welcome email:`, emailError.message);
        // Don't fail the signup if email fails - they still get the promo code on screen
      }

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

  // DEVELOPMENT: Backfill Sendbird channels for existing matches
  app.post('/api/dev/backfill-channels', isAuthenticated, async (req: any, res: Response) => {
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
              profileUrl: profile1.photos?.[0] || undefined
            });
            console.log(`[BACKFILL] Created/updated Sendbird user: ${user1.id}`);
          }

          // Create user2 in Sendbird
          if (user2 && profile2) {
            await SendbirdService.createOrUpdateUser({
              userId: user2.id,
              nickname: profile2.displayName || user2.firstName || user2.email,
              profileUrl: profile2.photos?.[0] || undefined
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

  // DEVELOPMENT: Backfill Sendbird users for ALL existing users
  app.post('/api/dev/backfill-sendbird-users', isAuthenticated, async (req: any, res: Response) => {
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
            profileUrl: profile?.photos?.[0] || undefined,
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

  // ============== Feedback Routes ==============
  
  // Submit feedback
  app.post("/api/feedback", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    
    try {
      const validatedData = insertUserFeedbackSchema.parse(req.body);
      
      const [feedback] = await db
        .insert(userFeedback)
        .values({
          userId,
          ...validatedData,
        })
        .returning();
      
      res.status(201).json(feedback);
    } catch (error: any) {
      console.error("[Feedback] Error submitting feedback:", error);
      res.status(400).json({ message: error.message || "Failed to submit feedback" });
    }
  });
  
  // Get user's own feedback history
  app.get("/api/feedback", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;
    
    try {
      const feedbackList = await db
        .select()
        .from(userFeedback)
        .where(eq(userFeedback.userId, userId))
        .orderBy(desc(userFeedback.createdAt));
      
      res.json(feedbackList);
    } catch (error: any) {
      console.error("[Feedback] Error fetching feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
