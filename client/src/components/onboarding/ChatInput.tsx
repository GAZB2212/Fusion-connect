import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Mic, MicOff, X, Keyboard, Check, RotateCcw, Volume2, Square } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useWhisperTranscription } from "@/hooks/useWhisperTranscription";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/onboarding";

type VoiceState = "idle" | "listening" | "confirming" | "processing";
type InputMode = "text" | "voice";

const isIOS = () => {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

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
  
  const useWhisperMode = useMemo(() => isIOS(), []);

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    hasPermission,
    error,
    requestPermission,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    language,
    onError: (err) => {
      if (!useWhisperMode) {
        onVoiceError?.(err);
        setVoiceState("idle");
        setInputMode("text");
      }
    },
    onEnd: () => {
      if (useWhisperMode) return;
      
      const finalTranscript = transcriptRef.current.trim();
      
      if (finalTranscript) {
        if (skipConfirmation) {
          resetTranscript();
          setConfirmedTranscript("");
          setVoiceState("idle");
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

  const {
    isRecording: whisperRecording,
    isTranscribing,
    transcript: whisperTranscript,
    error: whisperError,
    startRecording,
    stopRecording,
    resetTranscript: resetWhisperTranscript,
  } = useWhisperTranscription({
    language,
    onError: (err) => {
      onVoiceError?.(err);
      setVoiceState("idle");
    },
  });

  // Keep transcript ref in sync
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const voiceSupported = useWhisperMode || isSupported;
  const activelyListening = useWhisperMode ? whisperRecording : isListening;
  const activeError = useWhisperMode ? whisperError : error;

  useEffect(() => {
    if (autoStartVoice && voiceSupported && inputMode === "text" && !disabled) {
      if (useWhisperMode) {
        setInputMode("voice");
        setVoiceState("idle");
      } else {
        requestPermission().then((granted) => {
          if (granted) {
            setInputMode("voice");
            setVoiceState("idle");
          }
        });
      }
    }
  }, [autoStartVoice, voiceSupported, disabled, useWhisperMode]);

  useEffect(() => {
    if (autoStartListening && voiceSupported && !disabled && !activelyListening && voiceState !== "confirming" && voiceState !== "processing") {
      setInputMode("voice");
      if (useWhisperMode) {
        resetWhisperTranscript();
      } else {
        resetTranscript();
      }
      setConfirmedTranscript("");
      setVoiceState("listening");
      const timer = setTimeout(async () => {
        if (useWhisperMode) {
          await startRecording();
        } else {
          await startListening();
        }
        onListeningStarted?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStartListening, voiceSupported, disabled, activelyListening, voiceState, useWhisperMode]);

  useEffect(() => {
    if (activeError && !useWhisperMode) {
      onVoiceError?.(activeError);
    }
  }, [activeError, onVoiceError, useWhisperMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleStartVoiceMode = async () => {
    if (useWhisperMode) {
      setInputMode("voice");
      setVoiceState("idle");
      resetWhisperTranscript();
      setConfirmedTranscript("");
    } else {
      const granted = await requestPermission();
      if (granted) {
        setInputMode("voice");
        setVoiceState("idle");
        resetTranscript();
        setConfirmedTranscript("");
      }
    }
  };

  const handleStartListening = async () => {
    if (useWhisperMode) {
      resetWhisperTranscript();
    } else {
      resetTranscript();
    }
    setConfirmedTranscript("");
    setVoiceState("listening");
    if (useWhisperMode) {
      await startRecording();
    } else {
      await startListening();
    }
  };

  const handleStopListening = async () => {
    if (useWhisperMode) {
      setVoiceState("processing");
      const text = await stopRecording();
      if (text) {
        if (skipConfirmation) {
          resetWhisperTranscript();
          setConfirmedTranscript("");
          setVoiceState("idle");
          onSend(text);
        } else {
          setConfirmedTranscript(text);
          setVoiceState("confirming");
        }
      } else {
        setVoiceState("idle");
      }
    } else {
      stopListening();
    }
  };

  const handleConfirmTranscript = () => {
    setVoiceState("processing");
    setTimeout(() => {
      onSend(confirmedTranscript);
      if (useWhisperMode) {
        resetWhisperTranscript();
      } else {
        resetTranscript();
      }
      setConfirmedTranscript("");
      setVoiceState("idle");
    }, 300);
  };

  const handleRetryVoice = async () => {
    if (useWhisperMode) {
      resetWhisperTranscript();
    } else {
      resetTranscript();
    }
    setConfirmedTranscript("");
    setVoiceState("listening");
    if (useWhisperMode) {
      await startRecording();
    } else {
      await startListening();
    }
  };

  const handleEditAsText = () => {
    setMessage(confirmedTranscript);
    setConfirmedTranscript("");
    if (useWhisperMode) {
      resetWhisperTranscript();
    } else {
      resetTranscript();
    }
    setInputMode("text");
    setVoiceState("idle");
  };

  const handleCancelVoice = () => {
    if (useWhisperMode) {
      stopRecording();
      resetWhisperTranscript();
    } else {
      stopListening();
      resetTranscript();
    }
    setConfirmedTranscript("");
    setInputMode("text");
    setVoiceState("idle");
  };

  const currentTranscript = useWhisperMode 
    ? (whisperRecording ? "Recording..." : whisperTranscript)
    : (transcript + interimTranscript);

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
          ) : isTranscribing ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Transcribing...</p>
            </div>
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <div
                  className={cn(
                    "h-24 w-24 rounded-full flex items-center justify-center transition-all cursor-pointer",
                    activelyListening
                      ? "bg-red-500 animate-pulse"
                      : "bg-primary hover:bg-primary/90"
                  )}
                  onClick={activelyListening ? handleStopListening : handleStartListening}
                  data-testid="button-voice-record"
                >
                  {activelyListening ? (
                    useWhisperMode ? (
                      <Square className="h-10 w-10 text-white" />
                    ) : (
                      <Volume2 className="h-10 w-10 text-white animate-pulse" />
                    )
                  ) : (
                    <Mic className="h-10 w-10 text-white" />
                  )}
                </div>
                {activelyListening && (
                  <div className="absolute inset-0 h-24 w-24 rounded-full border-4 border-red-500/50 animate-ping" />
                )}
              </div>

              <p className="text-sm text-center font-medium">
                {activelyListening
                  ? (useWhisperMode 
                      ? "Recording... Tap to stop" 
                      : (t.listeningTapToStop || "Listening... Tap to stop"))
                  : t.tapToSpeak || "Tap to speak your answer"}
              </p>

              {currentTranscript && !useWhisperMode && (
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
                  disabled={disabled || activelyListening}
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
      {voiceSupported && (
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
