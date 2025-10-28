import { useState, useEffect, useMemo } from "react";
import AgoraRTC from "agora-rtc-react";
import {
  AgoraRTCProvider,
  useRTCClient,
  useLocalMicrophoneTrack,
  useLocalCameraTrack,
  useRemoteUsers,
  usePublish,
  useJoin,
  useRemoteAudioTracks,
  useIsConnected,
  LocalVideoTrack,
  RemoteUser,
} from "agora-rtc-react";
import { Button } from "@/components/ui/button";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Phone,
  Loader2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useVideoCall } from "@/contexts/VideoCallContext";

interface VideoCallProps {
  callId: string;
  channelName: string;
  token: string;
  onEndCall: () => void;
  isInitiator: boolean;
}

function VideoCallContent({ 
  channelName, 
  token, 
  onEndCall,
  isInitiator 
}: Omit<VideoCallProps, 'callId'>) {
  const client = useRTCClient(AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }));
  const { isLoading: isLoadingMic, localMicrophoneTrack } = useLocalMicrophoneTrack(true);
  const { isLoading: isLoadingCam, localCameraTrack } = useLocalCameraTrack(true);
  const remoteUsers = useRemoteUsers();
  const { audioTracks } = useRemoteAudioTracks(remoteUsers);
  const isConnected = useIsConnected();
  const { toast } = useToast();
  const { setIsCallActive } = useVideoCall();

  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // Notify context that call is active
  useEffect(() => {
    setIsCallActive(true);
    return () => {
      setIsCallActive(false);
    };
  }, [setIsCallActive]);

  // Auto-hide controls after 3 seconds of inactivity
  useEffect(() => {
    if (!showControls) return;
    
    const timeout = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [showControls]);

  // Log when tracks become available
  useEffect(() => {
    console.log('Track status:', {
      micLoading: isLoadingMic,
      micAvailable: !!localMicrophoneTrack,
      camLoading: isLoadingCam,
      camAvailable: !!localCameraTrack
    });
    
    if (localMicrophoneTrack) {
      console.log('Microphone track ready:', localMicrophoneTrack.enabled);
    }
    if (localCameraTrack) {
      console.log('Camera track ready:', localCameraTrack.enabled);
    }
  }, [isLoadingMic, isLoadingCam, localMicrophoneTrack, localCameraTrack]);

  usePublish([localMicrophoneTrack, localCameraTrack]);
  useJoin({
    appid: import.meta.env.VITE_AGORA_APP_ID!,
    channel: channelName,
    token: token || null,
  }, true);

  // Log remote audio status
  useEffect(() => {
    if (audioTracks.length > 0) {
      console.log('Remote audio tracks available:', audioTracks.length);
      audioTracks.forEach((track, index) => {
        console.log(`Audio track ${index}:`, {
          volume: track.getVolumeLevel(),
          isPlaying: track.isPlaying
        });
      });
    }
  }, [audioTracks]);

  // Track call duration
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Show toast when remote user joins
  useEffect(() => {
    if (remoteUsers.length > 0) {
      console.log('Remote users in call:', remoteUsers.length);
      remoteUsers.forEach((user, index) => {
        console.log(`Remote user ${index}:`, {
          uid: user.uid,
          hasAudio: user.hasAudio,
          hasVideo: user.hasVideo,
          audioTrack: user.audioTrack ? 'present' : 'missing',
          videoTrack: user.videoTrack ? 'present' : 'missing'
        });
      });
      
      toast({
        title: "Connected",
        description: "Your match has joined the call",
      });
    }
  }, [remoteUsers.length, toast]);

  const toggleMic = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoadingMic) return;
    
    if (!localMicrophoneTrack) {
      toast({
        title: "Error",
        description: "Microphone not available. Please check browser permissions.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const newState = !micEnabled;
      await localMicrophoneTrack.setEnabled(newState);
      setMicEnabled(newState);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
      toast({
        title: "Error",
        description: "Failed to toggle microphone",
        variant: "destructive",
      });
    }
  };

  const toggleVideo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoadingCam) return;
    
    if (!localCameraTrack) {
      toast({
        title: "Error",
        description: "Camera not available. Please check browser permissions.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const newState = !videoEnabled;
      await localCameraTrack.setEnabled(newState);
      setVideoEnabled(newState);
    } catch (error) {
      console.error('Failed to toggle camera:', error);
      toast({
        title: "Error",
        description: "Failed to toggle camera",
        variant: "destructive",
      });
    }
  };

  const handleEndCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEndCall();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoadingMic || isLoadingCam) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-white animate-spin" data-testid="loading-call" />
          <p className="text-white text-lg">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black"
      onClick={() => setShowControls(true)}
      data-testid="video-call-container"
    >
      {/* Remote Video - Full Screen */}
      <div className="absolute inset-0">
        {remoteUsers.length > 0 ? (
          remoteUsers.map((user) => (
            <div key={user.uid} className="w-full h-full">
              <RemoteUser 
                user={user}
                playAudio={true}
                playVideo={true}
                className="w-full h-full object-cover"
                data-testid="video-remote"
              />
            </div>
          ))
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[hsl(220,30%,12%)]">
            <Phone className="w-20 h-20 text-white/40 mb-6 animate-pulse" />
            <p className="text-white/80 text-xl" data-testid="text-waiting">
              {isInitiator ? "Calling..." : "Connecting..."}
            </p>
          </div>
        )}
      </div>

      {/* Call Duration - Top Center */}
      <div 
        className={cn(
          "absolute top-6 left-1/2 -translate-x-1/2 z-10 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full">
          <p className="text-white font-medium text-sm" data-testid="text-call-duration">
            {isConnected ? formatDuration(callDuration) : "Connecting..."}
          </p>
        </div>
      </div>

      {/* Local Video - Picture in Picture (Bottom Right) */}
      <div className="absolute bottom-32 right-4 z-20 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl">
        {localCameraTrack && videoEnabled ? (
          <LocalVideoTrack 
            track={localCameraTrack} 
            play={true}
            className="w-full h-full object-cover"
            data-testid="video-local"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-[hsl(220,30%,8%)]">
            <VideoOff className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>

      {/* Controls - Bottom Center */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 pb-8 pt-6 flex justify-center items-center gap-6 z-30 transition-opacity duration-300",
          "bg-gradient-to-t from-black/80 via-black/50 to-transparent",
          showControls ? "opacity-100" : "opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mic Toggle */}
        <Button
          size="icon"
          onClick={toggleMic}
          disabled={!localMicrophoneTrack}
          className={cn(
            "h-14 w-14 rounded-full shadow-xl transition-all",
            micEnabled 
              ? "bg-white/20 hover:bg-white/30 text-white backdrop-blur-md" 
              : "bg-red-500 hover:bg-red-600 text-white"
          )}
          data-testid="button-toggle-mic"
        >
          {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>

        {/* End Call - Red Circle */}
        <Button
          size="icon"
          onClick={handleEndCall}
          className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-2xl transition-all hover:scale-110"
          data-testid="button-end-call"
        >
          <PhoneOff className="h-7 w-7" />
        </Button>

        {/* Video Toggle */}
        <Button
          size="icon"
          onClick={toggleVideo}
          disabled={!localCameraTrack}
          className={cn(
            "h-14 w-14 rounded-full shadow-xl transition-all",
            videoEnabled 
              ? "bg-white/20 hover:bg-white/30 text-white backdrop-blur-md" 
              : "bg-red-500 hover:bg-red-600 text-white"
          )}
          data-testid="button-toggle-video"
        >
          {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}

export default function VideoCall(props: VideoCallProps) {
  const client = useMemo(() => AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }), []);
  
  return (
    <AgoraRTCProvider client={client}>
      <VideoCallContent {...props} />
    </AgoraRTCProvider>
  );
}
