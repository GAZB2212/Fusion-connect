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
import { Card } from "@/components/ui/card";
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
  const { isLoading: isLoadingMic, localMicrophoneTrack } = useLocalMicrophoneTrack(true); // Start with mic enabled
  const { isLoading: isLoadingCam, localCameraTrack } = useLocalCameraTrack(true); // Start with camera enabled
  const remoteUsers = useRemoteUsers();
  const { audioTracks } = useRemoteAudioTracks(remoteUsers);
  const isConnected = useIsConnected();
  const { toast } = useToast();

  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

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
  }, true); // Enable automatic subscription

  // Play remote audio tracks automatically
  useEffect(() => {
    if (audioTracks.length > 0) {
      console.log('Playing remote audio tracks:', audioTracks.length);
      audioTracks.forEach((track) => {
        try {
          track.play();
        } catch (err) {
          console.error('Failed to play audio track:', err);
        }
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
      toast({
        title: "User joined",
        description: "Your match has joined the call",
      });
    }
  }, [remoteUsers.length, toast]);

  const toggleMic = async () => {
    // Don't show error if still loading
    if (isLoadingMic) {
      console.log('Microphone is still loading, please wait');
      return;
    }
    
    if (!localMicrophoneTrack) {
      console.error('No microphone track available');
      toast({
        title: "Error",
        description: "Microphone not available. Please check browser permissions.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const newState = !micEnabled;
      console.log('Toggling mic:', { from: micEnabled, to: newState });
      await localMicrophoneTrack.setEnabled(newState);
      setMicEnabled(newState);
      console.log('Mic toggled successfully to:', newState);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
      toast({
        title: "Error",
        description: "Failed to toggle microphone",
        variant: "destructive",
      });
    }
  };

  const toggleVideo = async () => {
    // Don't show error if still loading
    if (isLoadingCam) {
      console.log('Camera is still loading, please wait');
      return;
    }
    
    if (!localCameraTrack) {
      console.error('No camera track available');
      toast({
        title: "Error",
        description: "Camera not available. Please check browser permissions.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const newState = !videoEnabled;
      console.log('Toggling video:', { from: videoEnabled, to: newState });
      await localCameraTrack.setEnabled(newState);
      setVideoEnabled(newState);
      console.log('Video toggled successfully to:', newState);
    } catch (error) {
      console.error('Failed to toggle camera:', error);
      toast({
        title: "Error",
        description: "Failed to toggle camera",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoadingMic || isLoadingCam) {
    return (
      <div className="flex items-center justify-center h-full bg-[hsl(220,30%,12%)]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-[hsl(38,92%,50%)] animate-spin" data-testid="loading-call" />
          <p className="text-white text-lg">Setting up your camera and microphone...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[hsl(220,30%,12%)] flex flex-col">
      {/* Header with call duration */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
          <p className="text-white font-medium" data-testid="text-call-duration">
            {isConnected ? formatDuration(callDuration) : "Connecting..."}
          </p>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Local Video */}
        <Card className="relative overflow-hidden bg-black border-[hsl(38,92%,50%)]">
          <div className="aspect-video w-full h-full">
            {localCameraTrack && videoEnabled ? (
              <LocalVideoTrack 
                track={localCameraTrack} 
                play={true}
                className="w-full h-full object-cover"
                data-testid="video-local"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-[hsl(220,30%,8%)]">
                <VideoOff className="w-16 h-16 text-gray-400" />
              </div>
            )}
          </div>
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
            <p className="text-white text-sm" data-testid="text-you-label">You</p>
          </div>
        </Card>

        {/* Remote Video */}
        {remoteUsers.length > 0 ? (
          remoteUsers.map((user) => (
            <Card key={user.uid} className="relative overflow-hidden bg-black border-[hsl(38,92%,50%)]">
              <div className="aspect-video w-full h-full">
                <RemoteUser 
                  user={user}
                  playAudio={true}
                  playVideo={true}
                  className="w-full h-full object-cover"
                  data-testid="video-remote"
                />
              </div>
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                <p className="text-white text-sm" data-testid="text-match-label">Your Match</p>
              </div>
            </Card>
          ))
        ) : (
          <Card className="relative overflow-hidden bg-black border-gray-600">
            <div className="aspect-video w-full h-full flex flex-col items-center justify-center bg-[hsl(220,30%,8%)]">
              <Phone className="w-16 h-16 text-gray-400 mb-4 animate-pulse" />
              <p className="text-gray-300 text-lg" data-testid="text-waiting">
                {isInitiator ? "Waiting for your match to join..." : "Connecting..."}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 flex justify-center items-center gap-4 bg-black/40 backdrop-blur-sm">
        <Button
          size="icon"
          variant={micEnabled ? "default" : "destructive"}
          onClick={toggleMic}
          disabled={!localMicrophoneTrack}
          className={cn(
            "h-14 w-14 rounded-full",
            micEnabled 
              ? "bg-white/20 hover:bg-white/30 text-white" 
              : "bg-red-500 hover:bg-red-600"
          )}
          data-testid="button-toggle-mic"
        >
          {micEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>

        <Button
          size="icon"
          variant={videoEnabled ? "default" : "destructive"}
          onClick={toggleVideo}
          disabled={!localCameraTrack}
          className={cn(
            "h-14 w-14 rounded-full",
            videoEnabled 
              ? "bg-white/20 hover:bg-white/30 text-white" 
              : "bg-red-500 hover:bg-red-600"
          )}
          data-testid="button-toggle-video"
        >
          {videoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </Button>

        <Button
          size="icon"
          variant="destructive"
          onClick={onEndCall}
          className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600"
          data-testid="button-end-call"
        >
          <PhoneOff className="h-6 w-6" />
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
