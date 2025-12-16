import { useState, useRef, useCallback, useEffect } from "react";

interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (result: SpeechRecognitionResult) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

interface SpeechRecognitionHook {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  hasPermission: boolean;
  error: string | null;
  confidence: number;
  requestPermission: () => Promise<boolean>;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const languageCodes: Record<string, string> = {
  en: "en-US",
  ur: "ur-PK",
  ar: "ar-SA",
  bn: "bn-BD",
};

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): SpeechRecognitionHook {
  const {
    language = "en",
    continuous = false,
    interimResults = true,
    onResult,
    onError,
    onEnd,
  } = options;

  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);

  const recognitionRef = useRef<any>(null);

  const isSupported =
    typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      setError(null);
      return true;
    } catch (err: any) {
      console.error("[SpeechRecognition] Permission denied:", err);
      setHasPermission(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        const errorMsg = "Microphone permission was denied. Please enable it in your browser settings.";
        setError(errorMsg);
        onError?.(errorMsg);
      } else if (err.name === "NotFoundError") {
        const errorMsg = "No microphone was found on this device.";
        setError(errorMsg);
        onError?.(errorMsg);
      } else {
        const errorMsg = "Could not access microphone. Please check your device settings.";
        setError(errorMsg);
        onError?.(errorMsg);
      }
      return false;
    }
  }, [isSupported, onError]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      const errorMsg = "Speech recognition is not supported in this browser";
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        return;
      }
    }

    setError(null);
    setTranscript("");
    setInterimTranscript("");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = languageCodes[language] || languageCodes.en;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;
        const resultConfidence = result[0].confidence || 0;

        if (result.isFinal) {
          finalTranscript += transcriptText;
          setConfidence(resultConfidence);
          onResult?.({
            transcript: transcriptText,
            confidence: resultConfidence,
            isFinal: true,
          });
        } else {
          interim += transcriptText;
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      let errorMessage = "An error occurred during speech recognition";

      switch (event.error) {
        case "no-speech":
          errorMessage = "No speech was detected. Please try again.";
          break;
        case "audio-capture":
          errorMessage = "No microphone was found or it is not accessible.";
          break;
        case "not-allowed":
          errorMessage =
            "Microphone permission was denied. Please enable it in your browser settings.";
          break;
        case "network":
          errorMessage =
            "A network error occurred. Please check your connection.";
          break;
        case "aborted":
          errorMessage = "Speech recognition was aborted.";
          break;
        case "language-not-supported":
          errorMessage = "The selected language is not supported.";
          break;
      }

      setError(errorMessage);
      setIsListening(false);
      onError?.(errorMessage);
    };

    recognition.onend = () => {
      setIsListening(false);
      onEnd?.();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      const errorMsg = "Failed to start speech recognition";
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [isSupported, hasPermission, requestPermission, language, continuous, interimResults, onResult, onError, onEnd]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setConfidence(0);
    setError(null);
  }, []);

  // Clean up recognition when language changes
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language]);

  // Also ensure cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    hasPermission,
    error,
    confidence,
    requestPermission,
    startListening,
    stopListening,
    resetTranscript,
  };
}
