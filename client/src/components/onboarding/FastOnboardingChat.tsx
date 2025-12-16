import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { OnboardingProgress } from "./OnboardingProgress";
import { LanguageSelector, LanguageToggle } from "./LanguageSelector";
import { ClipboardList, Volume2, VolumeX } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, type SupportedLanguage } from "@/lib/i18n/onboarding";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { 
  INITIAL_MESSAGE, 
  type ChatMessage as ChatMessageType, 
  type ExtractedData,
  type AIResponse 
} from "@/lib/onboarding/prompts";

interface FastOnboardingChatProps {
  onComplete: (data: ExtractedData) => void;
  onExitToForms: () => void;
}

const INITIAL_MESSAGES_BY_LANG: Record<SupportedLanguage, string> = {
  en: INITIAL_MESSAGE,
  ur: "السلام علیکم! میں آپ کی پروفائل بنانے میں مدد کروں گا۔ چند سوالات کے ذریعے ہم آپ کی مکمل پروفائل بنائیں گے۔\n\nشروع کرنے سے پہلے، براہ کرم مجھے اپنا پہلا نام بتائیں؟",
  ar: "السلام عليكم! سأساعدك في إعداد ملفك الشخصي. من خلال بعض الأسئلة، سنقوم بإنشاء ملف شخصي كامل لك.\n\nقبل أن نبدأ، ما هو اسمك الأول؟",
  bn: "আসসালামু আলাইকুম! আমি আপনার প্রোফাইল সেটআপ করতে সাহায্য করব। কয়েকটি প্রশ্নের মাধ্যমে আমরা আপনার সম্পূর্ণ প্রোফাইল তৈরি করব।\n\nশুরু করার আগে, আপনার প্রথম নাম কী?",
};

