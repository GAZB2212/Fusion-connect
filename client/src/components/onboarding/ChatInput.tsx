import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Mic, MicOff, X, Keyboard } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

type InputMode = "text" | "voice";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  language?: string;
  onVoiceError?: (error: string) => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type your message...",
  language = "en",
  onVoiceError,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    language,
    onError: (err) => {
      onVoiceError?.(err);
      setInputMode("text");
    },
    onEnd: () => {
      if (transcript.trim()) {
        setIsProcessing(true);
        setTimeout(() => {
          onSend(transcript.trim());
          resetTranscript();
          setInputMode("text");
          setIsProcessing(false);
        }, 300);
      }
    },
  });

  useEffect(() => {
    if (error) {
      onVoiceError?.(error);
    }
  }, [error, onVoiceError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleMicClick = () => {
    if (inputMode === "text") {
      setInputMode("voice");
      resetTranscript();
      startListening();
    } else if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleCancelVoice = () => {
    stopListening();
    resetTranscript();
    setInputMode("text");
  };

  const handleSwitchToText = () => {
    stopListening();
    if (transcript.trim()) {
      setMessage(transcript.trim());
    }
    resetTranscript();
    setInputMode("text");
  };

  const currentTranscript = transcript + interimTranscript;

  if (inputMode === "voice") {
    return (
      <div className="p-4 pb-20 border-t bg-background shrink-0">
        <div className="flex flex-col items-center gap-4">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing...</p>
            </div>
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <div
                  className={cn(
                    "h-20 w-20 rounded-full flex items-center justify-center transition-all",
                    isListening
                      ? "bg-red-500 animate-pulse"
                      : "bg-primary/10"
                  )}
                >
                  <button
                    onClick={handleMicClick}
                    className="h-full w-full flex items-center justify-center"
                    disabled={disabled}
                    data-testid="button-voice-record"
                  >
                    {isListening ? (
                      <Mic className="h-8 w-8 text-white" />
                    ) : (
                      <MicOff className="h-8 w-8 text-primary" />
                    )}
                  </button>
                </div>
                {isListening && (
                  <div className="absolute inset-0 h-20 w-20 rounded-full border-4 border-red-500 animate-ping" />
                )}
              </div>

              <p className="text-sm text-center text-muted-foreground">
                {isListening
                  ? "Listening... Tap to stop"
                  : "Tap microphone to start"}
              </p>

              {currentTranscript && (
                <div className="w-full bg-muted rounded-lg p-3 max-h-24 overflow-y-auto">
                  <p className="text-sm">
                    {transcript}
                    <span className="text-muted-foreground">
                      {interimTranscript}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelVoice}
                  disabled={disabled}
                  data-testid="button-cancel-voice"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSwitchToText}
                  disabled={disabled}
                  data-testid="button-switch-to-text"
                >
                  <Keyboard className="h-4 w-4 mr-1" />
                  Type instead
                </Button>
              </div>

              {error && (
                <p className="text-xs text-red-500 text-center">{error}</p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 p-4 pb-20 border-t bg-background shrink-0"
    >
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
        data-testid="input-chat-message"
      />
      {isSupported && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={handleMicClick}
          disabled={disabled}
          data-testid="button-start-voice"
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
      <Button
        type="submit"
        size="icon"
        disabled={!message.trim() || disabled}
        data-testid="button-send-message"
      >
        {disabled ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </form>
  );
}
