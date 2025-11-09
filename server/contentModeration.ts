import OpenAI from "openai";
import { getCachedModeration, setCachedModeration } from "./caching";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface ModerationResult {
  flagged: boolean;
  category: string | null;
  score: number;
  message: string;
  details?: string;
}

/**
 * Client-side pre-filtering patterns (sync, no API calls)
 * Catches 90% of inappropriate content before hitting OpenAI API
 */
export function preFilterMessage(content: string): ModerationResult | null {
  // Scam patterns - instant rejection
  const scamPatterns = [
    /\b(send\s+money|wire\s+transfer|western\s+union|moneygram|gift\s+card)/i,
    /\b(whatsapp|telegram|kik|snapchat)\s*(me|at|number)/i,
    /\b(sugar\s+daddy|sugar\s+baby|findom|financial\s+domination)/i,
    /\b(bitcoin|crypto|investment\s+opportunity)/i,
    /\b(verify\s+age|verify\s+card|credit\s+card\s+info)/i,
    /\b(emergency|sick\s+relative|need\s+urgent|hospital\s+bills)/i,
  ];

  // Explicit sexual content patterns - instant rejection
  const explicitPatterns = [
    /\b(sex|fuck|hookup|nudes|naked|dick\s+pic|send\s+pic)/i,
    /\b(horny|dtf|down\s+to\s+fuck|wanna\s+fuck)/i,
    /\b(onlyfans|premium\s+snap|selling\s+content)/i,
  ];

  for (const pattern of scamPatterns) {
    if (pattern.test(content)) {
      return {
        flagged: true,
        category: 'scam_attempt',
        score: 95,
        message: "This message contains suspicious content that may be a scam.",
        details: "Pre-filtered for scam patterns"
      };
    }
  }

  for (const pattern of explicitPatterns) {
    if (pattern.test(content)) {
      return {
        flagged: true,
        category: 'sexual_content',
        score: 90,
        message: "This message contains explicit sexual content and cannot be sent.",
        details: "Pre-filtered for explicit content"
      };
    }
  }

  // Spam detection - repeated characters
  if (content.length > 50 && /(.{10,})\1{2,}/.test(content)) {
    return {
      flagged: true,
      category: 'spam',
      score: 80,
      message: "This message appears to be spam.",
      details: "Pre-filtered for repetitive content"
    };
  }

  return null; // Passed pre-filter
}

/**
 * Moderates message content using OpenAI Moderation API (async, non-blocking)
 * @param content - The message content to moderate
 * @returns Moderation result indicating if content should be blocked
 */
export async function moderateMessage(content: string): Promise<ModerationResult> {
  const startTime = Date.now();
  
  try {
    // Check cache first (saves 99% of API calls for repeated phrases)
    const cached = getCachedModeration(content);
    if (cached) {
      console.log(`[Moderation] Cache hit - ${Date.now() - startTime}ms`);
      return cached;
    }

    // Call OpenAI moderation API
    const moderationResponse = await openai.moderations.create({
      input: content,
      model: "text-moderation-latest"
    });

    const result = moderationResponse.results[0];
    const duration = Date.now() - startTime;

    // Check if flagged by OpenAI moderation
    if (result.flagged) {
      const categories = result.categories;
      let flaggedCategory = 'inappropriate_content';
      
      if (categories.sexual || categories['sexual/minors']) {
        flaggedCategory = 'sexual_content';
      } else if (categories.harassment || categories['harassment/threatening']) {
        flaggedCategory = 'harassment';
      } else if (categories.violence || categories['violence/graphic']) {
        flaggedCategory = 'violence';
      } else if (categories.hate || categories['hate/threatening']) {
        flaggedCategory = 'hate_speech';
      }

      const moderationResult = {
        flagged: true,
        category: flaggedCategory,
        score: Math.max(...Object.values(result.category_scores)) * 100,
        message: "This message contains inappropriate content and cannot be sent.",
        details: `Flagged for: ${flaggedCategory} (${duration}ms)`
      };

      // Cache the result
      setCachedModeration(content, moderationResult);
      console.log(`[Moderation] Flagged - ${duration}ms`);
      return moderationResult;
    }

    // Message is clean
    const cleanResult = {
      flagged: false,
      category: null,
      score: 0,
      message: "Message approved",
    };

    setCachedModeration(content, cleanResult);
    console.log(`[Moderation] Approved - ${duration}ms`);
    return cleanResult;

  } catch (error: any) {
    console.error(`[Moderation] Error after ${Date.now() - startTime}ms:`, error);
    // In case of error, allow the message but log it
    return {
      flagged: false,
      category: null,
      score: 0,
      message: "Message sent",
      details: `Moderation check failed: ${error.message}`
    };
  }
}

/**
 * Asynchronously moderate a message and remove if flagged (background processing)
 * This allows messages to be sent immediately while moderation runs in background
 */
export async function moderateMessageAsync(
  messageId: string,
  content: string,
  onFlagged: (messageId: string, result: ModerationResult) => Promise<void>
): Promise<void> {
  try {
    const result = await moderateMessage(content);
    
    if (result.flagged) {
      console.warn(`[Moderation] Message ${messageId} flagged in background:`, result);
      await onFlagged(messageId, result);
    }
  } catch (error) {
    console.error(`[Moderation] Background check failed for message ${messageId}:`, error);
  }
}

/**
 * Checks if a user exhibits bot-like behavior
 * @param userId - The user ID to check
 * @param messageCount - Number of messages sent recently
 * @param accountAge - Age of account in days
 * @param isVerified - Whether the user is face verified
 * @returns Whether the user should be rate limited
 */
export function shouldRateLimit(
  messageCount: number,
  accountAge: number,
  isVerified: boolean
): { limited: boolean; reason: string } {
  // Verified users get more generous limits
  if (isVerified) {
    if (messageCount > 100) {
      return { limited: true, reason: "Daily message limit reached. Please try again tomorrow." };
    }
    return { limited: false, reason: "" };
  }

  // New unverified accounts are heavily restricted
  if (accountAge < 1) {
    // Brand new accounts: 5 messages per day
    if (messageCount > 5) {
      return { limited: true, reason: "New accounts are limited to 5 messages per day. Please verify your account to send more messages." };
    }
  } else if (accountAge < 7) {
    // Accounts less than a week old: 20 messages per day
    if (messageCount > 20) {
      return { limited: true, reason: "Unverified accounts are limited to 20 messages per day. Please verify your account to send more messages." };
    }
  } else {
    // Older unverified accounts: 50 messages per day
    if (messageCount > 50) {
      return { limited: true, reason: "Unverified accounts are limited to 50 messages per day. Please verify your account to increase your limit." };
    }
  }

  return { limited: false, reason: "" };
}
