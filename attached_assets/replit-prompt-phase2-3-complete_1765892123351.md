# REPLIT PROMPT: Complete Fast Onboarding - Voice, Multilingual & Guidance Hub

## Context
Phase 1 of Fast Onboarding (chat-based) is working. Now implement ALL remaining features:
- Voice input with confirmation
- Multi-language support (English, Urdu, Arabic, Bengali)
- Guidance Hub with articles
- Profile completion for existing users
- Resume later functionality
- Advanced features

---

## PART 1: Add Voice Input to Chat

### 1.1: Update Chat Input Component

**Modify `components/onboarding/ChatInput.tsx`:**

Add mode toggle:
```typescript
type InputMode = 'text' | 'voice';

[Current state view:]
┌─────────────────────────────────────┐
│ [🎤 mic icon]  Type your answer...  │
│                               [Send] │
└─────────────────────────────────────┘

[When mic tapped - recording:]
┌─────────────────────────────────────┐
│          🔴 Recording...             │
│     [Tap to stop and send]          │
│     [Cancel]                        │
└─────────────────────────────────────┘

[When processing voice:]
┌─────────────────────────────────────┐
│     Converting speech to text...    │
└─────────────────────────────────────┘
```

**Features:**
- Mic icon always visible in text input
- Tap mic → switches to recording mode
- Show visual feedback (pulsing red dot, waveform animation)
- Tap again → stop recording and auto-send
- Cancel button to discard recording
- Switch back to text mode anytime

---

### 1.2: Implement Speech Recognition

**Create `hooks/useSpeechRecognition.ts`:**

**Use Web Speech API first (faster to implement):**
```typescript
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const startListening = (language: string = 'en-US') => {
    if (!('webkitSpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      return;
    }
    
    const recognition = new webkitSpeechRecognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setTranscript(transcript);
    };
    
    recognition.onerror = (event) => {
      setError('Could not understand. Please try again or type instead.');
    };
    
    recognition.start();
    setIsListening(true);
  };
  
  const stopListening = () => {
    setIsListening(false);
    return transcript;
  };
  
  return { transcript, isListening, error, startListening, stopListening };
}
```

**Language codes to support:**
- `en-US` - English
- `ur-PK` - Urdu (Pakistan)
- `ar-SA` - Arabic (Saudi Arabia)
- `bn-BD` - Bengali (Bangladesh)

**Fallback to Whisper API (if Web Speech fails):**

Create `pages/api/onboarding/transcribe.ts`:
```typescript
POST /api/onboarding/transcribe

Request (multipart/form-data):
{
  "audio": blob,
  "language": "en"
}

Response:
{
  "transcript": "I'm looking for marriage within the next year",
  "confidence": 0.95
}
```

Use OpenAI Whisper API:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: "whisper-1",
  language: language // 'en', 'ur', 'ar', 'bn'
});
```

---

### 1.3: Voice Confirmation Flow (CRITICAL)

**For sensitive questions, always confirm what was heard:**

**Questions requiring confirmation:**
- Religious practice
- Marriage intention/timeframe
- Wali involvement
- Deal-breakers

**Flow:**
```
User speaks: "I pray five times a day and wear hijab"

AI receives transcript → Shows confirmation:

