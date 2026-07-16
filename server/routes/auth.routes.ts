// Registration, login, and password management
import type { Express, Request, Response } from "express";
import { isAuthenticated, generateToken } from "../auth";
import { db } from "../db";
import { SendbirdService } from "../sendbird";
import passport from "passport";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "../email";
import { users, passwordResetTokens, registerUserSchema, loginSchema } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";

export function registerAuthRoutes(app: Express) {
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
        // Generate JWT token for mobile app support
        const token = generateToken(newUser.id);
        res.json({ user: userWithoutPassword, token });
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
        // Generate JWT token for mobile app support
        const token = generateToken(user.id);
        res.json({ user, token });
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
}
