export type SupportedLanguage = "en" | "ur" | "ar" | "bn";

export interface OnboardingTranslations {
  fastSetup: string;
  standardSetup: string;
  exitToForms: string;
  skip: string;
  next: string;
  confirm: string;
  retry: string;
  typeInstead: string;
  listeningSpeech: string;
  processingSpeech: string;
  confirmTranscript: string;
  isThisCorrect: string;
  havingTrouble: string;
  switchToTyping: string;
  questionProgress: string;
  reviewProfile: string;
  looksGood: string;
  editAnswer: string;
  startOver: string;
  chooseLanguage: string;
  welcome: string;
  continueChat: string;
  startFresh: string;
  useStandardForms: string;
  welcomeBack: string;
  resumeMessage: string;
  micPermissionDenied: string;
  micPermissionMessage: string;
  tryAgain: string;
  cancel: string;
  send: string;
  typeMessage: string;
}

export const translations: Record<SupportedLanguage, OnboardingTranslations> = {
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
    chooseLanguage: "Choose your language",
    welcome: "Welcome to Fusion",
    continueChat: "Continue Where I Left Off",
    startFresh: "Start Fresh",
    useStandardForms: "Use Standard Forms",
    welcomeBack: "Welcome back!",
    resumeMessage: "You started Fast Setup {{days}} days ago. You were on question {{current}} of {{total}}.",
    micPermissionDenied: "Microphone access needed",
    micPermissionMessage: "Please enable microphone in your browser settings to use voice.",
    tryAgain: "Try Again",
    cancel: "Cancel",
    send: "Send",
    typeMessage: "Type your message...",
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
    chooseLanguage: "اپنی زبان منتخب کریں",
    welcome: "فیوژن میں خوش آمدید",
    continueChat: "جہاں چھوڑا تھا وہیں سے جاری رکھیں",
    startFresh: "نئے سرے سے شروع کریں",
    useStandardForms: "معیاری فارم استعمال کریں",
    welcomeBack: "واپسی پر خوش آمدید!",
    resumeMessage: "آپ نے {{days}} دن پہلے فاسٹ سیٹ اپ شروع کیا تھا۔ آپ سوال {{current}} از {{total}} پر تھے۔",
    micPermissionDenied: "مائیکروفون کی اجازت درکار ہے",
    micPermissionMessage: "براہ کرم آواز استعمال کرنے کے لیے اپنے براؤزر کی ترتیبات میں مائیکروفون کو فعال کریں۔",
    tryAgain: "دوبارہ کوشش کریں",
    cancel: "منسوخ کریں",
    send: "بھیجیں",
    typeMessage: "اپنا پیغام لکھیں...",
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
    chooseLanguage: "اختر لغتك",
    welcome: "مرحباً بك في فيوجن",
    continueChat: "استمر من حيث توقفت",
    startFresh: "ابدأ من جديد",
    useStandardForms: "استخدم النماذج القياسية",
    welcomeBack: "مرحباً بعودتك!",
    resumeMessage: "بدأت الإعداد السريع منذ {{days}} أيام. كنت في السؤال {{current}} من {{total}}.",
    micPermissionDenied: "مطلوب إذن الميكروفون",
    micPermissionMessage: "يرجى تمكين الميكروفون في إعدادات المتصفح لاستخدام الصوت.",
    tryAgain: "حاول مرة أخرى",
    cancel: "إلغاء",
    send: "إرسال",
    typeMessage: "اكتب رسالتك...",
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
    chooseLanguage: "আপনার ভাষা নির্বাচন করুন",
    welcome: "ফিউশনে স্বাগতম",
    continueChat: "যেখানে ছিলেন সেখান থেকে চালিয়ে যান",
    startFresh: "নতুন করে শুরু করুন",
    useStandardForms: "স্ট্যান্ডার্ড ফর্ম ব্যবহার করুন",
    welcomeBack: "ফিরে আসার জন্য স্বাগতম!",
    resumeMessage: "আপনি {{days}} দিন আগে ফাস্ট সেটআপ শুরু করেছিলেন। আপনি {{total}} এর মধ্যে {{current}} প্রশ্নে ছিলেন।",
    micPermissionDenied: "মাইক্রোফোন অ্যাক্সেস প্রয়োজন",
    micPermissionMessage: "ভয়েস ব্যবহার করতে আপনার ব্রাউজার সেটিংসে মাইক্রোফোন সক্ষম করুন।",
    tryAgain: "আবার চেষ্টা করুন",
    cancel: "বাতিল",
    send: "পাঠান",
    typeMessage: "আপনার বার্তা লিখুন...",
  },
};

export function useTranslation(lang: SupportedLanguage | string) {
  const language = (lang in translations ? lang : "en") as SupportedLanguage;
  const t = translations[language];

  const translate = (key: keyof OnboardingTranslations, params?: Record<string, string | number>) => {
    let text = t[key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        text = text.replace(new RegExp(`{{${key}}}`, "g"), String(value));
      });
    }
    return text;
  };

  return { t, translate, language, isRTL: language === "ar" || language === "ur" };
}

export const languageOptions = [
  { code: "en" as const, name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "ur" as const, name: "Urdu", nativeName: "اردو", flag: "🇵🇰" },
  { code: "ar" as const, name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "bn" as const, name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩" },
];
