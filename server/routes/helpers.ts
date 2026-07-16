import multer from "multer";
import type { RequestHandler } from "express";
import { toAbsoluteUrl } from "../r2";

/**
 * Convert all photo/video URLs in a profile to absolute URLs for mobile app compatibility
 */
export function profileWithAbsoluteUrls<T extends { photos?: string[] | null; videoIntroUrl?: string | null }>(profile: T): T {
  if (!profile) return profile;

  return {
    ...profile,
    photos: profile.photos?.map(url => toAbsoluteUrl(url)) || null,
    videoIntroUrl: profile.videoIntroUrl ? toAbsoluteUrl(profile.videoIntroUrl) : null,
  };
}

// Guard for development/testing-only endpoints. In production these
// return 404 so they are indistinguishable from routes that don't exist.
export const requireDev: RequestHandler = (_req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    return next();
  }
  res.status(404).json({ message: "Not found" });
};

// Shared multer instance for photo uploads (memory storage)
export const upload = multer({
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

// Separate instance for voice-note transcription — the photo instance's
// image-only fileFilter rejects audio uploads
export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // Whisper API accepts up to 25MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});
