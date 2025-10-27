import OpenAI from "openai";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface FaceVerificationResult {
  isFrontFacing: boolean;
  hasFace: boolean;
  confidence: number;
  message: string;
  details?: string;
}

/**
 * Verifies if an image contains a front-facing face suitable for profile verification
 * @param imageUrl - URL or base64 data URL of the image to verify
 * @returns Verification result with details
 */
export async function verifyFrontFacingPhoto(imageUrl: string): Promise<FaceVerificationResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o for vision capabilities
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image for profile verification purposes. You must:

1. Determine if there is a clear human face visible in the image
2. Check if the face is directly facing the camera (front-facing, not tilted, turned, or at an angle)
3. Assess the image quality and visibility

For a face to be considered "front-facing":
- The person should be looking directly at the camera
- Both eyes should be clearly visible
- The face should not be turned to the left or right (profile view)
- The head should not be tilted up or down significantly
- No extreme angles or side views

Respond in JSON format with:
{
  "hasFace": boolean (true if a human face is detected),
  "isFrontFacing": boolean (true only if the face is directly facing forward),
  "confidence": number (0-100, your confidence in this assessment),
  "details": string (brief explanation of why it is or isn't front-facing)
}`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(content);

    // Construct user-friendly message
    let message = "";
    if (!result.hasFace) {
      message = "No face detected in the image. Please upload a clear photo showing your face.";
    } else if (!result.isFrontFacing) {
      message = "Your face must be directly facing the camera. Please upload a front-facing photo for verification.";
    } else {
      message = "Photo verified! Your face is clearly visible and front-facing.";
    }

    return {
      hasFace: result.hasFace,
      isFrontFacing: result.isFrontFacing,
      confidence: result.confidence || 0,
      message,
      details: result.details
    };

  } catch (error: any) {
    console.error("Face verification error:", error);
    return {
      hasFace: false,
      isFrontFacing: false,
      confidence: 0,
      message: "Unable to verify photo. Please try again with a clear, front-facing photo.",
      details: error.message
    };
  }
}

/**
 * Verifies multiple photos, ensuring the first one is front-facing
 * @param photoUrls - Array of image URLs to verify
 * @returns Verification results for all photos
 */
export async function verifyProfilePhotos(photoUrls: string[]): Promise<{
  allValid: boolean;
  firstPhotoValid: boolean;
  results: FaceVerificationResult[];
  errorMessage?: string;
}> {
  if (!photoUrls || photoUrls.length === 0) {
    return {
      allValid: false,
      firstPhotoValid: false,
      results: [],
      errorMessage: "No photos provided"
    };
  }

  // Only verify the first photo (main profile photo)
  const firstPhotoResult = await verifyFrontFacingPhoto(photoUrls[0]);

  if (!firstPhotoResult.hasFace) {
    return {
      allValid: false,
      firstPhotoValid: false,
      results: [firstPhotoResult],
      errorMessage: "Your main profile photo must show your face clearly."
    };
  }

  if (!firstPhotoResult.isFrontFacing) {
    return {
      allValid: false,
      firstPhotoValid: false,
      results: [firstPhotoResult],
      errorMessage: "Your main profile photo must be a front-facing photo for verification purposes. Please ensure you're looking directly at the camera."
    };
  }

  return {
    allValid: true,
    firstPhotoValid: true,
    results: [firstPhotoResult],
  };
}
