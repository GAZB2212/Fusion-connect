import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Send, ArrowLeft, Shield, CheckCircle2, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { MessageWithSender, MatchWithProfiles, Chaperone, VideoCall } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import VideoCallComponent from "@/components/VideoCall";

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, params] = useRoute("/messages/:matchId");
  const [, setLocation] = useLocation();
  const matchId = params?.matchId;

  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [activeCall, setActiveCall] = useState<VideoCall | null>(null);
  const [callToken, setCallToken] = useState<string>("");
  const [joinedCallId, setJoinedCallId] = useState<string | null>(null);

  // Fetch match details
  const { data: match } = useQuery<MatchWithProfiles>({
    queryKey: ["/api/match", matchId],
    enabled: !!matchId,
  });

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<MessageWithSender[]>({
    queryKey: ["/api/messages", matchId],
    enabled: !!matchId,
    refetchInterval: 3000, // Poll every 3 seconds for new messages
  });

  // Fetch chaperones
  const { data: chaperones = [] } = useQuery<Chaperone[]>({
    queryKey: ["/api/chaperones"],
  });

  // Poll for incoming calls
  const { data: incomingCall } = useQuery<VideoCall | null>({
    queryKey: ["/api/video-call/incoming", matchId],
    queryFn: async () => {
      if (!matchId) return null;
      try {
        const res = await fetch(`/api/video-call/incoming/${matchId}`, {
          credentials: "include",
        });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !!matchId && !isCallActive,
    refetchInterval: 2000, // Poll every 2 seconds for incoming calls
  });

  // Auto-answer incoming call
  useEffect(() => {
    const handleIncomingCall = async () => {
      console.log('Checking for incoming call:', { 
        incomingCall, 
        isCallActive, 
        userId: user?.id,
        receiverId: incomingCall?.receiverId,
        status: incomingCall?.status,
        joinedCallId
      });
      
      if (!incomingCall || isCallActive || !user) {
        console.log('Early return:', { hasCall: !!incomingCall, isCallActive, hasUser: !!user });
        return;
      }

      // Don't rejoin a call we've already joined
      if (joinedCallId === incomingCall.id) {
        console.log('Already joined this call:', incomingCall.id);
        return;
      }
      
      // Check if this user is the receiver
      if (incomingCall.receiverId !== user.id) {
        console.log('User is not receiver:', { receiverId: incomingCall.receiverId, userId: user.id });
        return;
      }
      
      // Only auto-join if call is in "initiated" status
      // Note: The caller might have already set it to "active" before we polled, so check both
      if (incomingCall.status !== 'initiated' && incomingCall.status !== 'active') {
        console.log('Call not in correct status:', incomingCall.status);
        return;
      }
      
      // Check if the call was created very recently (within last 30 seconds)
      // This prevents auto-joining old "stuck" active calls
      const callAge = Date.now() - new Date(incomingCall.createdAt).getTime();
      if (callAge > 30000) {
        console.log('Call too old:', callAge);
        return;
      }

      console.log('Auto-joining incoming call:', incomingCall.id);

      try {
        // Mark that we're joining this call
        setJoinedCallId(incomingCall.id);
        
        // Get token for the call
        const tokenRes = await apiRequest("GET", `/api/video-call/token/${incomingCall.id}`);
        const tokenData = await tokenRes.json() as { token: string; channelName: string };
        
        setActiveCall(incomingCall);
        setCallToken(tokenData.token);
        setIsCallActive(true);
        
        // Update call status to active
        await apiRequest("PATCH", `/api/video-call/${incomingCall.id}/status`, {
          status: "active",
        });
        
        toast({
          title: "Incoming call",
          description: "Connecting...",
        });
      } catch (error: any) {
        console.error('Error joining call:', error);
        setJoinedCallId(null); // Reset on error so we can retry
        toast({
          title: "Failed to join call",
          description: error.message,
          variant: "destructive",
        });
      }
    };

    handleIncomingCall();
  }, [incomingCall, isCallActive, user, joinedCallId, toast]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!match) return;
      const receiverId = match.user1Id === user?.id ? match.user2Id : match.user1Id;
      return apiRequest("POST", "/api/messages", {
        matchId: matchId!,
        receiverId,
        content,
      });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start video call mutation
  const startCallMutation = useMutation({
    mutationFn: async () => {
      if (!match) return;
      const receiverId = match.user1Id === user?.id ? match.user2Id : match.user1Id;
      const res = await apiRequest("POST", "/api/video-call/initiate", {
        matchId: matchId!,
        receiverId,
      });
      return res.json() as Promise<VideoCall>;
    },
    onSuccess: async (call) => {
      if (!call) return;
      
      // Get token for the call
      const tokenRes = await apiRequest(
        "GET",
        `/api/video-call/token/${call.id}`
      );
      const tokenData = await tokenRes.json() as { token: string; channelName: string };
      
      setActiveCall(call);
      setCallToken(tokenData.token);
      setIsCallActive(true);
      
      // Don't set to "active" yet - let the receiver set it when they join
      // This keeps the status as "initiated" so the receiver can detect it
    },
    onError: (error) => {
      toast({
        title: "Failed to start call",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEndCall = async () => {
    if (!activeCall) return;
    
    try {
      await apiRequest("PATCH", `/api/video-call/${activeCall.id}/status`, {
        status: "ended",
      });
      
      setIsCallActive(false);
      setActiveCall(null);
      setCallToken("");
      setJoinedCallId(null); // Reset so new calls can be joined
      
      toast({
        title: "Call ended",
        description: "The video call has been ended",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStartCall = () => {
    startCallMutation.mutate();
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(messageText);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!matchId) {
    return null;
  }

  if (isLoading || !match) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-3xl mx-auto p-4">
          <Skeleton className="h-16 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Determine which profile is the other user
  const otherProfile = match.user1Id === user?.id ? match.user2Profile : match.user1Profile;
  const displayName = otherProfile.useNickname
    ? otherProfile.displayName.split(' ')[0]
    : otherProfile.displayName;

  const hasActiveChaperone = chaperones.some(c => c.isActive);

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-4 h-16">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/matches")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <Avatar className="h-10 w-10">
              <AvatarImage src={otherProfile.photos?.[0]} />
              <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{displayName}, {otherProfile.age}</h2>
                {otherProfile.isVerified && (
                  <CheckCircle2 className="h-4 w-4 text-primary fill-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{otherProfile.location}</p>
            </div>

            {hasActiveChaperone && (
              <Badge variant="secondary" className="gap-1.5">
                <Shield className="h-3 w-3" />
                Chaperone Active
              </Badge>
            )}
            
            <Button
              variant="default"
              size="sm"
              onClick={handleStartCall}
              disabled={startCallMutation.isPending}
              className="gap-2"
              data-testid="button-start-video-call"
            >
              <Video className="h-4 w-4" />
              Video Call
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-3xl mx-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Start the Conversation</h3>
              <p className="text-sm text-muted-foreground">
                Send your first message to {displayName}
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isMe = message.senderId === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${message.id}`}
                >
                  <div className={`max-w-[70%] ${isMe ? 'order-2' : 'order-1'}`}>
                    <Card
                      className={`p-3 ${
                        isMe
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm leading-relaxed break-words">{message.content}</p>
                    </Card>
                    <p className={`text-xs text-muted-foreground mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                      {message.createdAt && formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chaperone Notice */}
      {hasActiveChaperone && (
        <div className="border-t bg-muted/50">
          <div className="container max-w-3xl mx-auto px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <span>
                Your chaperone {chaperones.find(c => c.isActive)?.chaperoneName} has access to this conversation
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-background pb-20">
        <div className="container max-w-3xl mx-auto p-4">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              disabled={sendMessageMutation.isPending}
              data-testid="input-message"
            />
            <Button
              type="submit"
              disabled={!messageText.trim() || sendMessageMutation.isPending}
              data-testid="button-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Video Call Dialog */}
      <Dialog open={isCallActive} onOpenChange={setIsCallActive}>
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          {activeCall && callToken && (
            <VideoCallComponent
              callId={activeCall.id}
              channelName={activeCall.channelName}
              token={callToken}
              onEndCall={handleEndCall}
              isInitiator={activeCall.callerId === user?.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
