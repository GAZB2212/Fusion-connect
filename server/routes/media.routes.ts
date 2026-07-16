// Photo/video upload and the R2 image proxy
import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  uploadPhotoToR2,
  uploadVideoToR2,
  base64ToBuffer,
  detectContentType,
  r2Client,
  BUCKET_NAME,
} from "../r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { profiles } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { upload } from "./helpers";

export function registerMediaRoutes(app: Express) {
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

      // Set appropriate headers for mobile app compatibility
      res.set('Content-Type', response.ContentType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
      
      // Add Cross-Origin headers for Capacitor app
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');

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
    const { video, mimeType: explicitMimeType } = req.body;

    if (!video) {
      return res.status(400).json({ message: "No video data provided" });
    }

    try {
      // Log the first 100 chars to debug MIME type detection
      console.log(`[Video Upload] Received video data prefix: ${video.substring(0, 100)}`);
      console.log(`[Video Upload] Explicit mimeType from client: ${explicitMimeType}`);
      
      // Check video size (rough estimate from base64 length - max 20MB)
      const estimatedSize = (video.length * 3) / 4;
      const maxSize = 20 * 1024 * 1024; // 20MB
      
      if (estimatedSize > maxSize) {
        return res.status(400).json({ message: "Video too large. Maximum size is 20MB." });
      }

      const buffer = base64ToBuffer(video);
      let contentType = detectContentType(video);
      
      console.log(`[Video Upload] Detected content type from data URL: ${contentType}`);
      
      // Use explicit mimeType from client if detection fails or returns non-video
      if (!contentType.startsWith('video/') && explicitMimeType && explicitMimeType.startsWith('video/')) {
        console.log(`[Video Upload] Using explicit mimeType from client: ${explicitMimeType}`);
        contentType = explicitMimeType;
      }
      
      // Final fallback: assume video/mp4 if it's from a native upload (has mimeType param)
      if (!contentType.startsWith('video/') && explicitMimeType) {
        console.log(`[Video Upload] Falling back to video/mp4 for native upload`);
        contentType = 'video/mp4';
      }
      
      console.log(`[Video Upload] Final content type: ${contentType}`);
      
      // Verify it's a video
      if (!contentType.startsWith('video/')) {
        console.log(`[Video Upload] Invalid content type: ${contentType}, expected video/*`);
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
}
