import {
  RekognitionClient,
  CompareFacesCommand,
  CompareFacesCommandInput,
} from "@aws-sdk/client-rekognition";

const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export interface FaceComparisonResult {
  isMatch: boolean;
  confidence: number;
  message: string;
  details?: string;
}

/**
 * Compare two faces using AWS Rekognition
 * @param sourceImageBuffer - Buffer of the source image (profile photo)
 * @param targetImageBuffer - Buffer of the target image (live selfie)
 * @param similarityThreshold - Minimum similarity percentage to consider a match (default: 85)
 */
export async function compareFacesWithRekognition(
  sourceImageBuffer: Buffer,
  targetImageBuffer: Buffer,
  similarityThreshold: number = 85
): Promise<FaceComparisonResult> {
  try {
    console.log("[Rekognition] Starting face comparison...");
    console.log(`[Rekognition] Source image size: ${sourceImageBuffer.length} bytes`);
    console.log(`[Rekognition] Target image size: ${targetImageBuffer.length} bytes`);

    const params: CompareFacesCommandInput = {
      SourceImage: {
        Bytes: sourceImageBuffer,
      },
      TargetImage: {
        Bytes: targetImageBuffer,
      },
      SimilarityThreshold: similarityThreshold,
    };

    const command = new CompareFacesCommand(params);
    const response = await rekognitionClient.send(command);

    console.log("[Rekognition] Response received:", {
      faceMatchesCount: response.FaceMatches?.length || 0,
      unmatchedFacesCount: response.UnmatchedFaces?.length || 0,
    });

    if (response.FaceMatches && response.FaceMatches.length > 0) {
      const bestMatch = response.FaceMatches[0];
      const similarity = bestMatch.Similarity || 0;

      console.log(`[Rekognition] MATCH FOUND - Similarity: ${similarity.toFixed(2)}%`);

      return {
        isMatch: true,
        confidence: Math.round(similarity),
        message: "Verification successful! Your identity has been confirmed.",
        details: `Face match confirmed with ${similarity.toFixed(1)}% similarity`,
      };
    } else {
      const sourceDetails = response.SourceImageFace;
      let failureReason = "The photos do not appear to show the same person.";
      
      if (!sourceDetails) {
        failureReason = "No face detected in your profile photo. Please upload a clearer photo.";
      } else if (response.UnmatchedFaces && response.UnmatchedFaces.length === 0) {
        failureReason = "No face detected in your selfie. Please ensure your face is clearly visible.";
      }

      console.log(`[Rekognition] NO MATCH - Reason: ${failureReason}`);

      return {
        isMatch: false,
        confidence: 0,
        message: failureReason,
        details: "Face comparison did not find a sufficient match",
      };
    }
  } catch (error: any) {
    console.error("[Rekognition] Error:", error);

    let userMessage = "Unable to verify photos. Please try again.";
    let details = error.message;

    if (error.name === "InvalidParameterException") {
      if (error.message.includes("source")) {
        userMessage = "Could not detect a face in your profile photo. Please upload a clearer photo showing your face.";
      } else if (error.message.includes("target")) {
        userMessage = "Could not detect a face in your selfie. Please ensure your face is clearly visible and well-lit.";
      } else {
        userMessage = "Could not detect faces in the photos. Please ensure both photos clearly show your face.";
      }
    } else if (error.name === "ImageTooLargeException") {
      userMessage = "Photo is too large. Please try with a smaller image.";
    } else if (error.name === "InvalidImageFormatException") {
      userMessage = "Invalid image format. Please use a JPEG or PNG photo.";
    } else if (error.name === "CredentialsProviderError" || error.message.includes("credentials")) {
      userMessage = "Verification service not configured. Please contact support.";
      console.error("[Rekognition] AWS credentials not configured properly");
    }

    return {
      isMatch: false,
      confidence: 0,
      message: userMessage,
      details: details,
    };
  }
}
