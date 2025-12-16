# REPLIT PROMPT: Add Optional Fast Onboarding to Fusion (Phase 1 - Chat Only)

## Context
You know the Fusion codebase. We're adding an optional AI-powered "Fast Setup" alongside our existing signup flow. This is NOT replacing the current signup—it's an additional option for users who want a faster, conversational experience.

## Goal
Implement a working chat-based onboarding that takes 3-5 minutes and fills the user's profile through conversation instead of forms.

---

## Implementation Requirements

### 1. Add Entry Point to Signup Flow

**Location:** Existing signup page (first screen after user creates account)

**Add a choice screen:**
```
Welcome to Fusion!

Choose how you'd like to set up your profile:

[Card 1: Fast Setup ⚡]
AI-guided conversation (3 mins)
✓ Quick and conversational
✓ Switch to forms anytime
[Start Fast Setup]

[Card 2: Standard Setup 📋]
Traditional step-by-step forms
[Continue with Forms]
```

**Technical requirements:**
- Create `components/onboarding/OnboardingChoice.tsx`
- Modify existing signup flow to show this choice first
- Store user's choice in session/state: `onboardingMethod: 'fast' | 'standard'`
- Add small help text: "You can switch to standard forms anytime during Fast Setup"

**Do NOT:**
- Remove or hide the existing signup flow
- Make Fast Setup the only option
- Auto-select either option

---

### 2. Build Chat Interface

**Create these components:**

**`components/onboarding/FastOnboardingChat.tsx`**
- WhatsApp-style chat UI
- AI messages on left (grey bubble)
- User messages on right (blue bubble)
- Auto-scroll to latest message
- Show typing indicator when AI is processing
- Always show "Exit to Standard Forms" button in header
- Show progress indicator: "Question 3 of 9"

**`components/onboarding/ChatMessage.tsx`**
- Single message bubble
- Props: `role` ('user' | 'assistant'), `content`, `timestamp`
- Different styling for user vs AI

**`components/onboarding/ChatInput.tsx`**
- Text input field
- Send button (only enabled when text is entered)
- Disable input while AI is responding
- Clear input after send

**`components/onboarding/OnboardingProgress.tsx`**
- Simple progress bar or "3 of 9 questions"
- Shows how far through the flow they are

**Design guidelines:**
- Mobile-first (most users will be on phone)
- Clean, minimal, professional
- Match existing Fusion design system
- Smooth animations for new messages

---

### 3. Create Backend API Endpoint

**New route: `pages/api/onboarding/ai-chat.ts`**

**POST request structure:**
```typescript
{
  "userId": "string",
  "conversationHistory": [
    {"role": "assistant", "content": "Hi! What's your first name?"},
    {"role": "user", "content": "Ahmed"}
  ]
}
```

**Response structure:**
```typescript
{
  "reply": "Nice to meet you, Ahmed. How old are you?",
  "extractedData": {
    "firstName": "Ahmed",
    "age": null,
    "city": null,
    // ... other fields
  },
  "progress": {
    "current": 2,
    "total": 9,
    "canProceed": true
  },
  "needsConfirmation": false,
  "isComplete": false
}
```

