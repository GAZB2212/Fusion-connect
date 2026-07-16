// Admin seeding, early signup, QR codes, and feedback
import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import bcrypt from "bcrypt";
import QRCode from "qrcode";
import { createCanvas, loadImage } from "canvas";
import {
  users,
  profiles,
  earlySignups,
  userFeedback,
  insertUserFeedbackSchema,
  type EarlySignup,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export function registerMiscRoutes(app: Express) {
  // ADMIN: Seed demo profiles for testing. Disabled unless ADMIN_SEED_KEY is
  // explicitly configured — never enable this on a production database.
  app.post('/api/admin/seed-demo-profiles', async (req: Request, res: Response) => {
    const { adminKey } = req.body;

    if (!process.env.ADMIN_SEED_KEY || adminKey !== process.env.ADMIN_SEED_KEY) {
      return res.status(404).json({ message: "Not found" });
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
        const { sendEarlyAccessEmail } = await import('../email');
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
}
