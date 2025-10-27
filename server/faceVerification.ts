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
 * Compares two face images to verify they are the same person
 * @param uploadedPhotoUrl - The profile photo uploaded by user
 * @param liveSelfieUrl - The live selfie taken for verification
 * @returns Verification result indicating if photos match
 */
export async function compareFaces(uploadedPhotoUrl: string, liveSelfieUrl: string): Promise<{
  isMatch: boolean;
  confidence: number;
  message: string;
  details?: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o for vision capabilities
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a face verification system. Compare these two images to determine if they show the same person.

Image 1: Profile photo (uploaded by user)
Image 2: Live selfie (taken for verification)

Your task:
1. Analyze both faces carefully
2. Compare facial features: eyes, nose, mouth, face shape, skin tone, etc.
3. Account for different lighting, angles, and expressions
4. Determine if this is the SAME PERSON in both photos

Important considerations:
- Different lighting conditions are normal
- Slight angle differences are acceptable
- Different expressions (smiling vs neutral) are normal
- Focus on permanent facial features, not temporary ones (makeup, glasses can vary)
- Be strict - only match if you're confident it's the same person

Respond in JSON format with:
{
  "isMatch": boolean (true only if you're confident these are the same person),
  "confidence": number (0-100, your confidence in this assessment),
  "details": string (brief explanation of key similarities or differences you noticed)
}`
            },
            {
              type: "image_url",
              image_url: {
                url: uploadedPhotoUrl,
                detail: "high"
              }
            },
            {
              type: "image_url",
              image_url: {
                url: liveSelfieUrl,
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

    let message = "";
    if (result.isMatch) {
      message = "Verification successful! Your identity has been confirmed.";
    } else {
      message = "Verification failed. The photos do not appear to match. Please upload photos of yourself.";
    }

    return {
      isMatch: result.isMatch,
      confidence: result.confidence || 0,
      message,
      details: result.details
    };

  } catch (error: any) {
    console.error("Face comparison error:", error);
    return {
      isMatch: false,
      confidence: 0,
      message: "Unable to verify photos. Please try again.",
      details: error.message
    };
  }
}
