import { useState, useEffect, useRef } from "react";
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

// Track handled call IDs to prevent showing the same call multiple times
const handledCallIds = new Set<string>();
const MAX_HANDLED_CALLS = 50;

// Helper to add a call ID and clean up old ones
function markCallHandled(callId: string) {
  handledCallIds.add(callId);
  // Keep only the last MAX_HANDLED_CALLS to prevent memory growth
  if (handledCallIds.size > MAX_HANDLED_CALLS) {
    const iterator = handledCallIds.values();
    const firstValue = iterator.next().value;
    if (firstValue) {
      handledCallIds.delete(firstValue);
    }
  }
}

export function IncomingCallBanner({ callData, onDismiss }: IncomingCallBannerProps) {
  const [location, setLocation] = useLocation();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const hasTriggeredHaptic = useRef(false);

  // Trigger haptic only once per call
  useEffect(() => {
    if (callData && !hasTriggeredHaptic.current && Capacitor.isNativePlatform()) {
      hasTriggeredHaptic.current = true;
      try {
        Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {}
    }
    
    // Reset haptic flag when call data changes
    if (!callData) {
      hasTriggeredHaptic.current = false;
    }
  }, [callData?.callId]);

  // Don't show banner if:
  // 1. No call data
  // 2. Already on the call page
  // 3. This call was already handled (accepted/declined/dismissed)
  if (!callData) return null;
  if (location.startsWith('/call/')) return null;
  if (handledCallIds.has(callData.callId)) {
    // Auto-dismiss if this call was already handled
    onDismiss();
    return null;
  }

  const handleAccept = async () => {
    // Mark as handled immediately to prevent duplicate banners
    markCallHandled(callData.callId);
    setIsAccepting(true);
    
    if (Capacitor.isNativePlatform()) {
      try {
        Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {}
    }
    
    const path = `/call/${callData.callId}?callerName=${encodeURIComponent(callData.callerName)}&callType=${callData.callType}`;
    onDismiss();
    setLocation(path);
  };

  const handleDecline = async () => {
    // Mark as handled immediately to prevent duplicate banners
    markCallHandled(callData.callId);
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
  
  const handleDismiss = () => {
    // Mark as handled so it doesn't show again
    markCallHandled(callData.callId);
    onDismiss();
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
            onClick={handleDismiss}
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