┌─────────────────────────────────────┐
│ I heard you say:                    │
│                                     │
│ "I pray five times a day and        │
│  wear hijab"                        │
│                                     │
│ Is this correct?                    │
│                                     │
│ [✓ Yes, that's right]               │
│ [✏️ No, let me retype]              │
│ [🎤 Try voice again]                │
└─────────────────────────────────────┘
```

**Implementation:**

Create `components/onboarding/VoiceConfirmation.tsx`:
```typescript
interface Props {
  transcript: string;
  question: string;
  onConfirm: () => void;
  onRetry: () => void;
  onType: () => void;
}

// Shows transcript + 3 action buttons
// Only proceeds when user confirms
```

**In API endpoint, flag when confirmation needed:**
```typescript
{
  "reply": "How would you describe your religious practice?",
  "needsVoiceConfirmation": true,
  "sensitiveField": true
}
```

---

### 1.4: Handle Voice Edge Cases

**Problem scenarios:**

**1. Background noise**
```
Solution:
- Show "Couldn't catch that clearly" message
- Offer: [Try Again] [Type Instead]
- Don't make user feel bad
```

**2. Strong accent / unclear speech**
```
Solution:
- If confidence < 0.7, automatically trigger confirmation
- Show transcript with: "Did I understand correctly?"
```

**3. Mixed language (English + Urdu words)**
```
Example: "I'm practicing Muslim, deen is important"

Solution:
- Accept mixed language
- Store EXACT transcript
- Don't try to translate or normalize
```

**4. Name spelling**
```
User says: "Ayesha"
AI hears: "Aisha" or "Aysha"

Solution:
- For names, always ask: "How do you spell that?"
- Show keyboard input for spelling confirmation
```

**5. Numbers (ages, years)**
```
User says: "twenty eight"
AI might hear: "28" or "twenty eight"

Solution:
- Always confirm numbers visually
- Show: "Just to confirm, you're 28 years old?"
```

---

### 1.5: Voice UI Improvements

**Add these UI elements:**

**1. "Having trouble?" helper**
```
Always show at bottom of voice mode:
┌─────────────────────────────────────┐
│ Having trouble with voice?          │
│ [Switch to typing]                  │
└─────────────────────────────────────┘
```

**2. Microphone permission handling**
```
If permission denied:
┌─────────────────────────────────────┐
│ ⚠️ Microphone access needed         │
│                                     │
│ Please enable microphone in your    │
│ browser settings to use voice.      │
│                                     │
│ [Try Again] [Type Instead]          │
└─────────────────────────────────────┘
```

**3. Loading states**
- "Listening..." (while recording)
- "Processing..." (while transcribing)
- "Confirming..." (while AI extracts data)

**4. Success feedback**
- Green checkmark when answer accepted
- Smooth transition to next question

---

## PART 2: Multi-Language Support

### 2.1: Language Selection Screen

**Add BEFORE the chat starts:**

```
┌─────────────────────────────────────┐
│     Welcome to Fusion               │
│                                     │
│ Choose your language:               │
│                                     │
│ [🇬🇧 English]                       │
│ [🇵🇰 اردو (Urdu)]                  │
│ [🇸🇦 العربية (Arabic)]             │
│ [🇧🇩 বাংলা (Bengali)]              │
│                                     │
└─────────────────────────────────────┘
```

**Store selection:**
```typescript
{
  selectedLanguage: 'en' | 'ur' | 'ar' | 'bn',
  displayName: 'English' | 'اردو' | 'العربية' | 'বাংলা'
}
```

**Allow changing language mid-conversation:**
- Small flag icon in header
- Tapping shows language picker
- Confirms: "Switch language? Your progress will be saved."

---

### 2.2: Translation System

**Create `lib/i18n/onboarding.ts`:**

**DON'T translate the AI responses (too complex).**
**DO translate UI elements and button labels.**

```typescript
export const translations = {
  en: {
    fastSetup: "Fast Setup",
    standardSetup: "Standard Setup",
    exitToForms: "Exit to Forms",
    skip: "Skip",
    next: "Next",
    confirm: "Yes, that's right",
    retry: "Try again",
    typeInstead: "Type instead",
    listeningSpeech: "Listening...",
    processingSpeech: "Processing...",
    confirmTranscript: "I heard you say:",
    isThisCorrect: "Is this correct?",
    havingTrouble: "Having trouble with voice?",
    switchToTyping: "Switch to typing",
    questionProgress: "Question {{current}} of {{total}}",
    reviewProfile: "Review Your Profile",
    looksGood: "Looks Good, Save Profile",
    editAnswer: "Edit",
    startOver: "Start Over",
  },
  ur: {
    fastSetup: "تیز رفتار سیٹ اپ",
    standardSetup: "معیاری سیٹ اپ",
    exitToForms: "فارم پر جائیں",
    skip: "چھوڑ دیں",
    next: "اگلا",
    confirm: "ہاں، یہ صحیح ہے",
    retry: "دوبارہ کوشش کریں",
    typeInstead: "ٹائپ کریں",
    listeningSpeech: "سن رہے ہیں...",
    processingSpeech: "پروسیسنگ...",
    confirmTranscript: "میں نے سنا:",
    isThisCorrect: "کیا یہ صحیح ہے؟",
    havingTrouble: "آواز سے مسئلہ؟",
    switchToTyping: "ٹائپنگ میں تبدیل کریں",
    questionProgress: "سوال {{current}} از {{total}}",
    reviewProfile: "اپنی پروفائل کا جائزہ لیں",
    looksGood: "ٹھیک ہے، محفوظ کریں",
    editAnswer: "ترمیم",
    startOver: "نئے سرے سے شروع کریں",
  },
  ar: {
    fastSetup: "إعداد سريع",
    standardSetup: "إعداد قياسي",
    exitToForms: "الخروج إلى النماذج",
    skip: "تخطي",
    next: "التالي",
    confirm: "نعم، هذا صحيح",
    retry: "حاول مرة أخرى",
    typeInstead: "اكتب بدلاً من ذلك",
    listeningSpeech: "الاستماع...",
    processingSpeech: "المعالجة...",
    confirmTranscript: "سمعتك تقول:",
    isThisCorrect: "هل هذا صحيح؟",
    havingTrouble: "هل تواجه مشكلة مع الصوت؟",
    switchToTyping: "التبديل إلى الكتابة",
    questionProgress: "السؤال {{current}} من {{total}}",
    reviewProfile: "مراجعة ملفك الشخصي",
    looksGood: "يبدو جيداً، احفظ الملف الشخصي",
    editAnswer: "تعديل",
    startOver: "ابدأ من جديد",
  },
  bn: {
    fastSetup: "দ্রুত সেটআপ",
    standardSetup: "স্ট্যান্ডার্ড সেটআপ",
    exitToForms: "ফর্মে যান",
    skip: "এড়িয়ে যান",
    next: "পরবর্তী",
    confirm: "হ্যাঁ, এটা ঠিক",
    retry: "আবার চেষ্টা করুন",
    typeInstead: "টাইপ করুন",
    listeningSpeech: "শুনছি...",
    processingSpeech: "প্রসেসিং...",
    confirmTranscript: "আমি শুনেছি:",
    isThisCorrect: "এটা কি সঠিক?",
    havingTrouble: "ভয়েস নিয়ে সমস্যা?",
    switchToTyping: "টাইপিং এ পরিবর্তন করুন",
    questionProgress: "প্রশ্ন {{current}} এর মধ্যে {{total}}",
    reviewProfile: "আপনার প্রোফাইল পর্যালোচনা করুন",
    looksGood: "ভালো লাগছে, প্রোফাইল সেভ করুন",
    editAnswer: "সম্পাদনা",
    startOver: "নতুন করে শুরু করুন",
  }
};

export function useTranslation(lang: string) {
  return translations[lang] || translations.en;
}
```

---

### 2.3: Multilingual AI Prompts

**Update `lib/onboarding/prompts.ts`:**

```typescript
export const getSystemPromptForLanguage = (language: string) => {
  const basePrompt = FAST_ONBOARDING_SYSTEM_PROMPT; // English version
  
  const languageInstructions = {
    en: "Respond in English.",
    ur: "Respond in Urdu (اردو). Use respectful, formal language appropriate for Muslim users in Pakistan.",
    ar: "Respond in Arabic (العربية). Use formal, respectful Modern Standard Arabic appropriate for Muslim users.",
    bn: "Respond in Bengali (বাংলা). Use respectful language appropriate for Muslim users in Bangladesh."
  };
  
  return `${basePrompt}

LANGUAGE INSTRUCTION:
${languageInstructions[language] || languageInstructions.en}

When asking about religious topics, use culturally appropriate terminology:
- For Urdu: دین، نکاح، ولی، نماز
- For Arabic: دين، نكاح، ولي، صلاة  
- For Bengali: দ্বীন، নিকাহ، ওলী، নামাজ

Store user's EXACT words regardless of language. Do not translate their responses.`;
};
```

---

### 2.4: Right-to-Left (RTL) Support

**For Arabic and Urdu:**

**Update chat styling:**
```typescript
// In FastOnboardingChat.tsx

const isRTL = language === 'ar' || language === 'ur';

<div 
  className={`chat-container ${isRTL ? 'rtl' : 'ltr'}`}
  dir={isRTL ? 'rtl' : 'ltr'}
>
```

**CSS updates needed:**
```css
.rtl {
  direction: rtl;
}

.rtl .message-user {
  align-self: flex-start; /* Flip sides */
}

.rtl .message-ai {
  align-self: flex-end; /* Flip sides */
}

.rtl input {
  text-align: right;
}
```

---

### 2.5: Language-Specific Data Handling

**In database, store language used:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_language VARCHAR(5);
```

**In conversation log, track language:**
```typescript
{
  "conversationLog": [
    {
      "role": "assistant",
      "content": "آپ کی عمر کیا ہے؟",
      "language": "ur"
    },
    {
      "role": "user", 
      "content": "28",
      "language": "ur"
    }
  ]
}
```

---

## PART 3: Guidance Hub

### 3.1: Create Content Structure

**Create folder: `content/guidance/`**

**Files to create:**
```
content/guidance/
├── handling-rejection.md
├── managing-expectations.md
├── healthy-boundaries.md
├── clear-intentions.md
├── focus-on-control.md
├── emotional-balance.md
├── respectful-communication.md
└── patience-in-process.md
```

**Metadata format (frontmatter):**
```markdown
---
title: "Not Every Match Defines Your Worth"
slug: "handling-rejection"
category: "Navigating Connections"
order: 1
published: true
---

[Article content here]
```

---

### 3.2: Write Core Articles

**Article 1: `handling-rejection.md`**
```markdown
---
title: "Not Every Match Defines Your Worth"
slug: "handling-rejection"
category: "Navigating Connections"
order: 1
---

Rejection is part of the journey. When someone doesn't respond or chooses not to continue, it's natural to feel disappointed.

What helps:
- Remember: one person's choice isn't a judgment of your value
- Focus on what you can control: your behaviour, your intentions, your dignity
- Give yourself time to process, then continue with patience

Rejection teaches us what we're looking for. Each "no" brings you closer to the right "yes."

**Practical steps:**
- Don't take it personally—compatibility is complex
- Avoid dwelling or creating negative stories
- Stay open to new connections
- Treat others the way you'd want to be treated
```

**Article 2: `managing-expectations.md`**
```markdown
---
title: "Meaningful Connections Take Time"
slug: "managing-expectations"
category: "Navigating Connections"
order: 2
---

It's natural to hope for quick results. But rushing rarely leads to the right outcome.

What helps:
- Approach each conversation with openness, not urgency
- Look for consistency over chemistry alone
- Be patient with yourself and others
- Focus on the journey, not just the destination

The best matches often develop gradually. Trust the process.

**Practical steps:**
- Don't expect instant perfection
- Give people time to show their character
- Notice patterns, not just first impressions
- Stay grounded in your values
```

**Article 3: `healthy-boundaries.md`**
```markdown
---
title: "Respecting Yourself & Others"
slug: "healthy-boundaries"
category: "Healthy Communication"
order: 3
---

Boundaries protect everyone in the interaction. They're not walls—they're guidelines for respectful connection.

What this looks like:
- Saying no when something doesn't feel right
- Not over-investing before you truly know someone
- Communicating your values and expectations clearly
- Respecting when others do the same

Healthy boundaries make better matches possible.

**Practical steps:**
- Be clear about your pace and comfort level
- Don't compromise on core values
- Speak up if something feels off
- Honor other people's boundaries too
```

**Article 4: `clear-intentions.md`**
```markdown
---
title: "Be Honest About What You're Seeking"
slug: "clear-intentions"
category: "Focus & Intention"
order: 4
---

Unclear intentions waste time and cause emotional confusion.

What helps:
- Know what you're looking for (marriage, timeline, priorities)
- Communicate this early, respectfully
- Don't lead people on if you're unsure
- It's okay to still be figuring things out—just say so

Honesty protects everyone's time and heart.

**Practical steps:**
- Be upfront about your marriage timeline
- Share your priorities early in conversations
- If your feelings change, communicate that
- Respect others who do the same
```

**Article 5: `focus-on-control.md`**
```markdown
---
title: "Focus on What You Can Control"
slug: "focus-on-control"
category: "Focus & Intention"
order: 5
---

You cannot control:
- Whether someone responds
- How quickly things progress
- Other people's choices or timing

You can control:
- How you present yourself
- The respect you show
- Your emotional reactions
- The effort you put in

Focus your energy on what's yours to manage. The rest will follow naturally.

**Practical steps:**
- Let go of outcomes you can't influence
- Put energy into being your authentic self
- Respond with dignity, not reaction
- Stay consistent in your values
```

**Article 6: `emotional-balance.md`**
```markdown
---
title: "Staying Emotionally Grounded"
slug: "emotional-balance"
category: "Navigating Connections"
order: 6
---

The search for a partner can be emotionally intense. Staying balanced protects your wellbeing and makes you a better potential match.

What helps:
- Don't make this your entire life
- Maintain other relationships and interests
- Take breaks when you need them
- Process disappointment, don't ignore it

You'll make better decisions when you're emotionally balanced.

**Practical steps:**
- Set time limits on the app
- Talk to trusted friends or family
- Engage in activities that ground you
- Remember: finding a partner is important, not urgent
```

**Article 7: `respectful-communication.md`**
```markdown
---
title: "Communication That Honors Others"
slug: "respectful-communication"
category: "Healthy Communication"
order: 7
---

How you communicate matters as much as what you communicate.

Good communication:
- Is honest but kind
- Considers the other person's perspective
- Addresses concerns directly, not passive-aggressively
- Gives people space to respond in their own time

Poor communication:
- Is dismissive or harsh
- Makes assumptions
- Ghosts without explanation
- Pressures for immediate responses

Treat others the way you'd want to be treated.

**Practical steps:**
- If you're not interested, say so politely
- If you need time, communicate that
- Don't leave people guessing
- Be direct but compassionate
```

**Article 8: `patience-in-process.md`**
```markdown
---
title: "The Value of Patience"
slug: "patience-in-process"
category: "Focus & Intention"
order: 8
---

Finding the right person takes time. Impatience can lead to poor decisions and unnecessary frustration.

What patience looks like:
- Giving conversations room to develop
- Not forcing outcomes
- Accepting that timing matters
- Staying hopeful without being desperate

Patience isn't passive—it's active trust in the process.

**Practical steps:**
- Don't rush physical or emotional milestones
- Allow people to reveal themselves naturally
- If something feels forced, pause
- Remember: quality over speed
```

---

### 3.3: Build Guidance Hub UI

**Create `pages/guidance/index.tsx`:**

```
┌─────────────────────────────────────┐
│     Guidance Hub                    │
├─────────────────────────────────────┤
│                                     │
│ 📱 Navigating Connections           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ • Not Every Match Defines Your Worth│
│ • Meaningful Connections Take Time  │
│ • Staying Emotionally Grounded      │
│                                     │
│ 💬 Healthy Communication            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ • Respecting Yourself & Others      │
│ • Communication That Honors Others  │
│                                     │
│ 🎯 Focus & Intention                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ • Be Honest About What You're...   │
│ • Focus on What You Can Control     │
│ • The Value of Patience             │
│                                     │
└─────────────────────────────────────┘
```

**Article page template `pages/guidance/[slug].tsx`:**

```
┌─────────────────────────────────────┐
│ [← Back to Guidance Hub]            │
├─────────────────────────────────────┤
│                                     │
│ Not Every Match Defines Your Worth  │
│                                     │
│ Rejection is part of the journey... │
│                                     │
│ [Full article content]              │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                     │
│ Related Articles:                   │
│ • Managing Expectations             │
│ • Emotional Balance                 │
│                                     │
└─────────────────────────────────────┘
```

**Add to main navigation:**
- Profile menu → "Guidance Hub"
- Help menu → "Emotional Support"
- Settings → "Guidance & Support"

---

### 3.4: Contextual Article Suggestions

**Trigger guidance prompts after specific events:**

**Create `lib/guidance/triggers.ts`:**
```typescript
export const guidanceTriggers = {
  AFTER_UNMATCH: {
    article: 'handling-rejection',
    delay: 5000, // 5 seconds
    message: 'Want some perspective?'
  },
  AFTER_7_DAYS_NO_MATCHES: {
    article: 'managing-expectations',
    delay: 0,
    message: 'Staying patient? This might help.'
  },
  AFTER_5_UNRESPONDED_MESSAGES: {
    article: 'emotional-balance',
    delay: 3000,
    message: 'Feeling frustrated? Take a moment.'
  },
  AFTER_PROFILE_COMPLETION: {
    article: 'clear-intentions',
    delay: 0,
    message: 'Quick read to help you get started'
  }
};
```

**Create `components/guidance/GuidancePrompt.tsx`:**
```typescript
interface Props {
  article: string;
  message: string;
  onDismiss: () => void;
  onView: () => void;
}

// Shows as non-intrusive banner at bottom:
┌─────────────────────────────────────┐
│ 💡 Want some perspective?           │
│ Read: Handling Rejection            │
│                                     │
│ [View Article]  [Dismiss]           │
└─────────────────────────────────────┘
```

**User settings to control this:**
```
Settings → Notifications:
☑ Guidance suggestions
  "Show helpful articles when relevant"
```

**CRITICAL RULES:**
- Must be dismissable
- Must not show more than once per day
- Must respect user's settings
- Never intrusive or preachy
- Can be permanently disabled

---

## PART 4: Profile Completion for Existing Users

### 4.1: Add to Profile/Settings

**Create `components/profile/CompleteProfileFast.tsx`:**

Shows when profile is <80% complete:
```
┌─────────────────────────────────────┐
│ Profile Completion: 60%             │
├─────────────────────────────────────┤
│                                     │
│ ⚡ Complete Your Profile Faster     │
│                                     │
│ Use AI to fill in missing details  │
│ Quick 3-minute conversation         │
│                                     │
│ [Try Fast Complete]                 │
│ [Continue Manually]                 │
│                                     │
└─────────────────────────────────────┘
```

---

### 4.2: Smart Completion Flow

**AI should:**
1. Check what's already filled in
2. Only ask about missing fields
3. Use existing data as context

**Example:**
```
AI: "Hi! I see you're from London and looking for marriage. 
     Let me help you complete a few more details. 
     How would you describe your religious practice?"

[Uses existing: location, intent]
[Asks about: religiosity, wali, preferences]
```

**API endpoint needs:**
```typescript
POST /api/onboarding/ai-complete

{
  "userId": "...",
  "existingProfile": {
    "firstName": "Ahmed",
    "age": 28,
    "city": "London",
    "marriageIntent": "marriage_soon"
    // ... existing data
  },
  "missingFields": ["religiosityRaw", "waliInvolvement", "dealBreakers"]
}
```

---

### 4.3: Progress Tracking

**Show progress bar:**
```
Profile Strength: 75%
[████████████░░░░] 

Missing:
• Religious practice preference
• Family involvement preference  
• Communication style

[Complete with AI Chat] [Fill Manually]
```

---

## PART 5: Advanced Features

### 5.1: Resume Incomplete Onboarding

**When user returns with incomplete onboarding:**

```
┌─────────────────────────────────────┐
│     Welcome back!                   │
├─────────────────────────────────────┤
│                                     │
│ You started Fast Setup 2 days ago   │
│ You were on question 5 of 9         │
│                                     │
│ [Continue Where I Left Off]         │
│ [Start Fresh]                       │
│ [Use Standard Forms]                │
│                                     │
└─────────────────────────────────────┘
```

**Storage:**
```typescript
// In database or localStorage
{
  userId: "...",
  onboardingState: {
    method: "fast_ai",
    language: "en",
    conversationHistory: [...],
    extractedData: {...},
    currentQuestionIndex: 4,
    lastUpdated: "2025-12-16T10:30:00Z"
  }
}
```

**Auto-cleanup:**
- Delete incomplete onboarding after 7 days
- Or after user completes via standard forms

---

### 5.2: Analytics Dashboard (Admin)

**Create `pages/admin/onboarding-analytics.tsx`:**

**Track these metrics:**
```typescript
interface OnboardingAnalytics {
  // Method selection
  fastSetupChoices: number;
  standardFormChoices: number;
  conversionRate: number; // % who choose fast
  
  // Completion rates
  fastSetupCompleted: number;
  fastSetupAbandoned: number;
  averageCompletionTime: number; // minutes
  
  // Question-by-question
  questionDropoff: {
    question1: 95%, // firstName
    question2: 92%, // age
    question3: 88%, // location
    question4: 75%, // intent (biggest drop)
    // ... etc
  };
  
  // Voice usage
  voiceAttempts: number;
  voiceSuccessRate: number;
  voiceErrors: string[];
  
  // Language distribution
  languageUsage: {
    en: 70%,
    ur: 15%,
    ar: 10%,
    bn: 5%
  };
  
  // Exit points
  exitedToForms: number;
  exitedAtQuestion: number[];
}
```

**Visual dashboard with charts:**
- Funnel visualization
- Drop-off heat map
- Time-to-complete distribution
- Voice success rate by language

---

### 5.3: A/B Testing Framework

**Test different variations:**

```typescript
// Randomly assign users to variants
const variant = Math.random() < 0.5 ? 'A' : 'B';

variants = {
  A: {
    entryPrompt: "⚡ Fast Setup (3 mins)",
    tone: "friendly",
    voiceFirst: false
  },
  B: {
    entryPrompt: "🎤 Talk to Complete Your Profile",
    tone: "professional",
    voiceFirst: true
  }
};
```

**Track which performs better:**
- Completion rate
- Time to complete
- User satisfaction (optional survey at end)

---

### 5.4: Error Logging & Monitoring

**Create `lib/monitoring/onboardingLogger.ts`:**

```typescript
export function logOnboardingEvent(event: {
  userId: string;
  eventType: 'started' | 'question_answered' | 'voice_used' | 'error' | 'completed' | 'abandoned';
  questionNumber?: number;
  inputMethod?: 'text' | 'voice';
  language?: string;
  timeSpent?: number;
  error?: string;
  metadata?: any;
}) {
  // Send to your analytics service
  // Examples: PostHog, Mixpanel, or custom logging
}
```

**Track critical errors:**
- Voice transcription failures
- AI API timeouts
- Data extraction errors
- Database save failures

**Alert on thresholds:**
- If >10% voice failure rate in last hour → notify dev team
- If >5% users abandon at same question → investigate UX issue

---

### 5.5: Feedback Collection

**After successful onboarding:**

```
┌─────────────────────────────────────┐
│ Profile created! 🎉                 │
├─────────────────────────────────────┤
│                                     │
│ Quick question: How was Fast Setup? │
│                                     │
│ [😊 Great] [😐 Okay] [😞 Poor]      │
│                                     │
│ [Optional: Tell us more]            │
│                                     │
│ [Skip]                              │
└─────────────────────────────────────┘
```

**Store feedback:**
```sql
CREATE TABLE onboarding_feedback (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  rating VARCHAR(10), -- 'great', 'okay', 'poor'
  comment TEXT,
  method VARCHAR(20), -- 'fast_ai' or 'standard'
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## PART 6: Testing Requirements

### 6.1: Critical Test Cases

**Voice Input:**
- ✅ Clear speech → transcribes correctly
- ✅ Strong accent → still works or triggers retry
- ✅ Background noise → handles gracefully
- ✅ Mixed language → accepts and stores
- ✅ Names → asks for spelling
- ✅ Numbers → confirms visually
- ✅ Sensitive topics → always confirms
- ✅ Microphone permission denied → fallback to text

**Multi-Language:**
- ✅ Switch language mid-conversation → maintains progress
- ✅ RTL (Arabic/Urdu) → displays correctly
- ✅ UI labels translated correctly
- ✅ AI responds in correct language
- ✅ Mixed language input → handled properly

**Guidance Hub:**
- ✅ Articles load correctly
- ✅ Navigation works
- ✅ Contextual prompts trigger at right time
- ✅ User can dismiss prompts
- ✅ Settings control prompts
- ✅ Mobile responsive

**Profile Completion:**
- ✅ Shows for incomplete profiles
- ✅ Only asks missing fields
- ✅ Uses existing data as context
- ✅ Updates profile correctly

**Resume/Exit:**
- ✅ Can exit mid-conversation → saves state
- ✅ Can resume later → picks up where left off
- ✅ Can switch to standard forms → keeps extracted data
- ✅ Old incomplete onboarding cleaned up

---

### 6.2: User Acceptance Testing

**Recruit 10-20 beta testers:**
- Mix of languages (English, Urdu, Arabic, Bengali speakers)
- Mix of accents (British Pakistani, Arab, Bangladeshi)
- Mix of tech comfort levels
- Mobile + desktop

**Test scenarios:**
1. Complete onboarding via chat
2. Complete onboarding via voice
3. Mix of chat and voice
4. Switch language mid-way
5. Exit and resume
6. Exit and use standard forms
7. Read guidance articles
8. Complete profile as existing user

**Collect:**
- Completion rates
- Time to complete
- Error encounters
- Subjective feedback
- Would they recommend?

---

## PART 7: Deployment Checklist

**Before launching to production:**

**Backend:**
- ✅ AI API keys configured (OpenAI/Anthropic)
- ✅ Whisper API fallback configured
- ✅ Rate limiting on AI endpoints
- ✅ Error logging configured
- ✅ Database migrations run
- ✅ Backup existing user data

**Frontend:**
- ✅ All UI translations complete
- ✅ RTL support tested
- ✅ Voice permissions handled
- ✅ Loading states implemented
- ✅ Error states handled
- ✅ Mobile responsive
- ✅ Tested on iOS Safari + Android Chrome

**Content:**
- ✅ All 8 guidance articles written
- ✅ Articles reviewed for tone
- ✅ No gender-blaming content
- ✅ No religious rulings
- ✅ Mobile-friendly formatting

**Monitoring:**
- ✅ Analytics tracking implemented
- ✅ Error alerting configured
- ✅ Dashboard for monitoring metrics
- ✅ A/B test framework ready

**Legal/Compliance:**
- ✅ Privacy policy updated (voice data handling)
- ✅ Terms updated (AI onboarding)
- ✅ Data retention policy clear
- ✅ GDPR compliance (if applicable)

---

## Success Metrics (Track These)

**Week 1:**
- X% of users choose Fast Setup
- X% complete Fast Setup successfully
- Average completion time: Y minutes
- Voice usage rate: Z%

**Month 1:**
- Completion rate Fast Setup vs Standard
- Drop-off points identified
- Most popular language after English
- Guidance Hub page views
- User feedback sentiment

**Month 3:**
- Impact on match quality (if measurable)
- User retention (do Fast Setup users stay longer?)
- Feature requests based on usage
- Expansion to more languages?

---

## Implementation Priority

**If you have limited time, implement in this order:**

**Must Have (Week 1):**
1. Voice input with Web Speech API
2. Voice confirmation for sensitive questions
3. Language selection (English + Urdu)
4. 5 core Guidance Hub articles

**Should Have (Week 2):**
5. Full multi-language (add Arabic + Bengali)
6. RTL support
7. Profile completion for existing users
8. Resume incomplete onboarding
9. All 8 Guidance Hub articles
10. Basic analytics logging

**Nice to Have (Week 3+):**
11. Whisper API fallback
12. Advanced analytics dashboard
13. A/B testing framework
14. Contextual guidance prompts
15. Feedback collection

---

## Proceed with Implementation

Implement all these features now. Start with voice input and multilingual support, then add Guidance Hub and profile completion features. Test thoroughly before production launch.

Build this as the complete Phase 2+3 implementation of Fusion's Fast Onboarding system.
