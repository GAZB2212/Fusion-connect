import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import crypto from 'crypto';
import type { Readable } from 'stream';

/**
 * Get the base URL for the application
 * Uses REPLIT_DOMAINS in production, falls back to localhost for development
 */
export function getBaseUrl(): string {
  // Check for production domains
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    // Prefer the published domain (usually the first one without -00-)
    const productionDomain = domains.find(d => !d.includes('-00-')) || domains[0];
    return `https://${productionDomain}`;
  }
  
  // Development fallback
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  return 'http://localhost:5000';
}

/**
 * Convert a relative URL to absolute URL for mobile app compatibility
 */
export function toAbsoluteUrl(relativeUrl: string): string {
  if (!relativeUrl) return relativeUrl;
  
  // Already absolute
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  
  // Convert relative to absolute
  const baseUrl = getBaseUrl();
  return `${baseUrl}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
}

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

// Export for use in routes
export { r2Client, BUCKET_NAME };

/**
 * Upload a photo to Cloudflare R2
 * @param buffer - Image buffer to upload
 * @param contentType - MIME type (e.g., 'image/jpeg', 'image/png')
 * @param userId - User ID for organizing files
 * @param photoType - Type of photo ('profile', 'verification', etc.)
 * @returns Public URL of the uploaded photo
 */
export async function uploadPhotoToR2(
  buffer: Buffer,
  contentType: string,
  userId: string,
  photoType: 'profile' | 'verification' = 'profile'
): Promise<string> {
  // Generate unique filename
  const fileExtension = contentType.split('/')[1] || 'jpg';
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const fileName = `${photoType}/${userId}/${uniqueId}.${fileExtension}`;

  try {
    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });

    await upload.done();

    // Return absolute URL for mobile app compatibility
    const publicUrl = toAbsoluteUrl(`/api/images/${fileName}`);
    
    console.log(`[R2 Upload] Successfully uploaded ${fileName}`);
    return publicUrl;
  } catch (error) {
    console.error('[R2 Upload] Failed to upload photo:', error);
    throw new Error('Failed to upload photo to storage');
  }
}

/**
 * Upload a video to Cloudflare R2
 * @param buffer - Video buffer to upload
 * @param contentType - MIME type (e.g., 'video/mp4', 'video/webm')
 * @param userId - User ID for organizing files
 * @returns Public URL of the uploaded video
 */
export async function uploadVideoToR2(
  buffer: Buffer,
  contentType: string,
  userId: string
): Promise<string> {
  // Generate unique filename
  const fileExtension = contentType.split('/')[1] || 'mp4';
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const fileName = `video/${userId}/${uniqueId}.${fileExtension}`;

  try {
    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });

    await upload.done();

    // Return absolute URL for mobile app compatibility
    const publicUrl = toAbsoluteUrl(`/api/images/${fileName}`);
    
    console.log(`[R2 Upload] Successfully uploaded video ${fileName}`);
    return publicUrl;
  } catch (error) {
    console.error('[R2 Upload] Failed to upload video:', error);
    throw new Error('Failed to upload video to storage');
  }
}

/**
 * Delete a photo from Cloudflare R2
 * @param photoUrl - URL of the photo to delete (can be /api/images/... or full URL)
 */
export async function deletePhotoFromR2(photoUrl: string): Promise<void> {
  try {
    // Extract the file key from the URL
    let fileName: string;
    
    if (photoUrl.startsWith('/api/images/')) {
      // New format: /api/images/profile/userId/filename.jpg
      fileName = photoUrl.replace('/api/images/', '');
    } else {
      // Legacy format: https://www.fusioncouples.com/profile/userId/filename.jpg
      const urlParts = photoUrl.split('/');
      fileName = urlParts.slice(3).join('/'); // Everything after domain
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
    });

    await r2Client.send(command);
    console.log(`[R2 Delete] Successfully deleted ${fileName}`);
  } catch (error) {
    console.error('[R2 Delete] Failed to delete photo:', error);
    throw new Error('Failed to delete photo from storage');
  }
}

/**
 * Convert base64 string to Buffer
 * @param base64String - Base64 encoded image or video string
 * @returns Buffer
 */
export function base64ToBuffer(base64String: string): Buffer {
  // Remove data URL prefix if present (e.g., "data:image/jpeg;base64," or "data:video/mp4;base64,")
  const base64Data = base64String.replace(/^data:(image|video)\/[\w+]+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Detect content type from base64 string
 * @param base64String - Base64 encoded image or video string
 * @returns MIME type
 */
export function detectContentType(base64String: string): string {
  const match = base64String.match(/^data:((image|video)\/[\w+]+);base64,/);
  return match ? match[1] : 'image/jpeg'; // Default to JPEG
}

/**
 * Get an object from R2 as a Buffer
 * @param key - The file key in R2
 * @returns Buffer of the file contents
 */
export async function getObjectFromR2(key: string): Promise<Buffer> {
  console.log(`[R2 Get] Attempting to fetch object with key: ${key}`);
  console.log(`[R2 Get] Using bucket: ${BUCKET_NAME}`);
  
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);
    
    if (!response.Body) {
      console.error(`[R2 Get] No body in response for key: ${key}`);
      throw new Error("No body in R2 response");
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk));
    }
    
    const buffer = Buffer.concat(chunks);
    console.log(`[R2 Get] Successfully fetched object, size: ${buffer.length} bytes`);
    return buffer;
  } catch (error: any) {
    console.error(`[R2 Get] Failed to get object with key "${key}":`, error.message);
    console.error(`[R2 Get] Error name: ${error.name}, Code: ${error.Code || 'N/A'}`);
    
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
      throw new Error(`Object not found in storage: ${key}`);
    }
    
    throw new Error(`Failed to get object from storage: ${error.message}`);
  }
}

/**
 * Get image buffer from R2 URL
 * @param photoUrl - The photo URL (e.g., /api/images/profile/userId/filename.jpg)
 * @returns Buffer of the image
 */
export async function getImageBufferFromR2Url(photoUrl: string): Promise<Buffer> {
  console.log(`[R2 getImageBufferFromR2Url] Processing URL: ${photoUrl.substring(0, 100)}...`);
  
  // Extract the file key from the URL
  let fileKey: string;
  
  // Handle relative URL: /api/images/profile/userId/filename.jpg
  if (photoUrl.startsWith('/api/images/')) {
    fileKey = photoUrl.replace('/api/images/', '');
    console.log(`[R2 getImageBufferFromR2Url] Relative URL format, extracted key: ${fileKey}`);
  } 
  // Handle base64 data URL
  else if (photoUrl.startsWith('data:image/')) {
    console.log(`[R2 getImageBufferFromR2Url] Base64 data URL detected, converting directly`);
    return base64ToBuffer(photoUrl);
  } 
  // Handle absolute URL with /api/images/ in path (e.g., https://domain.com/api/images/profile/...)
  else if (photoUrl.includes('/api/images/')) {
    const apiImagesIndex = photoUrl.indexOf('/api/images/');
    fileKey = photoUrl.substring(apiImagesIndex + '/api/images/'.length);
    console.log(`[R2 getImageBufferFromR2Url] Absolute URL with /api/images/, extracted key: ${fileKey}`);
  }
  // Handle direct HTTPS URLs (external images) - fetch via HTTP
  else if (photoUrl.startsWith('https://')) {
    console.log(`[R2 getImageBufferFromR2Url] External HTTPS URL detected, fetching via HTTP`);
    try {
      const response = await fetch(photoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      console.error(`[R2 getImageBufferFromR2Url] Failed to fetch external URL:`, error.message);
      throw new Error(`Failed to fetch image from external URL: ${error.message}`);
    }
  }
  // Legacy format - try to extract key from URL path
  else {
    const urlParts = photoUrl.split('/');
    fileKey = urlParts.slice(3).join('/');
    console.log(`[R2 getImageBufferFromR2Url] Legacy format, extracted key: ${fileKey}`);
  }
  
  console.log(`[R2 getImageBufferFromR2Url] Fetching from R2 with key: ${fileKey}`);
  return getObjectFromR2(fileKey);
}
