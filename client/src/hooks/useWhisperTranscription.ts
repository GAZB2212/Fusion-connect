import { useState, useRef, useCallback } from "react";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/queryClient";

interface UseWhisperTranscriptionOptions {
  language?: string;
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseWhisperTranscriptionResult {
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  resetTranscript: () => void;
}

export function useWhisperTranscription(
  options: UseWhisperTranscriptionOptions = {}
): UseWhisperTranscriptionResult {
  const { language = "en", onTranscript, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4') 
          ? 'audio/mp4' 
          : 'audio/wav';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err: any) {
      console.error("[Whisper] Failed to start recording:", err);
      const errorMsg = err.name === "NotAllowedError" 
        ? "Microphone permission was denied. Please enable it in your settings."
        : "Could not access microphone. Please check your device settings.";
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [onError]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!mediaRecorderRef.current || !isRecording) {
      return null;
    }

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      
      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        if (audioChunksRef.current.length === 0) {
          resolve(null);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType 
        });
        
        if (audioBlob.size < 1000) {
          setError("No audio was captured. Please try again.");
          resolve(null);
          return;
        }

        setIsTranscribing(true);

        try {
          const formData = new FormData();
          const extension = mediaRecorder.mimeType.includes('webm') ? 'webm' : 
                           mediaRecorder.mimeType.includes('mp4') ? 'm4a' : 'wav';
          formData.append("audio", audioBlob, `recording.${extension}`);
          formData.append("language", language);

          const token = getAuthToken();
          const response = await fetch(getApiUrl("/api/onboarding/transcribe"), {
            method: "POST",
            body: formData,
            credentials: "include",
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          });

          if (!response.ok) {
            throw new Error("Transcription failed");
          }

          const data = await response.json();
          const text = data.text?.trim() || "";
          
          setTranscript(text);
          onTranscript?.(text);
          setIsTranscribing(false);
          resolve(text);
        } catch (err: any) {
          console.error("[Whisper] Transcription error:", err);
          const errorMsg = "Failed to transcribe audio. Please try again.";
          setError(errorMsg);
          onError?.(errorMsg);
          setIsTranscribing(false);
          resolve(null);
        }
      };

      mediaRecorder.stop();
    });
  }, [isRecording, language, onTranscript, onError]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
    audioChunksRef.current = [];
  }, []);

  return {
    isRecording,
    isTranscribing,
    transcript,
    error,
    startRecording,
    stopRecording,
    resetTranscript,
  };
}
