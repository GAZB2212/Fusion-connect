import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

export interface IncomingCallData {
  callId: string;
  callerName: string;
  callerId: string;
  callType: "video" | "audio";
  channel: string;
}

interface IncomingCallBannerProps {
  callData: IncomingCallData | null;
  onDismiss: () => void;
}

export function IncomingCallBanner({ callData, onDismiss }: IncomingCallBannerProps) {
  const [, setLocation] = useLocation();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  useEffect(() => {
    if (callData && Capacitor.isNativePlatform()) {
      try {
        Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {}
    }
  }, [callData]);

  if (!callData) return null;

  const handleAccept = async () => {
    setIsAccepting(true);
    if (Capacitor.isNativePlatform()) {
      try {
        Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {}
    }
    
    const path = `/call/${callData.callId}?callerName=${encodeURIComponent(callData.callerName)}&callType=${callData.callType}`;
    setLocation(path);
    onDismiss();
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    if (Capacitor.isNativePlatform()) {
      try {
        Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {}
    }
    
    try {
      await apiRequest("POST", "/api/call/decline", { callId: callData.callId });
    } catch (error) {
      console.error("[IncomingCallBanner] Failed to decline call:", error);
    }
    
    onDismiss();
    setIsDeclining(false);
  };

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-[60] p-4 safe-area-top",
        "animate-in slide-in-from-top duration-300"
      )}
      data-testid="incoming-call-banner"
    >
      <div className="bg-gradient-to-r from-[hsl(220,30%,15%)] to-[hsl(220,30%,20%)] rounded-2xl shadow-2xl border border-primary/20 overflow-hidden">
        <div className="flex items-center gap-4 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
              {callData.callType === "video" ? (
                <>
                  <Video className="w-4 h-4" />
                  <span>Incoming video call</span>
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  <span>Incoming voice call</span>
                </>
              )}
            </div>
            <p className="text-white font-semibold text-lg truncate" data-testid="text-caller-name-banner">
              {callData.callerName}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              onClick={handleDecline}
              disabled={isDeclining || isAccepting}
              className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg"
              data-testid="button-decline-banner"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
            
            <Button
              size="icon"
              onClick={handleAccept}
              disabled={isDeclining || isAccepting}
              className="h-12 w-12 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg"
              data-testid="button-accept-banner"
            >
              <Phone className="h-5 w-5" />
            </Button>
          </div>
          
          <Button
            size="icon"
            variant="ghost"
            onClick={onDismiss}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
            data-testid="button-dismiss-banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default IncomingCallBanner;