**What this endpoint does:**
1. Takes the conversation history
2. Sends to Claude/GPT with system prompt (see below)
3. Extracts structured data from user's latest response
4. Determines next question to ask
5. Returns AI's next message + extracted data + progress
6. Stores conversation state temporarily (don't commit to profile yet)

**Error handling:**
- Handle API failures gracefully
- Return helpful error messages
- Allow user to retry or exit to standard forms

---

### 4. AI System Prompt

**Create constants file: `lib/onboarding/prompts.ts`**

```typescript
export const FAST_ONBOARDING_SYSTEM_PROMPT = `You are helping a user complete their profile on Fusion, a Muslim-focused marriage-intent dating app.

YOUR ROLE:
- Ask ONE question at a time
- Keep responses SHORT (1-2 sentences max)
- Be warm, respectful, and non-judgmental
- Never pressure the user
- Always respect if they want to skip a question

CONVERSATION FLOW (ask in this order):

1. First name
2. Age (must be 18+)
3. City/Location (where they live)
4. Marriage intention
   - Ask: "Are you looking for marriage, or still exploring your options?"
   - Options: marriage soon, marriage eventually, exploring, not sure
5. Timeframe (OPTIONAL)
   - Ask: "Do you have a timeframe in mind?" 
   - Accept: specific months/years, "no rush", "flexible", or skip
6. Religious practice (OPTIONAL)
   - Ask: "How would you describe your religious practice?"
   - Store their EXACT words, don't interpret
   - Accept anything from "very practicing" to "cultural" to "still learning"
7. Family involvement (OPTIONAL)
   - Ask: "How important is family or wali involvement to you?"
   - Options: essential, preferred, flexible, not needed, or skip
8. Deal-breakers (OPTIONAL)
   - Ask: "Are there any absolute must-haves or must-nots you're looking for?"
   - Accept anything reasonable, store as free text
9. Communication preference (OPTIONAL)
   - Ask: "What's your preferred communication style?"
   - Accept: direct, casual, formal, text-first, call-first, etc.

RULES:
- If they give unclear/ambiguous answer, politely ask for clarification
- If they seem uncomfortable, remind them they can skip
- For age, verify they're 18+ (if not, politely explain app requirement)
- For religious topics, NEVER interpret, judge, or provide rulings
- Store their exact phrasing for sensitive topics
- Never give advice, therapy, or religious guidance
- If they ask about the app, answer briefly then return to onboarding

After each user response, extract data in this format:
{
  "firstName": "string or null",
  "age": "number or null",
  "city": "string or null",
  "marriageIntent": "marriage_soon | marriage_eventually | exploring | unsure | null",
  "timeframe": "string or null",
  "religiosityRaw": "exact user words or null",
  "waliInvolvement": "essential | preferred | flexible | not_needed | null",
  "dealBreakers": "string or null",
  "communicationStyle": "string or null"
}

Only move to next question when current answer is clear.`;

export const QUESTIONS = [
  "firstName",
  "age", 
  "city",
  "marriageIntent",
  "timeframe",
  "religiosityRaw",
  "waliInvolvement",
  "dealBreakers",
  "communicationStyle"
];
```

---

### 5. Data Extraction Logic

**In the API endpoint, implement:**

```typescript
async function extractDataFromMessage(
  conversationHistory: Message[],
  systemPrompt: string
): Promise<{
  reply: string;
  extractedData: Partial<ProfileData>;
  progress: Progress;
}> {
  
  // Call Claude/GPT API with system prompt + conversation
  const aiResponse = await callAI({
    system: systemPrompt,
    messages: conversationHistory
  });
  
  // Parse AI response to extract:
  // 1. The next question/reply to show user
  // 2. Structured data extracted from their last answer
  
  // Example extraction logic:
  const latestUserMessage = conversationHistory[conversationHistory.length - 1];
  const extractedData = {};
  
  // Smart extraction based on conversation stage
  // (AI should help with this via structured output)
  
  return {
    reply: aiResponse.content,
    extractedData,
    progress: calculateProgress(extractedData)
  };
}
```

---

### 6. Review/Confirmation Screen

**Create: `components/onboarding/OnboardingReview.tsx`**

**When to show:** After all 9 questions are answered (or skipped)

**Display:**
```
Review Your Profile

Name: Ahmed
Age: 28
Location: London
Intent: Marriage within 2 years
Religious practice: "Practicing, pray regularly"
Wali involvement: Preferred
Deal-breakers: "Must want children"
Communication: Direct and honest

[Edit Any Answer]  [Looks Good, Save Profile]

[Start Over]
```

**Features:**
- Clean summary view of all captured data
- Each field has an "Edit" button that jumps back to that specific question
- "Looks Good" button commits everything to database
- "Start Over" clears conversation and restarts
- Show original user phrasing for sensitive fields (don't normalize yet)

**Do NOT save to database until user confirms on this screen.**

---

### 7. Database Schema Updates

**Add to existing `profiles` table:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_method VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marriage_intent VARCHAR(30);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marriage_timeframe VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS religiosity_raw TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wali_involvement VARCHAR(30);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deal_breakers TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS communication_style VARCHAR(100);
```

**New table for conversation logs (optional but recommended):**
```sql
CREATE TABLE IF NOT EXISTS onboarding_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  conversation_log JSONB,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

---

### 8. Save Profile Endpoint

**New route: `pages/api/onboarding/complete.ts`**

**POST request:**
```typescript
{
  "userId": "string",
  "onboardingMethod": "fast_ai",
  "profileData": {
    "firstName": "Ahmed",
    "age": 28,
    // ... all extracted fields
  },
  "conversationLog": [ /* full chat history for audit */ ]
}
```

**What it does:**
1. Validates all required fields are present
2. Commits profile data to database
3. Marks onboarding as complete
4. Stores conversation log for debugging/audit
5. Returns success + redirects to main app

---

### 9. Handle Exit/Resume Scenarios

**Exit to Standard Forms:**
- Save current conversation state to temp storage
- Let user continue with regular form flow
- Optionally pre-fill forms with any data already extracted

**Resume Later:**
- Store conversation state in database or localStorage
- If user returns, show: "Continue Fast Setup? You were on question 5"
- Options: [Continue] [Start Fresh] [Use Standard Forms]

**Session Management:**
- Don't force completion in one sitting
- Allow user to close browser and return
- Clear conversation after 24 hours if not completed

---

### 10. Testing Requirements

**Test these flows:**
1. ✅ User completes all questions → reviews → saves → sees profile
2. ✅ User skips all optional questions → still works
3. ✅ User exits halfway → can resume or switch to forms
4. ✅ User gives ambiguous answer → AI asks for clarification
5. ✅ User under 18 → handled gracefully
6. ✅ Network error during chat → shows error, allows retry
7. ✅ User enters profanity → filters appropriately
8. ✅ Mobile experience is smooth

**Edge cases:**
- Very long user responses (handle gracefully)
- User asks questions instead of answering (AI redirects politely)
- User tries to skip required fields (gentle reminder)
- Browser back button pressed (saves state)

---

## Technical Constraints

**Stack preferences:**
- Use existing Fusion tech stack (React, TypeScript, Next.js)
- Match existing design system and components where possible
- Keep API calls efficient (don't spam Claude/GPT)
- Mobile-first responsive design
- Fast load times (chat should feel instant)

**What NOT to build (yet):**
- Voice input (Phase 2)
- Multi-language support (Phase 2)
- Video/photo upload in chat (not needed)
- Advanced analytics dashboard (do basic logging only)

---

## Success Criteria

**This is done when:**
1. ✅ User can choose Fast Setup or Standard Forms on signup
2. ✅ Chat interface works smoothly on mobile and desktop
3. ✅ AI asks all 9 questions in order, handles skips
4. ✅ Review screen shows all captured data clearly
5. ✅ Data saves correctly to database after confirmation
6. ✅ User can exit to standard forms anytime
7. ✅ No bugs in happy path or common edge cases
8. ✅ Code is clean, commented, follows existing patterns

---

## Priority

**Build in this order:**
1. Entry point UI (choice screen)
2. Basic chat interface (without AI first - hardcode questions to test UI)
3. Backend API endpoint + AI integration
4. Review/confirmation screen
5. Database integration + save logic
6. Exit/resume handling
7. Testing + bug fixes
8. Polish + final testing

---

## Start Implementation

Build this now as Phase 1 of Fusion's Fast Onboarding feature. Keep the existing signup flow completely intact. This is an additional option, not a replacement.

Proceed with implementation.
