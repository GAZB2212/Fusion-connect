// AI face verification
import type { Express, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { base64ToBuffer, r2Client, BUCKET_NAME } from "../r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { profiles } from "@shared/schema";
import OpenAI from "openai";
import { eq, and, or } from "drizzle-orm";
import { requireDev } from "./helpers";

export function registerVerificationRoutes(app: Express) {
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

      const { verifyFrontFacingPhoto } = await import("../faceVerification");
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
      const { getImageBufferFromR2Url, base64ToBuffer } = await import("../r2");
      
      // Fetch profile photo from R2 storage
      const uploadedPhotoBuffer = await getImageBufferFromR2Url(uploadedPhoto);
      
      // Convert live selfie from base64
      const liveSelfieBuffer = base64ToBuffer(liveSelfie);
      
      console.log(`[Compare Faces] Image buffers:`);
      console.log(`  - Uploaded photo buffer size: ${uploadedPhotoBuffer.length} bytes`);
      console.log(`  - Live selfie buffer size: ${liveSelfieBuffer.length} bytes`);

      // Use AWS Rekognition for robust face comparison
      const { compareFacesWithRekognition } = await import("../rekognitionService");
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
  app.post("/api/dev-verify", requireDev, isAuthenticated, async (req: any, res: Response) => {
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
}
