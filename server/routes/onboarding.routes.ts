// AI-assisted onboarding, transcription, and TTS
import type { Express, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  users,
  profiles,
  messages,
  onboardingConversations,
  type Profile,
} from "@shared/schema";
import OpenAI from "openai";
import { eq, and, or } from "drizzle-orm";
import { audioUpload } from "./helpers";

export function registerOnboardingRoutes(app: Express) {
  // ===== Fast Onboarding API Routes =====
  
  const FAST_ONBOARDING_SYSTEM_PROMPT = `You are helping a user complete their profile on Fusion, a Muslim-focused marriage-intent dating app.

YOUR ROLE:
- Ask ONE question at a time
- Keep responses SHORT (1-2 sentences max)
- Be warm, respectful, and non-judgmental
- Never pressure the user
- Always respect if they want to skip optional questions

CONVERSATION FLOW (ask in this order):

1. First name (REQUIRED)
2. Gender (REQUIRED) - Ask: "Are you a brother or sister?" Map to male/female
3. Age (REQUIRED) - Must be 18+
4. City/Location (REQUIRED) - Where they live
5. Ethnicity - Ask: "What's your ethnic background?"
6. Marital status - Ask: "Have you been married before?" (never_married, divorced, widowed)
7. Children - Ask: "Do you have any children?" If yes, ask how many
8. Wants children - Ask: "Would you like to have children in the future?" (yes, no, open)
9. Education - Ask: "What's your highest level of education?"
10. Occupation - Ask: "What do you do for work?"
11. Religious sect - Ask: "Which sect do you identify with?" (Sunni, Shia, Just Muslim, Other)
12. Prayer frequency - Ask: "How often do you pray?"
13. Religious practice - Ask: "How would you describe your religious practice overall?" Store EXACT words
14. Bio - Ask: "Tell me a little about yourself - your personality, hobbies, what makes you unique?"
15. What you're looking for - Ask: "What are you looking for in a partner?"

RULES:
- If they give unclear/ambiguous answer, politely ask for clarification
- If they want to skip an optional question, that's fine - move on
- For age, verify they're 18+ (if not, politely explain app requirement)
- For religious topics, NEVER interpret, judge, or provide rulings
- Store their exact phrasing for sensitive topics
- Never give advice, therapy, or religious guidance

IMPORTANT: You MUST respond with valid JSON only. After each user response, respond with this exact JSON format:
{
  "reply": "Your conversational response to the user",
  "extractedData": {
    "firstName": null,
    "gender": null,
    "age": null,
    "city": null,
    "ethnicity": null,
    "maritalStatus": null,
    "hasChildren": null,
    "numberOfChildren": null,
    "wantsChildren": null,
    "education": null,
    "occupation": null,
    "sect": null,
    "prayerFrequency": null,
    "religiosityRaw": null,
    "bio": null,
    "lookingForDescription": null
  },
  "currentQuestion": 1,
  "isComplete": false
}

For gender use: "male" or "female"
For maritalStatus use: "never_married", "divorced", or "widowed"
For wantsChildren use: "yes", "no", or "open"
Set isComplete to true only after question 15 has been answered.
Only include values that were actually extracted in this response.`;

  // Helper function to get language-specific system prompt
  const getSystemPromptForLanguage = (language: string) => {
    const languageInstructions: Record<string, string> = {
      en: "Respond in English.",
      ur: "Respond in Urdu (اردو). Use respectful, formal language appropriate for Muslim users in Pakistan. Use culturally appropriate terminology: دین، نکاح، ولی، نماز",
      ar: "Respond in Arabic (العربية). Use formal, respectful Modern Standard Arabic appropriate for Muslim users. Use culturally appropriate terminology: دين، نكاح، ولي، صلاة",
      bn: "Respond in Bengali (বাংলা). Use respectful language appropriate for Muslim users in Bangladesh. Use culturally appropriate terminology: দ্বীন, নিকাহ, ওলী, নামাজ",
    };

    return `${FAST_ONBOARDING_SYSTEM_PROMPT}

LANGUAGE INSTRUCTION:
${languageInstructions[language] || languageInstructions.en}

IMPORTANT: Store user's EXACT words regardless of language. Do not translate their responses.`;
  };

  // AI Chat endpoint for fast onboarding
  app.post("/api/onboarding/ai-chat", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const { conversationHistory, currentExtractedData, language = "en" } = req.body;

      if (!conversationHistory || !Array.isArray(conversationHistory)) {
        return res.status(400).json({ message: "Invalid conversation history" });
      }

      // Initialize OpenAI client
      const openai = new OpenAI();

      // Get language-specific system prompt
      const systemPrompt = getSystemPromptForLanguage(language);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory.map((msg: any) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        throw new Error("No response from AI");
      }

      // Parse JSON response from AI
      let aiResponse;
      try {
        // Extract JSON from the response (handle markdown code blocks)
        const jsonMatch = responseContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                         responseContent.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseContent;
        aiResponse = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("[Onboarding] Failed to parse AI response:", responseContent);
        // Fallback response if parsing fails
        aiResponse = {
          reply: responseContent,
          extractedData: currentExtractedData || {},
          currentQuestion: 1,
          isComplete: false,
        };
      }

      // Save or update conversation in database
      const existing = await db
        .select()
        .from(onboardingConversations)
        .where(and(
          eq(onboardingConversations.userId, userId),
          eq(onboardingConversations.completed, false)
        ))
        .limit(1);

      const updatedConversation = [
        ...conversationHistory,
        { role: "assistant", content: aiResponse.reply }
      ];

      const mergedExtractedData = { ...currentExtractedData, ...aiResponse.extractedData };

      if (existing.length > 0) {
        await db
          .update(onboardingConversations)
          .set({
            conversationLog: updatedConversation,
            extractedData: mergedExtractedData,
            currentQuestion: aiResponse.currentQuestion,
            language,
          })
          .where(eq(onboardingConversations.id, existing[0].id));
      } else {
        await db.insert(onboardingConversations).values({
          userId,
          conversationLog: updatedConversation,
          extractedData: mergedExtractedData,
          currentQuestion: aiResponse.currentQuestion,
          language,
          completed: false,
        });
      }

      res.json({
        reply: aiResponse.reply,
        extractedData: aiResponse.extractedData,
        currentQuestion: aiResponse.currentQuestion,
        isComplete: aiResponse.isComplete,
      });
    } catch (error: any) {
      console.error("[Onboarding AI Chat] Error:", error);
      res.status(500).json({ 
        message: "Failed to process chat", 
        error: error.message 
      });
    }
  });

  // AI Bio Enhancement endpoint
  app.post("/api/enhance-bio", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { bio, userInfo } = req.body;

      if (!bio || typeof bio !== "string" || bio.trim().length < 10) {
        return res.status(400).json({ 
          message: "Please write at least a few words about yourself first" 
        });
      }

      const openai = new OpenAI();

      const systemPrompt = `You are a professional dating profile writer helping Muslim singles create compelling bios for a marriage-focused dating app called Fusion.

Your task is to enhance and expand the user's bio while:
- Keeping their authentic voice and personality
- Making it warm, genuine, and appealing
- Highlighting their values and what makes them unique
- Keeping it appropriate for a Muslim dating context
- Making it 2-3 paragraphs (around 100-150 words)
- Not adding any information they didn't mention
- Using natural, conversational language

${userInfo ? `Context about the user: ${JSON.stringify(userInfo)}` : ''}

Return ONLY the enhanced bio text, no explanations or quotes.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please enhance this bio: "${bio}"` },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const enhancedBio = completion.choices[0]?.message?.content?.trim();

      if (!enhancedBio) {
        throw new Error("No response from AI");
      }

      res.json({ enhancedBio });
    } catch (error: any) {
      console.error("[Bio Enhancement] Error:", error);
      res.status(500).json({ 
        message: "Failed to enhance bio", 
        error: error.message 
      });
    }
  });

  // Get existing onboarding conversation (for resume)
  app.get("/api/onboarding/conversation", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const existing = await db
        .select()
        .from(onboardingConversations)
        .where(and(
          eq(onboardingConversations.userId, userId),
          eq(onboardingConversations.completed, false)
        ))
        .limit(1);

      if (existing.length > 0) {
        const conv = existing[0];
        res.json({
          exists: true,
          conversationHistory: conv.conversationLog,
          extractedData: conv.extractedData,
          currentQuestionIndex: conv.currentQuestion,
          language: conv.language || "en",
          createdAt: conv.createdAt,
        });
      } else {
        res.json({ exists: false });
      }
    } catch (error: any) {
      console.error("[Onboarding Get] Error:", error);
      res.status(500).json({ message: "Failed to get conversation" });
    }
  });

  // Complete fast onboarding and save profile
  app.post("/api/onboarding/complete", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      const { profileData, conversationLog } = req.body;

      if (!profileData || !profileData.firstName || !profileData.age || !profileData.city || !profileData.gender) {
        return res.status(400).json({ 
          message: "Missing required fields (firstName, gender, age, city)" 
        });
      }

      // Validate age
      if (profileData.age < 18) {
        return res.status(400).json({ 
          message: "You must be 18 or older to use Fusion" 
        });
      }

      // Check if user already has a profile
      const existingProfile = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      const profileValues = {
        displayName: profileData.firstName,
        gender: profileData.gender,
        age: profileData.age,
        location: profileData.city,
        lookingFor: "Marriage" as const,
        onboardingMethod: "fast",
        // New comprehensive fields
        ethnicities: profileData.ethnicity ? [profileData.ethnicity] : [],
        maritalStatus: profileData.maritalStatus || "",
        hasChildren: profileData.hasChildren || false,
        wantsChildren: profileData.wantsChildren || "",
        education: profileData.education || "",
        occupation: profileData.occupation || "",
        profession: profileData.occupation || "",
        sect: profileData.sect || "",
        prayerFrequency: profileData.prayerFrequency || "",
        religiosity: profileData.religiosityRaw || "",
        bio: profileData.bio || "",
        // Store the raw looking for description for reference
        religiosityRaw: profileData.religiosityRaw,
        photos: [], // User will add photos next
        isComplete: false, // Profile not complete until photos added
        updatedAt: new Date(),
      };

      if (existingProfile.length > 0) {
        await db
          .update(profiles)
          .set(profileValues)
          .where(eq(profiles.userId, userId));
      } else {
        await db.insert(profiles).values({
          userId,
          ...profileValues,
        });
      }

      // Mark conversation as completed
      await db
        .update(onboardingConversations)
        .set({ 
          completed: true, 
          completedAt: new Date() 
        })
        .where(and(
          eq(onboardingConversations.userId, userId),
          eq(onboardingConversations.completed, false)
        ));

      console.log(`[Onboarding Complete] User ${userId} completed fast onboarding`);

      res.json({ 
        success: true, 
        message: "Profile data saved successfully",
        nextStep: "photos", // User needs to add photos next
      });
    } catch (error: any) {
      console.error("[Onboarding Complete] Error:", error);
      res.status(500).json({ 
        message: "Failed to save profile", 
        error: error.message 
      });
    }
  });

  // Clear onboarding conversation (start over)
  app.delete("/api/onboarding/conversation", isAuthenticated, async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
      await db
        .delete(onboardingConversations)
        .where(and(
          eq(onboardingConversations.userId, userId),
          eq(onboardingConversations.completed, false)
        ));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Onboarding Clear] Error:", error);
      res.status(500).json({ message: "Failed to clear conversation" });
    }
  });

  // Transcribe audio using OpenAI Whisper API (fallback for Web Speech API)
  app.post("/api/onboarding/transcribe", isAuthenticated, audioUpload.single('audio'), async (req: any, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const language = req.body.language || "en";
      const languageMap: Record<string, string> = {
        en: "en",
        ur: "ur",
        ar: "ar",
        bn: "bn",
      };

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Create a File object from the buffer for the API
      const audioFile = new File([req.file.buffer], "audio.webm", {
        type: req.file.mimetype || "audio/webm",
      });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: languageMap[language] || "en",
      });

      res.json({
        transcript: transcription.text,
        confidence: 0.95, // Whisper doesn't return confidence, assume high
      });
    } catch (error: any) {
      console.error("[Transcribe] Error:", error);
      res.status(500).json({ 
        message: "Failed to transcribe audio", 
        error: error.message 
      });
    }
  });

  // Text-to-speech using ElevenLabs API (premium quality voices)
  app.post("/api/tts", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { text, language = "en" } = req.body;
      
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Text is required" });
      }

      // Limit text length to avoid excessive API costs
      const truncatedText = text.slice(0, 4000);

      // ElevenLabs voice IDs - Rachel is warm and conversational
      const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel - calm, warm female voice
      
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": process.env.ELEVENLABS_API_KEY || "",
          },
          body: JSON.stringify({
            text: truncatedText,
            model_id: "eleven_multilingual_v2", // Supports 29 languages including Urdu, Arabic, Bengali
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.4,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[TTS] ElevenLabs error:", errorText);
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      // Get the audio as a buffer
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      // Send as audio/mpeg
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length,
      });
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("[TTS] Error:", error);
      res.status(500).json({ 
        message: "Failed to generate speech", 
        error: error.message 
      });
    }
  });
}
