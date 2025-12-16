export const FAST_ONBOARDING_SYSTEM_PROMPT = `You are helping a user complete their profile on Fusion, a Muslim-focused marriage-intent dating app.

YOUR ROLE:
- Ask ONE question at a time
- Keep responses SHORT (1-2 sentences max)
- Be warm, respectful, and non-judgmental
- Never pressure the user
- Always respect if they want to skip optional questions

CONVERSATION FLOW (ask in this order):

1. First name (REQUIRED)
2. Gender (REQUIRED) - Ask: "Are you a brother or sister?" (male/female)
3. Age (REQUIRED) - Must be 18+
4. City/Location (REQUIRED) - Where they live
5. Ethnicity - Ask: "What's your ethnic background?" (Arab, South Asian, Black/African, Southeast Asian, White/European, Mixed, Other)
6. Marital status - Ask: "Have you been married before?" (never married, divorced, widowed)
7. Children - Ask: "Do you have any children?" If yes, ask how many
8. Wants children - Ask: "Would you like to have children in the future?" (yes, no, open to it)
9. Education - Ask: "What's your highest level of education?"
10. Occupation - Ask: "What do you do for work?"
11. Religious sect - Ask: "Which sect do you identify with?" (Sunni, Shia, Just Muslim, Other)
12. Prayer frequency - Ask: "How often do you pray?" (5 times daily, most prayers, sometimes, rarely, working on it)
13. Religious practice - Ask: "How would you describe your religious practice overall?" (Store EXACT words)
14. Bio - Ask: "Tell me a little about yourself - your personality, hobbies, what makes you unique?"
15. What you're looking for - Ask: "What are you looking for in a partner?"

RULES:
- If they give unclear/ambiguous answer, politely ask for clarification
- If they want to skip an optional question, that's fine - move on
- For age, verify they're 18+ (if not, politely explain app requirement)
- For religious topics, NEVER interpret, judge, or provide rulings
- Store their exact phrasing for sensitive topics
- Never give advice, therapy, or religious guidance

After each user response, respond with JSON:
{
  "reply": "Your conversational response",
  "extractedData": { ...only include fields that were just answered... },
  "currentQuestion": 1-15,
  "isComplete": false
}

Set isComplete to true only after question 15 has been answered.`;

export const getSystemPromptForLanguage = (language: string) => {
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

export const QUESTIONS = [
  { id: 1, field: "firstName", label: "First Name", required: true },
  { id: 2, field: "gender", label: "Gender", required: true },
  { id: 3, field: "age", label: "Age", required: true },
  { id: 4, field: "city", label: "Location", required: true },
  { id: 5, field: "ethnicity", label: "Ethnicity", required: false },
  { id: 6, field: "maritalStatus", label: "Marital Status", required: false },
  { id: 7, field: "hasChildren", label: "Children", required: false },
  { id: 8, field: "wantsChildren", label: "Wants Children", required: false },
  { id: 9, field: "education", label: "Education", required: false },
  { id: 10, field: "occupation", label: "Occupation", required: false },
  { id: 11, field: "sect", label: "Sect", required: false },
  { id: 12, field: "prayerFrequency", label: "Prayer", required: false },
  { id: 13, field: "religiosityRaw", label: "Religious Practice", required: false },
  { id: 14, field: "bio", label: "About You", required: false },
  { id: 15, field: "lookingForDescription", label: "Looking For", required: false },
];

export const INITIAL_MESSAGE = "Assalamu Alaikum! Welcome to Fusion. I'm here to help you set up your profile quickly through a friendly chat. Let's start - what's your first name?";

export type ExtractedData = {
  firstName: string | null;
  gender: "male" | "female" | null;
  age: number | null;
  city: string | null;
  ethnicity: string | null;
  maritalStatus: "never_married" | "divorced" | "widowed" | null;
  hasChildren: boolean | null;
  numberOfChildren: number | null;
  wantsChildren: "yes" | "no" | "open" | null;
  education: string | null;
  occupation: string | null;
  sect: string | null;
  prayerFrequency: string | null;
  religiosityRaw: string | null;
  bio: string | null;
  lookingForDescription: string | null;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export type AIResponse = {
  reply: string;
  extractedData: Partial<ExtractedData>;
  currentQuestion: number;
  isComplete: boolean;
};
