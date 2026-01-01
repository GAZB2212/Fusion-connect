import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Loader2, Video as VideoIcon, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import VideoCall from "@/components/VideoCall";
import fusionLogo from "@assets/NEW logo 2_1761675667388.png";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

interface CallAcceptResponse {
  channel: string;
  rtcToken: string;
  uid: number;
  callType: "video" | "audio";
  callerId: string;
  appId: string;
}

interface CallerProfile {
  displayName: string;
  photoUrl?: string;
}

export default function IncomingCall() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/call/:callId");
  const callId = params?.callId;
  const { toast } = useToast();

  const [callData, setCallData] = useState<CallAcceptResponse | null>(null);
  const [callState, setCallState] = useState<"ringing" | "accepting" | "connected" | "ended">("ringing");
  const [callerName, setCallerName] = useState<string>("Someone");
  const [callerPhoto, setCallerPhoto] = useState<string | undefined>(undefined);
  const [callType, setCallType] = useState<"video" | "audio">("video");

  // Parse query params for caller info
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get("callerName");
    const type = urlParams.get("callType") as "video" | "audio";
    
    if (name) setCallerName(decodeURIComponent(name));
    if (type) setCallType(type);

    // Trigger haptic feedback on iOS/Android
    if (Capacitor.isNativePlatform()) {
      try {
        Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {
        console.log("[IncomingCall] Haptics not available");
      }
    }
  }, []);

  // Accept call mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/call/accept", { callId });
      return response.json() as Promise<CallAcceptResponse>;
    },
    onSuccess: (data) => {
      setCallData(data);
      setCallState("connected");
      toast({
        title: "Call connected",
        description: "You are now in a call",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept call",
        description: error.message || "Call may have ended",
        variant: "destructive",
      });
      setCallState("ended");
      setTimeout(() => setLocation("/"), 2000);
    },
  });

  // Decline call mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/call/decline", { callId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Call declined",
      });
      setCallState("ended");
      setLocation("/");
    },
    onError: (error: any) => {
      console.error("[IncomingCall] Decline error:", error);
      setLocation("/");
    },
  });

  const handleAccept = () => {
    if (Capacitor.isNativePlatform()) {
      try {
        Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {}
    }
    setCallState("accepting");
    acceptMutation.mutate();
  };

  const handleDecline = () => {
    if (Capacitor.isNativePlatform()) {
      try {
        Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {}
    }
    declineMutation.mutate();
  };

  const handleEndCall = (duration: number) => {
    console.log(`[IncomingCall] Call ended, duration: ${duration}s`);
    apiRequest("POST", "/api/call/end", { callId }).catch(console.error);
    setCallState("ended");
    setLocation("/");
  };

  // If we're connected and have call data, render the video call
  if (callState === "connected" && callData) {
    return (
      <VideoCall
        callId={callId!}
        channelName={callData.channel}
        token={callData.rtcToken}
        onEndCall={handleEndCall}
        isInitiator={false}
      />
    );
  }

  // Render incoming call UI
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[hsl(220,30%,15%)] to-[hsl(220,30%,8%)]">
      {/* Top Logo */}
      <div className="absolute top-8 left-0 right-0 flex justify-center">
        <img 
          src={fusionLogo} 
          alt="Fusion" 
          className="h-12 opacity-80"
          data-testid="img-fusion-logo"
        />
      </div>

      {/* Caller Info */}
      <div className="flex flex-col items-center gap-6 mb-12">
        {/* Caller Avatar */}
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center border-4 border-primary/30 animate-pulse">
            {callerPhoto ? (
              <img 
                src={callerPhoto} 
                alt={callerName} 
                className="w-full h-full rounded-full object-cover"
                data-testid="img-caller-avatar"
              />
            ) : (
              <User className="w-16 h-16 text-primary/60" />
            )}
          </div>
          {/* Ringing indicator */}
          <div className="absolute -inset-4 rounded-full border-2 border-primary/30 animate-ping" />
          <div className="absolute -inset-8 rounded-full border border-primary/20 animate-ping" style={{ animationDelay: "0.5s" }} />
        </div>

        {/* Caller Name */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-caller-name">
            {callerName}
          </h1>
          <p className="text-white/60 flex items-center gap-2 justify-center" data-testid="text-call-type">
            {callType === "video" ? (
              <>
                <VideoIcon className="w-4 h-4" />
                Incoming video call
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                Incoming voice call
              </>
            )}
          </p>
        </div>
      </div>

      {/* Call Actions */}
      <div className="flex items-center gap-12">
        {/* Decline Button */}
        <div className="flex flex-col items-center gap-2">
          <Button
            size="icon"
            onClick={handleDecline}
            disabled={declineMutation.isPending || callState !== "ringing"}
            className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-2xl"
            data-testid="button-decline-call"
          >
            {declineMutation.isPending ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <PhoneOff className="h-7 w-7" />
            )}
          </Button>
          <span className="text-white/60 text-sm">Decline</span>
        </div>

        {/* Accept Button */}
        <div className="flex flex-col items-center gap-2">
          <Button
            size="icon"
            onClick={handleAccept}
            disabled={acceptMutation.isPending || callState !== "ringing"}
            className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-2xl"
            data-testid="button-accept-call"
          >
            {acceptMutation.isPending || callState === "accepting" ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Phone className="h-7 w-7" />
            )}
          </Button>
          <span className="text-white/60 text-sm">Accept</span>
        </div>
      </div>

      {/* Connecting overlay */}
      {callState === "accepting" && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-white animate-spin" />
            <p className="text-white text-lg">Connecting...</p>
          </div>
        </div>
      )}
    </div>
  );
}
