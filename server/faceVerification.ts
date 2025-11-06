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
2. Check if the face is reasonably facing the camera (front or slightly angled is OK)
3. Assess the image quality and visibility
4. Check for obvious watermarks or company logos (NOT personal text/captions)
5. Detect obvious screenshots with visible UI elements

For a face to be considered "front-facing":
- The person should be generally looking toward the camera (slight angles are ACCEPTABLE)
- At least one eye should be clearly visible
- The face should not be a full side profile (some angle is fine)
- Moderate head tilts are ACCEPTABLE
- Natural selfie angles are PERFECTLY FINE

ONLY REJECT the photo if:
- Obvious watermarks from stock photo companies (Shutterstock, Getty Images, etc.)
- Clear evidence of being a celebrity or model photo from a magazine/advertisement
- Screenshot with visible UI elements (status bars, app interfaces)
- The person is wearing full sunglasses covering both eyes
- No face is visible at all
- Multiple people are in the photo making it unclear who the profile belongs to

BE LENIENT - Normal selfies, even with good lighting or filters, are ACCEPTABLE. Only flag obvious fake/stock photos.

Respond in JSON format with:
{
  "hasFace": boolean (true if a human face is detected),
  "isFrontFacing": boolean (true if face is visible and generally forward-facing),
  "isStockPhoto": boolean (true ONLY if clearly a stock photo with watermarks or professional modeling shot),
  "hasWatermark": boolean (true ONLY if obvious stock photo watermarks visible),
  "isScreenshot": boolean (true ONLY if clear screenshot with UI elements),
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

    // Log the full result for debugging
    console.log("Front-facing photo verification result:", {
      hasFace: result.hasFace,
      isFrontFacing: result.isFrontFacing,
      isStockPhoto: result.isStockPhoto,
      hasWatermark: result.hasWatermark,
      isScreenshot: result.isScreenshot,
      confidence: result.confidence,
      details: result.details
    });

    // Construct user-friendly message
    let message = "";
    let isAcceptable = true;
    
    if (!result.hasFace) {
      message = "No face detected in the image. Please upload a clear photo showing your face.";
      isAcceptable = false;
      console.log("Verification FAILED: No face detected");
    } else if (result.hasWatermark) {
      message = "This photo contains watermarks. Please upload an original photo without watermarks.";
      isAcceptable = false;
      console.log("Verification FAILED: Watermark detected");
    } else if (result.isStockPhoto) {
      message = "This appears to be a stock photo. Please upload a genuine personal photo.";
      isAcceptable = false;
      console.log("Verification FAILED: Stock photo detected");
    } else if (result.isScreenshot) {
      message = "This appears to be a screenshot. Please upload an original photo taken with your camera.";
      isAcceptable = false;
      console.log("Verification FAILED: Screenshot detected");
    } else if (!result.isFrontFacing) {
      message = "Please try a photo where your face is more visible and facing the camera.";
      isAcceptable = false;
      console.log("Verification FAILED: Not front-facing");
    } else {
      message = "Photo verified! Your face is clearly visible.";
      console.log("Verification PASSED");
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

BE VERY LENIENT - Important considerations:
- Different lighting conditions are EXTREMELY NORMAL and expected (can dramatically change appearance)
- Slight to moderate angle differences are COMPLETELY ACCEPTABLE
- Different expressions (smiling vs neutral) are PERFECTLY NORMAL
- Different camera quality, resolution, and distance from camera is expected
- Focus on permanent facial features, not temporary ones (makeup, glasses, hair, facial hair can ALL vary significantly)
- Mirror/flip differences are normal (selfies are often mirrored)
- Clothing, background, and photo quality DO NOT matter at all
- Time between photos can cause weight/appearance changes - this is NORMAL
- Be GENEROUS - if the general facial structure and key features seem similar, approve it
- Only reject if you see OBVIOUS evidence of completely different people (drastically different bone structure, totally different facial proportions)

Your default should be to APPROVE unless there's clear evidence these are different people.

Respond in JSON format with:
{
  "isMatch": boolean (true if the core facial features match reasonably well - BE LENIENT),
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
