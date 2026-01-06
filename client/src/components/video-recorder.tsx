import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Video, Loader2, Lightbulb, X, Play, RotateCcw, Upload, RefreshCw } from "lucide-react";
import { isCapacitorNative, isIOS } from "@/lib/platform";
import { requestCameraAndMicrophonePermissions } from "@/lib/permissions";
import { motion, AnimatePresence } from "framer-motion";

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
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

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
        video: isCapacitorNative() ? {
          facingMode: facingMode,
        } : {
          facingMode: facingMode,
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

  const flipCamera = async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    
    if (cameraActive && !isRecording) {
      stopCamera();
      setTimeout(() => {
        startCamera();
      }, 100);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    
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
    
    let mimeType = 'video/mp4';
    
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
      setRecordedVideo(blob);
      setRecordedVideoUrl(URL.createObjectURL(blob));
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

  const handleSkip = () => {
    closeFullscreen();
    onCancel?.();
  };

  const handleCloseDialog = () => {
    closeFullscreen();
  };

  const progressPercentage = ((20 - countdown) / 20) * 100;

  if (recordedVideoUrl) {
    return (
      <Dialog open={isFullscreenOpen} onOpenChange={(open) => !open && !isUploading && handleCloseDialog()}>
        <DialogContent className="max-w-full w-full h-full max-h-full p-0 gap-0 flex flex-col border-0 rounded-none bg-black">
          {isUploading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-[#f59e0b]/20 flex items-center justify-center">
                  <Video className="h-12 w-12 text-[#f59e0b]" />
                </div>
                <div className="absolute inset-0 h-24 w-24 rounded-full border-4 border-[#f59e0b]/30 border-t-[#f59e0b] animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-white">Uploading Your Video</h3>
                <p className="text-sm text-white/70">
                  Please wait while we save your intro video...
                </p>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col">
              <div className="absolute top-0 w-full z-20 pt-12 pb-4 px-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
                <button 
                  onClick={handleCloseDialog}
                  className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/50 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="px-3 py-1.5 bg-black/30 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#f59e0b] rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-white">Preview</span>
                </div>
                <div className="w-10" />
              </div>

              <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
                <video
                  ref={previewRef}
                  src={recordedVideoUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
              </div>

              <div className="absolute bottom-0 w-full z-20 pb-10 pt-6 px-6 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex gap-4 justify-center">
                  <button 
                    onClick={retakeVideo}
                    className="flex flex-col items-center gap-2 group"
                    data-testid="button-retake-video"
                  >
                    <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:bg-white/20 transition-colors">
                      <RotateCcw className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-medium text-white/80">Retake</span>
                  </button>

                  <button 
                    onClick={handleUpload}
                    className="flex flex-col items-center gap-2 group"
                    data-testid="button-upload-video"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#f59e0b] flex items-center justify-center text-[#0a1628] group-hover:bg-[#fbbf24] transition-colors">
                      <Upload className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-medium text-white/80">Use Video</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

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
        <DialogContent className="max-w-full w-full h-full max-h-full p-0 gap-0 flex flex-col border-0 rounded-none bg-black">
          <div className="relative w-full h-full flex flex-col">
            
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full"
              style={{ 
                objectFit: isCapacitorNative() ? 'contain' : 'cover',
                backgroundColor: 'black',
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                WebkitTransform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
              }}
            />
            
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />

            <div className="absolute top-0 left-0 w-full h-1.5 bg-white/20 z-30">
              <motion.div 
                className="h-full bg-[#f59e0b]"
                initial={{ width: 0 }}
                animate={{ width: isRecording ? `${progressPercentage}%` : 0 }}
                transition={{ duration: 0.5, ease: "linear" }}
              />
            </div>

            <AnimatePresence>
              {!isRecording && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative z-10 pt-14 px-6 flex justify-between items-start"
                >
                  <button 
                    onClick={handleCloseDialog}
                    className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/50 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  
                  <button 
                    onClick={flipCamera} 
                    className="flex flex-col items-center gap-1 group"
                    data-testid="button-flip-camera"
                  >
                    <div className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center text-white group-hover:bg-black/50 transition-colors">
                      <RefreshCw className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-medium text-white drop-shadow-lg">Flip</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 flex flex-col items-center justify-center relative z-10">
              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="text-white font-bold text-5xl drop-shadow-lg"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    00:{countdown < 10 ? `0${countdown}` : countdown}
                  </motion.div>
                )}
              </AnimatePresence>

              {!cameraActive && !cameraError && (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 text-white animate-spin" />
                  <p className="text-white/70 text-sm">Starting camera...</p>
                </div>
              )}

              {cameraError && (
                <div className="flex flex-col items-center gap-4 p-6 text-center">
                  <p className="text-red-400 text-sm max-w-xs">
                    {cameraError}
                  </p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={startCamera} 
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    data-testid="button-retry-camera"
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>

            <div className="relative z-10 pb-12 px-6 w-full flex flex-col items-center">
              
              <AnimatePresence>
                {!isRecording && cameraActive && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mb-8 text-center"
                  >
                    <h3 className="text-white font-bold text-xl mb-1 drop-shadow-lg" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      Video Intro
                    </h3>
                    <p className="text-white/80 text-sm drop-shadow-md">
                      You have 20 seconds to introduce yourself
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between w-full px-6">
                <button 
                  onClick={handleSkip}
                  className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/50 transition-colors"
                >
                  <span className="text-xs font-medium">Skip</span>
                </button>

                <button 
                  className="relative cursor-pointer flex items-center justify-center"
                  onClick={isRecording ? stopRecording : startRecording}
                  data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
                >
                  <motion.div 
                    animate={isRecording ? { scale: 1.1, borderColor: '#f59e0b' } : { scale: 1, borderColor: 'white' }}
                    className="w-20 h-20 rounded-full border-[5px] border-white flex items-center justify-center"
                  >
                    <motion.div 
                      animate={isRecording ? { width: 28, height: 28, borderRadius: 6 } : { width: 56, height: 56, borderRadius: 999 }}
                      className="bg-[#f59e0b]"
                      style={{ 
                        boxShadow: isRecording ? '0 0 20px rgba(245, 158, 11, 0.5)' : 'none'
                      }}
                    />
                  </motion.div>
                </button>

                <div className="w-12 h-12" />
              </div>
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
