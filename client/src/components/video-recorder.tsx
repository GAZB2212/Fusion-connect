import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Video, StopCircle, Loader2, Lightbulb, X, Play } from "lucide-react";
import { isCapacitorNative, isIOS } from "@/lib/platform";
import { requestCameraAndMicrophonePermissions } from "@/lib/permissions";

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
  const [countdown, setCountdown] = useState(20);
  const [cameraActive, setCameraActive] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [showPrompts, setShowPrompts] = useState(true);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
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
    };
  }, []);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMediaRecorderSupported, setIsMediaRecorderSupported] = useState(true);

  useEffect(() => {
    if (typeof MediaRecorder === 'undefined') {
      setIsMediaRecorderSupported(false);
    }
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setIsFullscreenOpen(true);
    
    try {
      console.log('[VideoRecorder] Checking camera and microphone permissions...');
      
      const permissionResult = await requestCameraAndMicrophonePermissions();
      
      if (!permissionResult.granted) {
        console.log('[VideoRecorder] Permission denied:', permissionResult.errorMessage);
        setCameraError(permissionResult.errorMessage || 'Camera access denied');
        return;
      }
      
      console.log('[VideoRecorder] Permissions granted, accessing camera...');
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 1280 }
        },
        audio: true,
      };
      
      console.log('[VideoRecorder] Using constraints:', JSON.stringify(constraints));
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[VideoRecorder] Got stream with tracks:', stream.getTracks().map(t => `${t.kind}: ${t.label}`));
      
      streamRef.current = stream;
      
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        videoRef.current.muted = true;
        
        videoRef.current.srcObject = stream;
        
        console.log('[VideoRecorder] Stream attached to video element');
        
        try {
          await videoRef.current.play();
          console.log('[VideoRecorder] Video playback started');
        } catch (playError) {
          console.warn('[VideoRecorder] Auto-play failed, trying again:', playError);
          setTimeout(async () => {
            try {
              await videoRef.current?.play();
              console.log('[VideoRecorder] Delayed play succeeded');
            } catch (e) {
              console.error('[VideoRecorder] Delayed play also failed:', e);
            }
          }, 500);
        }
      }
      
      setCameraActive(true);
    } catch (error: any) {
      console.error("[VideoRecorder] Error accessing camera:", error);
      let errorMessage = "Unable to access camera. Please check your permissions.";
      
      if (error.name === 'NotAllowedError') {
        if (isCapacitorNative()) {
          errorMessage = "Camera access denied. Please go to Settings > Fusion and enable Camera & Microphone permissions.";
        } else {
          errorMessage = "Camera access denied. Please allow camera and microphone permissions in your browser settings.";
        }
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera found. Please connect a camera and try again.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Camera is in use by another app. Please close other apps using the camera.";
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "Camera constraints not supported. Trying with basic settings...";
        try {
          const basicStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          streamRef.current = basicStream;
          if (videoRef.current) {
            videoRef.current.srcObject = basicStream;
            await videoRef.current.play();
          }
          setCameraActive(true);
          return;
        } catch (basicError) {
          console.error("[VideoRecorder] Basic camera also failed:", basicError);
        }
      }
      
      setCameraError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const closeFullscreen = () => {
    stopCamera();
    setIsFullscreenOpen(false);
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    
    // Test supported MIME types - iOS Safari only supports mp4
    const supportedTypes = [
      'video/mp4',
      'video/mp4;codecs=avc1',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    
    console.log('[VideoRecorder] Testing supported MIME types...');
    supportedTypes.forEach(type => {
      console.log(`[VideoRecorder] ${type}: ${MediaRecorder.isTypeSupported(type)}`);
    });
    
    let mimeType = 'video/mp4'; // Default to mp4 for better iOS compatibility
    
    // Find the first supported type
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    
    console.log('[VideoRecorder] Selected MIME type:', mimeType);
    
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType,
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      console.log('[VideoRecorder] Recording complete, blob size:', blob.size);
      stopCamera();
      setIsFullscreenOpen(false);
      // Automatically upload the video without preview
      onVideoRecorded(blob);
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

  const nextPrompt = () => {
    setCurrentPromptIndex((prev) => (prev + 1) % VIDEO_PROMPTS.length);
  };

  const handleSkip = () => {
    closeFullscreen();
    onCancel?.();
  };

  const handleCloseDialog = () => {
    closeFullscreen();
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Record Your Intro Video</h3>
          <Badge variant="outline" className="text-xs">20 sec max</Badge>
        </div>

        {showPrompts && (
          <div className="bg-muted/50 rounded-lg p-3 border">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium">Idea for your video:</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  "{VIDEO_PROMPTS[currentPromptIndex]}"
                </p>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  onClick={nextPrompt}
                  className="mt-1 h-6 px-2 text-xs"
                  data-testid="button-next-prompt"
                >
                  Show another idea
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-3 py-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Video className="h-7 w-7 text-primary" />
          </div>
          
          {!isMediaRecorderSupported ? (
            <div className="text-center space-y-2">
              <p className="text-muted-foreground text-xs max-w-xs">
                Video recording is not supported on your device. You can skip this step and add a video later from your profile settings.
              </p>
              {onCancel && (
                <Button type="button" onClick={onCancel} data-testid="button-skip-video">
                  Continue Without Video
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="text-center text-muted-foreground text-xs max-w-xs">
                Record a short video introduction so potential matches can get to know you better
              </p>
              <Button type="button" onClick={startCamera} data-testid="button-start-camera">
                <Video className="h-4 w-4 mr-2" />
                Start Camera
              </Button>
              {onCancel && (
                <Button type="button" variant="ghost" size="sm" onClick={onCancel} data-testid="button-skip-video">
                  Skip for now
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={isFullscreenOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-md w-full p-0 gap-0 h-[90vh] max-h-[700px] flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Record Video</h3>
              <Badge variant="outline">20 sec max</Badge>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={handleCloseDialog}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 bg-black relative overflow-hidden">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <p className="text-destructive text-sm max-w-xs mb-4">
                  {cameraError}
                </p>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={startCamera} data-testid="button-retry-camera">
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ 
                    transform: 'scaleX(-1)',
                    WebkitTransform: 'scaleX(-1)'
                  }}
                />
                
                {isRecording && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 z-10">
                    <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white font-bold text-xl bg-black/50 px-3 py-1 rounded-full">
                      {countdown}s
                    </span>
                  </div>
                )}
                
                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-4 border-t">
            <div className="flex flex-col gap-3 items-center">
              <div className="flex gap-3 justify-center">
                {!isRecording ? (
                  <>
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={handleSkip}
                      data-testid="button-cancel-camera"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button"
                      onClick={startRecording}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={!cameraActive || !!cameraError}
                      data-testid="button-start-recording"
                    >
                      <div className="h-3 w-3 rounded-full bg-white mr-2" />
                      Start Recording
                    </Button>
                  </>
                ) : (
                  <Button 
                    type="button"
                    onClick={stopRecording}
                    variant="destructive"
                    data-testid="button-stop-recording"
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Stop Recording
                  </Button>
                )}
              </div>
              {!isRecording && (
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={handleSkip}
                  data-testid="button-skip-video-active"
                >
                  Skip for now
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
