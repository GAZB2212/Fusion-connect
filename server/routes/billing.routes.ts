// Stripe subscriptions, checkout, webhooks, and promo codes
import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import Stripe from "stripe";
import { users, matches, earlySignups } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import { requireDev } from "./helpers";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

export function registerBillingRoutes(app: Express) {
  // DEVELOPMENT: Activate premium without payment (always available for testing)
  app.post('/api/dev/activate-premium', requireDev, isAuthenticated, async (req: any, res: Response) => {
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
      const { getOrCreatePriceId } = await import('../stripeSetup');
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
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else if (process.env.NODE_ENV === 'development') {
        // Local development without a webhook secret: accept unverified events
        event = JSON.parse(req.body);
        console.warn('⚠️  Webhook verification skipped (no STRIPE_WEBHOOK_SECRET, development only)');
      } else {
        // Never process unverified subscription events in production
        console.error('STRIPE_WEBHOOK_SECRET is not set — rejecting webhook');
        return res.status(500).send('Webhook not configured');
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
}