export function FastOnboardingChat({ onComplete, onExitToForms }: FastOnboardingChatProps) {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [extractedData, setExtractedData] = useState<Partial<ExtractedData>>({});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(true);
  const [shouldAutoSpeak, setShouldAutoSpeak] = useState(false);

  const { t, translate, isRTL } = useTranslation(selectedLanguage || "en");

  const [autoStartListening, setAutoStartListening] = useState(false);

  const { speak, stop: stopSpeaking, isSpeaking, isLoading: ttsLoading, isSupported: ttsSupported } = useTextToSpeech({
    language: selectedLanguage || "en",
    onEnd: () => {
      setShouldAutoSpeak(false);
      if (voiceModeEnabled) {
        setAutoStartListening(true);
      }
    },
    onError: (error) => {
      console.error("[TTS] Error:", error);
      toast({
        title: "Voice playback issue",
        description: "Couldn't play the audio. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Check for existing conversation to resume
  const { data: existingConversation, isLoading: loadingConversation } = useQuery({
    queryKey: ["/api/onboarding/conversation"],
    enabled: true,
  });

  // Initialize with existing conversation or show language selection
  useEffect(() => {
    if (loadingConversation) return;

    if (existingConversation && (existingConversation as any).conversationHistory?.length > 0) {
      const conv = existingConversation as any;
      const lang = (conv.language as SupportedLanguage) || "en";
      setSelectedLanguage(lang);
      const history = conv.conversationHistory.map((m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(),
      }));
      setMessages(history);
      setExtractedData(conv.extractedData || {});
      setCurrentQuestion(conv.currentQuestionIndex || 1);
      
      // Auto-speak the last assistant message when resuming
      const lastMessage = history[history.length - 1];
      if (lastMessage?.role === "assistant" && voiceModeEnabled) {
        setTimeout(() => speak(lastMessage.content), 800);
      }
    }
  }, [existingConversation, loadingConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleLanguageSelect = (lang: SupportedLanguage) => {
    setSelectedLanguage(lang);
    setShowLanguageSelector(false);
    const initialMessage = INITIAL_MESSAGES_BY_LANG[lang];
    setMessages([
      {
        role: "assistant",
        content: initialMessage,
        timestamp: new Date(),
      },
    ]);
    if (voiceModeEnabled && ttsSupported) {
      setTimeout(() => speak(initialMessage), 500);
    }
  };

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string): Promise<AIResponse> => {
      const conversationHistory = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userMessage },
      ];
      
      const response = await apiRequest("POST", "/api/onboarding/ai-chat", {
        conversationHistory,
        currentExtractedData: extractedData,
        language: selectedLanguage,
      });
      
      return response.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
        },
      ]);

      const mergedData = { ...extractedData, ...data.extractedData };
      
      if (data.extractedData) {
        setExtractedData(mergedData);
      }
      
      setCurrentQuestion(data.currentQuestion);

      if (voiceModeEnabled && ttsSupported && !data.isComplete) {
        setTimeout(() => speak(data.reply), 300);
      }

      if (data.isComplete) {
        setTimeout(() => {
          onComplete(mergedData as ExtractedData);
        }, 500);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Something went wrong",
        description: error.message || "Please try again or switch to standard forms.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsTyping(false);
    },
  });

  const handleSendMessage = (content: string) => {
    const userMessage: ChatMessageType = {
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate(content);
  };

  const handleVoiceError = (error: string) => {
    toast({
      title: t.havingTrouble,
      description: error,
      variant: "destructive",
    });
  };

  // Show language selection if no language selected
  if (!selectedLanguage && !loadingConversation) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <LanguageSelector onSelect={handleLanguageSelect} />
      </div>
    );
  }

  // Loading state
  if (loadingConversation) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-screen bg-background flex flex-col overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <header className="flex items-center justify-between p-4 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-lg">F</span>
          </div>
          <div>
            <h1 className="font-semibold text-sm">{t.fastSetup}</h1>
            <p className="text-xs text-muted-foreground">AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ttsSupported && (
            <Button
              variant={voiceModeEnabled ? "default" : "outline"}
              size="icon"
              onClick={() => {
                if (isSpeaking) stopSpeaking();
                setVoiceModeEnabled(!voiceModeEnabled);
              }}
              className="h-8 w-8"
              data-testid="button-toggle-voice-mode"
              title={voiceModeEnabled ? "Voice mode on" : "Voice mode off"}
            >
              {voiceModeEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
          )}
          {selectedLanguage && (
            <LanguageToggle
              currentLanguage={selectedLanguage}
              onToggle={() => setShowLanguageSelector(true)}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onExitToForms}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-exit-to-forms"
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            {t.exitToForms}
          </Button>
        </div>
      </header>

      {showLanguageSelector && (
        <div className="absolute inset-0 bg-background/95 z-50 flex items-center justify-center p-4">
          <div className="space-y-4">
            <LanguageSelector
              onSelect={(lang) => {
                handleLanguageSelect(lang);
              }}
              currentLanguage={selectedLanguage || undefined}
              showTitle={false}
            />
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowLanguageSelector(false)}
              data-testid="button-cancel-language"
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      )}

      <div className="shrink-0">
        <OnboardingProgress currentQuestion={currentQuestion} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0" data-testid="chat-messages-container">
        {messages.map((message, index) => (
          <ChatMessage
            key={index}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
            isRTL={isRTL}
          />
        ))}
        {isTyping && (
          <div className={`flex ${isRTL ? "justify-end" : "justify-start"} mb-3`}>
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {(isSpeaking || ttsLoading) && (
          <div className={`flex ${isRTL ? "justify-end" : "justify-start"} mb-3`}>
            <div className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs flex items-center gap-2">
              <Volume2 className="h-3 w-3 animate-pulse" />
              {ttsLoading ? "Preparing..." : "Speaking..."}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={handleSendMessage}
        disabled={chatMutation.isPending || isTyping || isSpeaking || ttsLoading}
        placeholder={t.typeMessage}
        language={selectedLanguage || "en"}
        onVoiceError={handleVoiceError}
        autoStartListening={autoStartListening}
        onListeningStarted={() => setAutoStartListening(false)}
        skipConfirmation={voiceModeEnabled}
      />
    </div>
  );
}
