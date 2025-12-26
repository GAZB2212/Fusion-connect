import { useState, useCallback, useRef, useEffect } from "react";
import { getApiUrl, getAuthToken } from "@/lib/queryClient";

interface UseTextToSpeechOptions {
  language?: string;
  onEnd?: () => void;
  onStart?: () => void;
  onError?: (error: Error) => void;
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}) {
  const { language = "en", onEnd, onStart, onError } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      setIsLoading(true);
      abortControllerRef.current = new AbortController();

      try {
        const token = getAuthToken();
        const response = await fetch(getApiUrl("/api/tts"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text, language }),
          signal: abortControllerRef.current.signal,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to generate speech");
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsSpeaking(true);
          setIsLoading(false);
          onStart?.();
        };

        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          onEnd?.();
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          setIsLoading(false);
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          onError?.(new Error("Audio playback failed"));
        };

        await audio.play();
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("[TTS] Error:", error);
          setIsLoading(false);
          onError?.(error);
        }
      }
    },
    [language, onEnd, onStart, onError]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
    isSupported: true, // OpenAI TTS is always supported if backend is available
  };
}
