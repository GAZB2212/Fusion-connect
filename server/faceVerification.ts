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
4. CRITICAL: Detect if this is a stock photo, professional model photo, or has visible watermarks
5. CRITICAL: Check for signs of a screenshot, low quality, or digitally altered image

For a face to be considered "front-facing":
- The person should be looking directly at the camera
- Both eyes should be clearly visible
- The face should not be turned to the left or right (profile view)
- The head should not be tilted up or down significantly
- No extreme angles or side views

REJECT the photo if:
- Any visible watermarks, logos, or text overlays are present
- The photo appears to be a stock photo or professional modeling shot
- The image looks like a screenshot or has been downloaded from the internet
- The photo quality is suspiciously perfect (professional studio lighting, heavy editing)
- Multiple people are visible in the photo
- The person is wearing sunglasses or face coverings

Respond in JSON format with:
{
  "hasFace": boolean (true if a human face is detected),
  "isFrontFacing": boolean (true only if the face is directly facing forward),
  "isStockPhoto": boolean (true if this appears to be a stock photo or professional modeling shot),
  "hasWatermark": boolean (true if any watermarks, logos, or text overlays are visible),
  "isScreenshot": boolean (true if this appears to be a screenshot or downloaded image),
  "confidence": number (0-100, your confidence in this assessment),
  "details": string (brief explanation of why it is or isn't acceptable)
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
    let isAcceptable = true;
    
    if (!result.hasFace) {
      message = "No face detected in the image. Please upload a clear photo showing your face.";
      isAcceptable = false;
    } else if (result.hasWatermark) {
      message = "This photo contains watermarks or text overlays. Please upload an original photo without watermarks.";
      isAcceptable = false;
    } else if (result.isStockPhoto) {
      message = "This appears to be a stock photo or professional modeling shot. Please upload a genuine personal photo.";
      isAcceptable = false;
    } else if (result.isScreenshot) {
      message = "This appears to be a screenshot or downloaded image. Please upload an original photo taken with your camera.";
      isAcceptable = false;
    } else if (!result.isFrontFacing) {
      message = "Your face must be directly facing the camera. Please upload a front-facing photo for verification.";
      isAcceptable = false;
    } else {
      message = "Photo verified! Your face is clearly visible and front-facing.";
    }

    return {
      hasFace: result.hasFace,
      isFrontFacing: result.isFrontFacing && isAcceptable,
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
    // Validate that both images are proper data URLs
    const validateDataUrl = (url: string): boolean => {
      return url.startsWith('data:image/') && url.includes('base64,');
    };

    if (!validateDataUrl(uploadedPhotoUrl)) {
      console.error("Invalid uploaded photo URL format");
      throw new Error("Uploaded photo is not in valid format");
    }

    if (!validateDataUrl(liveSelfieUrl)) {
      console.error("Invalid live selfie URL format");
      throw new Error("Live selfie is not in valid format");
    }

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
- Different lighting conditions are VERY NORMAL and expected
- Slight to moderate angle differences are ACCEPTABLE
- Different expressions (smiling vs neutral) are COMPLETELY NORMAL
- Different camera quality between photos is expected
- Focus on permanent facial features, not temporary ones (makeup, glasses, hair can vary)
- Mirror/flip differences are normal (selfies are often mirrored)
- Be REASONABLE - if the core facial features match, it's likely the same person
- Only reject if you see CLEAR evidence of different people (different bone structure, completely different features)

Respond in JSON format with:
{
  "isMatch": boolean (true if the core facial features match reasonably well),
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

    // Log the AI's decision for debugging
    console.log("Face comparison result:", {
      isMatch: result.isMatch,
      confidence: result.confidence,
      details: result.details
    });

    let message = "";
    if (result.isMatch) {
      message = "Verification successful! Your identity has been confirmed.";
    } else {
      message = `Verification failed. The photos do not appear to match. (Confidence: ${result.confidence}%)`;
    }

    return {
      isMatch: result.isMatch,
      confidence: result.confidence || 0,
      message,
      details: result.details
    };

  } catch (error: any) {
    console.error("Face comparison error:", error);
    
    // Provide more helpful error messages
    let userMessage = "Unable to verify photos. Please try again.";
    
    if (error.message.includes("not in valid format")) {
      userMessage = "Photo format error. Please retake your selfie and try again.";
    } else if (error.message.includes("API") || error.message.includes("network")) {
      userMessage = "Connection error. Please check your internet and try again.";
    }
    
    return {
      isMatch: false,
      confidence: 0,
      message: userMessage,
      details: error.message
    };
  }
}
