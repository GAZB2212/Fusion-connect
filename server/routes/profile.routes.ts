// Profile CRUD
import type { Express, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  profiles,
  insertProfileSchema,
  type Profile,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { profileWithAbsoluteUrls } from "./helpers";

// Member-facing names for profile fields, used in validation messages.
const PROFILE_FIELD_LABELS: Record<string, string> = {
  displayName: "your name",
  age: "your age",
  gender: "your gender",
  location: "your location",
  photos: "your photos",
  bio: "your bio",
  lookingFor: "what you're looking for",
};

export function registerProfileRoutes(app: Express) {
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

    // Convert relative URLs to absolute for mobile app compatibility
    res.json(profileWithAbsoluteUrls(profile));
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

        return res.json(profileWithAbsoluteUrls(profile));
      }

      // Create new profile
      const [profile] = await db
        .insert(profiles)
        .values({
          ...validatedData,
          userId: userId,
          isComplete: true,
        } as any)
        .returning();

      res.json(profileWithAbsoluteUrls(profile));
    } catch (error: any) {
      // Return a clean, human message — never the raw Zod error JSON (which
      // surfaced in the app as a wall of "gobbledygook" code).
      if (error?.name === "ZodError" && Array.isArray(error.issues)) {
        const first = error.issues[0];
        const field = String(first?.path?.[0] ?? "");
        const label = PROFILE_FIELD_LABELS[field] || field || "your details";
        // Zod's built-in messages ("Required", "Expected number…") mean nothing
        // to a member — name the field instead. Custom messages pass through.
        const generic = !first?.message || /^(Required|Expected|Invalid)/.test(first.message);
        return res.status(400).json({
          message: generic ? `Please check ${label} and try again.` : first.message,
        });
      }
      console.error("[Profile] Save error:", error);
      res.status(400).json({ message: "Couldn't save your profile. Please try again." });
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

    res.json(profileWithAbsoluteUrls(profile));
  });
}
