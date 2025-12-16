import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { OnboardingProgress } from "./OnboardingProgress";
import { ArrowLeft, ClipboardList, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export function FastOnboardingChat({ onComplete, onExitToForms }: FastOnboardingChatProps) {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      role: "assistant",
      content: INITIAL_MESSAGE,
      timestamp: new Date(),
    },
  ]);
  const [extractedData, setExtractedData] = useState<Partial<ExtractedData>>({});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [isTyping, setIsTyping] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string): Promise<AIResponse> => {
      const conversationHistory = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userMessage },
      ];
      
      const response = await apiRequest("POST", "/api/onboarding/ai-chat", {
        conversationHistory,
        currentExtractedData: extractedData,
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

      if (data.extractedData) {
        setExtractedData((prev) => ({ ...prev, ...data.extractedData }));
      }
      
      setCurrentQuestion(data.currentQuestion);

      if (data.isComplete) {
        setTimeout(() => {
          onComplete(extractedData as ExtractedData);
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-lg">F</span>
          </div>
          <div>
            <h1 className="font-semibold text-sm">Fusion Setup</h1>
            <p className="text-xs text-muted-foreground">AI Assistant</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExitToForms}
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-exit-to-forms"
        >
          <ClipboardList className="h-4 w-4 mr-2" />
          Use Forms
        </Button>
      </header>

      <OnboardingProgress currentQuestion={currentQuestion} />

      <div className="flex-1 overflow-y-auto p-4" data-testid="chat-messages-container">
        {messages.map((message, index) => (
          <ChatMessage
            key={index}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
          />
        ))}
        {isTyping && (
          <div className="flex justify-start mb-3">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={handleSendMessage}
        disabled={chatMutation.isPending || isTyping}
        placeholder="Type your response..."
      />
    </div>
  );
}
