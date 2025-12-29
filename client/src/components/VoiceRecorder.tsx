import { useState, useEffect, useRef } from 'react';
import { Mic, X, Send, Square, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder, formatDuration } from '@/hooks/use-voice-recorder';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onSend, onCancel, disabled }: VoiceRecorderProps) {
  const {
    isRecording,
    isPaused,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    pauseRecording,
    resumeRecording,
  } = useVoiceRecorder();

  const handleMicClick = async () => {
    if (!isRecording) {
      await startRecording();
    }
  };

  const handleStop = async () => {
    const blob = await stopRecording();
    if (blob && duration > 0) {
      onSend(blob, duration);
    }
  };

  const handleCancel = () => {
    cancelRecording();
    onCancel?.();
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm px-3 py-2">
        <span>{error}</span>
        <Button size="icon" variant="ghost" onClick={handleCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-between px-4 z-50 border-t border-border">
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={handleCancel}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          data-testid="button-cancel-recording"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rounded-full",
              isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse"
            )} />
            <span className="text-lg font-mono font-medium text-foreground min-w-[60px]">
              {formatDuration(duration)}
            </span>
          </div>
          
          <Button
            size="icon"
            variant="ghost"
            onClick={isPaused ? resumeRecording : pauseRecording}
            className="text-muted-foreground"
            data-testid="button-pause-resume-recording"
          >
            {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </Button>
        </div>

        <Button 
          size="icon" 
          onClick={handleStop}
          className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-600 hover:to-yellow-600 rounded-full w-10 h-10"
          data-testid="button-send-voice-note"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleMicClick}
      disabled={disabled}
      className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 flex-shrink-0"
      data-testid="button-start-voice-recording"
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}

export function VoiceMessagePlayer({ 
  url, 
  duration,
  isSent 
}: { 
  url: string; 
  duration?: number;
  isSent: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-2xl min-w-[180px] max-w-[260px]",
      isSent 
        ? "bg-gradient-to-r from-amber-500/90 to-yellow-500/90" 
        : "bg-muted"
    )}>
      <audio ref={audioRef} src={url} preload="metadata" />
      
      <Button
        size="icon"
        variant="ghost"
        onClick={togglePlay}
        className={cn(
          "h-10 w-10 rounded-full flex-shrink-0",
          isSent 
            ? "bg-black/20 text-black hover:bg-black/30" 
            : "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
        )}
        data-testid="button-play-voice-note"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </Button>

      <div className="flex-1 flex flex-col gap-1">
        <div className="h-1 bg-black/20 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              isSent ? "bg-black/40" : "bg-amber-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={cn(
          "text-xs font-mono",
          isSent ? "text-black/70" : "text-muted-foreground"
        )}>
          {formatDuration(Math.floor(isPlaying ? currentTime : audioDuration))}
        </span>
      </div>
    </div>
  );
}
