import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, StopCircle, Play, RotateCcw, Upload, Loader2, Lightbulb } from "lucide-react";

const VIDEO_PROMPTS = [
  "Tell us about yourself and what you're looking for",
  "Share a fun fact about yourself",
  "What does your ideal day look like?",
  "What are you most passionate about?",
  "What does family mean to you?",
  "Describe your perfect weekend",
  "What are your goals for the next few years?",
  "What makes you laugh?",
];

interface VideoRecorderProps {
  onVideoRecorded: (videoBlob: Blob) => void;
  onCancel?: () => void;
  isUploading?: boolean;
  existingVideoUrl?: string | null;
}

export function VideoRecorder({ 
  onVideoRecorded, 
  onCancel, 
  isUploading = false,
  existingVideoUrl 
}: VideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(20);
  const [cameraActive, setCameraActive] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [showPrompts, setShowPrompts] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Unable to access camera. Please allow camera and microphone permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm',
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedVideo(blob);
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      stopCamera();
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
    setCountdown(20);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }
  };

  const retakeVideo = () => {
    setRecordedVideo(null);
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    setCountdown(20);
    startCamera();
  };

  const handleUpload = () => {
    if (recordedVideo) {
      onVideoRecorded(recordedVideo);
    }
  };

  const nextPrompt = () => {
    setCurrentPromptIndex((prev) => (prev + 1) % VIDEO_PROMPTS.length);
  };

  if (recordedVideoUrl) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Preview Your Video</h3>
          
          <div className="relative aspect-[9/16] max-h-[400px] mx-auto bg-black rounded-lg overflow-hidden">
            <video
              ref={previewRef}
              src={recordedVideoUrl}
              className="w-full h-full object-cover"
              controls
              playsInline
            />
          </div>

          <div className="flex gap-3 justify-center">
            <Button 
              variant="outline" 
              onClick={retakeVideo}
              disabled={isUploading}
              data-testid="button-retake-video"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={isUploading}
              data-testid="button-upload-video"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Use This Video
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Record Your Intro Video</h3>
          <Badge variant="outline">20 sec max</Badge>
        </div>

        {showPrompts && (
          <div className="bg-muted/50 rounded-lg p-4 border">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Idea for your video:</p>
                <p className="text-sm text-muted-foreground">
                  "{VIDEO_PROMPTS[currentPromptIndex]}"
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={nextPrompt}
                  className="mt-2 h-7 px-2 text-xs"
                  data-testid="button-next-prompt"
                >
                  Show another idea
                </Button>
              </div>
            </div>
          </div>
        )}

        {!cameraActive ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Video className="h-10 w-10 text-primary" />
            </div>
            <p className="text-center text-muted-foreground text-sm max-w-xs">
              Record a short video introduction so potential matches can get to know you better
            </p>
            <Button onClick={startCamera} data-testid="button-start-camera">
              <Video className="h-4 w-4 mr-2" />
              Start Camera
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel} data-testid="button-skip-video">
                Skip for now
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-[9/16] max-h-[400px] mx-auto bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              
              {isRecording && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white font-bold text-xl bg-black/50 px-3 py-1 rounded-full">
                    {countdown}s
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              {!isRecording ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={stopCamera}
                    data-testid="button-cancel-camera"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={startRecording}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="button-start-recording"
                  >
                    <div className="h-3 w-3 rounded-full bg-white mr-2" />
                    Start Recording
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={stopRecording}
                  variant="destructive"
                  data-testid="button-stop-recording"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Stop Recording
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

interface VideoPlayerProps {
  videoUrl: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  showControls?: boolean;
}

export function VideoPlayer({ 
  videoUrl, 
  className = "",
  autoPlay = false,
  muted = true,
  showControls = true
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover"
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        loop
        controls={showControls}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      
      {!showControls && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          data-testid="button-toggle-video"
        >
          {!isPlaying && (
            <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="h-8 w-8 text-primary ml-1" />
            </div>
          )}
        </button>
      )}
    </div>
  );
}
