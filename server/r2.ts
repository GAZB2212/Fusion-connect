import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import crypto from 'crypto';

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

    // Return public URL using R2.dev subdomain
    // Format: https://pub-<account_id>.r2.dev/<bucket_name>/<file_path>
    const publicUrl = `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${BUCKET_NAME}/${fileName}`;
    
    console.log(`[R2 Upload] Successfully uploaded ${fileName}`);
    return publicUrl;
  } catch (error) {
    console.error('[R2 Upload] Failed to upload photo:', error);
    throw new Error('Failed to upload photo to storage');
  }
}

/**
 * Delete a photo from Cloudflare R2
 * @param photoUrl - Full URL of the photo to delete
 */
export async function deletePhotoFromR2(photoUrl: string): Promise<void> {
  try {
    // Extract the file key from the URL
    const urlParts = photoUrl.split('/');
    const fileName = urlParts.slice(3).join('/'); // Everything after domain

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
 * @param base64String - Base64 encoded image string
 * @returns Buffer
 */
export function base64ToBuffer(base64String: string): Buffer {
  // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Detect content type from base64 string
 * @param base64String - Base64 encoded image string
 * @returns MIME type
 */
export function detectContentType(base64String: string): string {
  const match = base64String.match(/^data:(image\/\w+);base64,/);
  return match ? match[1] : 'image/jpeg'; // Default to JPEG
}
