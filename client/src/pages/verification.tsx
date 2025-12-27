import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, CheckCircle2, X, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

export default function Verification() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Get profile to access uploaded photos
  const { data: profile } = useQuery<Profile>({
    queryKey: ["/api/profile"],
  });

  useEffect(() => {
    // Cleanup camera stream on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    // Ensure video element has the stream when camera becomes active
    if (cameraActive && streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((e) => console.error("Play error:", e));
    }
  }, [cameraActive]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Explicitly play the video
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.error("Video play error:", playError);
        }
      }
      
      setCameraActive(true);
    } catch (error) {
      console.error("Camera error:", error);
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to complete verification.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageData);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setVerificationStatus('idle');
    setIsVerifying(false);
    startCamera();
  };

  const verifyIdentity = async () => {
    if (!capturedImage || !profile?.photos?.[0]) {
      toast({
        title: "Error",
        description: "Missing photos for verification.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setVerificationStatus('verifying');

    try {
      const response = await apiRequest("POST", "/api/compare-faces", {
        uploadedPhoto: profile.photos[0],
        liveSelfie: capturedImage,
      });
      
      const result = await response.json() as { isMatch: boolean; message: string; details?: string };

      if (result.isMatch) {
        setVerificationStatus('success');
        
        // Invalidate profile cache so it shows as verified
        await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
        
        // Wait a moment to show success animation, then redirect
        setTimeout(() => {
          setLocation("/");
        }, 2000);
      } else {
        setVerificationStatus('failed');
        setIsVerifying(false);
      }
    } catch (error: any) {
      toast({
        title: "Verification Error",
        description: error.message || "Unable to verify your identity. Please try again.",
        variant: "destructive",
      });
      setVerificationStatus('idle');
      setIsVerifying(false);
    }
  };

  const restartProfileSetup = () => {
    // Reset verification state and redirect back to profile setup to re-upload photos
    setVerificationStatus('idle');
    setIsVerifying(false);
    setCapturedImage(null);
    setLocation("/?restart=true");
  };

  const devBypass = async () => {
    try {
      setIsVerifying(true);
      await apiRequest("POST", "/api/dev-verify", {});
      
      // Invalidate profile cache
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      
      toast({
        title: "Verification Bypassed",
        description: "You're now verified (development mode)",
      });
      
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Bypass Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsVerifying(false);
    }
  };

  // Verifying screen
  if (verificationStatus === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Verifying Your Identity</h2>
              <p className="text-muted-foreground">
                Please wait while we compare your photos...
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Success screen
  if (verificationStatus === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-md w-full p-8">
            <div className="text-center space-y-6">
              <motion.div 
                className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Verification Successful!</h2>
                <p className="text-muted-foreground">
                  Your identity has been confirmed. Redirecting to your profile...
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Failed screen
  if (verificationStatus === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="h-10 w-10 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Verification Failed</h2>
              <p className="text-muted-foreground mb-4">
                The photos don't appear to match. Please upload real photos of yourself.
              </p>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={restartProfileSetup} 
                className="w-full"
                data-testid="button-restart-profile"
              >
                Upload New Photos
              </Button>
              <Button 
                onClick={retakePhoto} 
                variant="outline" 
                className="w-full"
                data-testid="button-retake"
              >
                Retake Selfie
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pt-14">
      <Card className="max-w-2xl w-full p-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Verification Required</h1>
            <p className="text-muted-foreground">
              Take a live selfie to verify your identity
            </p>
          </div>

          {/* Camera View or Captured Photo */}
          <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
            {!cameraActive && !capturedImage && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Camera className="h-16 w-16 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Camera not active</p>
                </div>
              </div>
            )}

            {cameraActive && !capturedImage && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                data-testid="video-camera"
              />
            )}

            {capturedImage && (
              <img
                src={capturedImage}
                alt="Captured selfie"
                className="w-full h-full object-cover"
                data-testid="img-captured"
              />
            )}
          </div>

          {/* Instructions */}
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Verification Instructions:</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Look directly at the camera</li>
              <li>• Ensure your face is well-lit and clearly visible</li>
              <li>• Remove sunglasses or face coverings</li>
              <li>• Match the pose from your profile photo</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="flex gap-3">
              {!cameraActive && !capturedImage && (
                <Button 
                  onClick={startCamera} 
                  className="flex-1"
                  data-testid="button-start-camera"
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Start Camera
                </Button>
              )}

              {cameraActive && !capturedImage && (
                <>
                  <Button 
                    onClick={stopCamera} 
                    variant="outline" 
                    className="flex-1"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={capturePhoto} 
                    className="flex-1"
                    data-testid="button-capture"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Capture Photo
                  </Button>
                </>
              )}

              {capturedImage && !isVerifying && (
                <>
                  <Button 
                    onClick={retakePhoto} 
                    variant="outline" 
                    className="flex-1"
                    data-testid="button-retake"
                  >
                    Retake
                  </Button>
                  <Button 
                    onClick={verifyIdentity} 
                    className="flex-1"
                    data-testid="button-verify"
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Verify Identity
                  </Button>
                </>
              )}
            </div>

            {/* Dev Mode Bypass */}
            <Button 
              onClick={devBypass} 
              variant="ghost" 
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              disabled={isVerifying}
              data-testid="button-dev-bypass"
            >
              Skip Verification (Testing Only)
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
