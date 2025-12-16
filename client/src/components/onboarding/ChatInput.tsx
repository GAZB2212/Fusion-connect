import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Mic, MicOff, X, Keyboard, Check, RotateCcw, Volume2 } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/onboarding";

type VoiceState = "idle" | "listening" | "confirming" | "processing";
type InputMode = "text" | "voice";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  language?: string;
  onVoiceError?: (error: string) => void;
  autoStartVoice?: boolean;
  autoStartListening?: boolean;
  onListeningStarted?: () => void;
  skipConfirmation?: boolean;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type your message...",
  language = "en",
  onVoiceError,
  autoStartVoice = false,
  autoStartListening = false,
  onListeningStarted,
  skipConfirmation = false,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [confirmedTranscript, setConfirmedTranscript] = useState("");
  const transcriptRef = useRef("");

  const { t } = useTranslation(language as any);

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
      setVoiceState("idle");
      setInputMode("text");
    },
    onEnd: () => {
      // Capture transcript immediately in case it changes
      const finalTranscript = transcriptRef.current.trim();
      
      if (finalTranscript) {
        if (skipConfirmation) {
          // Send immediately without confirmation
          // Clear state first, THEN send
          resetTranscript();
          setConfirmedTranscript("");
          setVoiceState("idle");
          // Use captured transcript, not the state
          onSend(finalTranscript);
        } else {
          setConfirmedTranscript(finalTranscript);
          setVoiceState("confirming");
        }
      } else {
        setVoiceState("idle");
      }
    },
  });

  // Keep transcript ref in sync
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (autoStartVoice && isSupported && inputMode === "text" && !disabled) {
      setInputMode("voice");
      setVoiceState("idle");
    }
  }, [autoStartVoice, isSupported, disabled]);

  useEffect(() => {
    if (autoStartListening && isSupported && !disabled && !isListening && voiceState !== "confirming" && voiceState !== "processing") {
      setInputMode("voice");
      resetTranscript();
      setConfirmedTranscript("");
      setVoiceState("listening");
      startListening();
      onListeningStarted?.();
    }
  }, [autoStartListening, isSupported, disabled, isListening, voiceState]);

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

  const handleStartVoiceMode = () => {
    setInputMode("voice");
    setVoiceState("idle");
    resetTranscript();
    setConfirmedTranscript("");
  };

  const handleStartListening = () => {
    resetTranscript();
    setConfirmedTranscript("");
    setVoiceState("listening");
    startListening();
  };

  const handleStopListening = () => {
    stopListening();
  };

  const handleConfirmTranscript = () => {
    setVoiceState("processing");
    setTimeout(() => {
      onSend(confirmedTranscript);
      resetTranscript();
      setConfirmedTranscript("");
      setVoiceState("idle");
    }, 300);
  };

  const handleRetryVoice = () => {
    resetTranscript();
    setConfirmedTranscript("");
    setVoiceState("listening");
    startListening();
  };

  const handleEditAsText = () => {
    setMessage(confirmedTranscript);
    setConfirmedTranscript("");
    resetTranscript();
    setInputMode("text");
    setVoiceState("idle");
  };

  const handleCancelVoice = () => {
    stopListening();
    resetTranscript();
    setConfirmedTranscript("");
    setInputMode("text");
    setVoiceState("idle");
  };

  const currentTranscript = transcript + interimTranscript;

  if (inputMode === "voice") {
    return (
      <div className="p-4 pb-20 border-t bg-background shrink-0">
        <div className="flex flex-col items-center gap-4">
          {voiceState === "processing" ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t.processing || "Sending..."}</p>
            </div>
          ) : voiceState === "confirming" ? (
            <div className="w-full space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">{t.youSaid || "You said:"}</p>
                <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                  <p className="text-base font-medium">{confirmedTranscript}</p>
                </div>
              </div>

              <p className="text-sm text-center text-muted-foreground">
                {t.isThisCorrect || "Is this correct?"}
              </p>

              <div className="flex gap-2 justify-center">
                <Button
                  variant="default"
                  onClick={handleConfirmTranscript}
                  disabled={disabled}
                  className="flex-1 max-w-[140px]"
                  data-testid="button-confirm-voice"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {t.yesThatsRight || "Yes, send"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRetryVoice}
                  disabled={disabled}
                  className="flex-1 max-w-[140px]"
                  data-testid="button-retry-voice"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t.tryAgain || "Try again"}
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditAsText}
                disabled={disabled}
                className="w-full text-muted-foreground"
                data-testid="button-edit-as-text"
              >
                <Keyboard className="h-4 w-4 mr-1" />
                {t.editAsText || "Edit as text"}
              </Button>
            </div>
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <div
                  className={cn(
                    "h-24 w-24 rounded-full flex items-center justify-center transition-all cursor-pointer",
                    isListening
                      ? "bg-red-500 animate-pulse"
                      : "bg-primary hover:bg-primary/90"
                  )}
                  onClick={isListening ? handleStopListening : handleStartListening}
                  data-testid="button-voice-record"
                >
                  {isListening ? (
                    <Volume2 className="h-10 w-10 text-white animate-pulse" />
                  ) : (
                    <Mic className="h-10 w-10 text-white" />
                  )}
                </div>
                {isListening && (
                  <div className="absolute inset-0 h-24 w-24 rounded-full border-4 border-red-500/50 animate-ping" />
                )}
              </div>

              <p className="text-sm text-center font-medium">
                {isListening
                  ? t.listeningTapToStop || "Listening... Tap to stop"
                  : t.tapToSpeak || "Tap to speak your answer"}
              </p>

              {currentTranscript && (
                <div className="w-full bg-muted rounded-lg p-3 max-h-24 overflow-y-auto">
                  <p className="text-sm">
                    {transcript}
                    <span className="text-muted-foreground italic">
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
                  disabled={disabled || isListening}
                  data-testid="button-cancel-voice"
                >
                  <Keyboard className="h-4 w-4 mr-1" />
                  {t.typeInstead || "Type instead"}
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
          variant="outline"
          onClick={handleStartVoiceMode}
          disabled={disabled}
          className="shrink-0"
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
