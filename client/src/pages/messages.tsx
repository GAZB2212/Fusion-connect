import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Send, ArrowLeft, Shield, CheckCircle2, Video, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { MessageWithSender, MatchWithProfiles, Chaperone, VideoCall } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import VideoCallComponent from "@/components/VideoCall";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { useWebSocketEvent } from "@/contexts/WebSocketContext";

interface Conversation {
  matchId: string;
  otherUser: {
    displayName: string;
    age: number;
    photos: string[];
    location: string;
    isVerified: boolean;
    useNickname: boolean;
  };
  latestMessage: {
    content: string;
    createdAt: Date | null;
    senderId: string;
    messageType?: string;
  } | null;
  unreadCount: number;
  matchCreatedAt: Date | null;
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, params] = useRoute("/messages/:matchId");
  const [, setLocation] = useLocation();
  const matchId = params?.matchId;

  // Debug logging
  useEffect(() => {
    console.log('Messages page loaded:', { matchId, params });
  }, [matchId, params]);

  const [messageText, setMessageText] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isCallActive, setIsCallActive } = useVideoCall();
  const [activeCall, setActiveCall] = useState<VideoCall | null>(null);
  const [callToken, setCallToken] = useState<string>("");
  const [joinedCallId, setJoinedCallId] = useState<string | null>(null);

  // Fetch conversations list (for when no matchId is provided)
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    enabled: !matchId,
  });

  // Fetch match details
  const { data: match } = useQuery<MatchWithProfiles>({
    queryKey: ["/api/match", matchId],
    enabled: !!matchId,
  });

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<MessageWithSender[]>({
    queryKey: ["/api/messages", matchId],
    enabled: !!matchId,
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
  });

  // Poll for active call status (to detect if other party ended the call)
  const { data: activeCallStatus } = useQuery<VideoCall | null>({
    queryKey: ["/api/video-call/status", activeCall?.id],
    queryFn: async () => {
      if (!activeCall?.id) return null;
      try {
        const res = await fetch(`/api/video-call/${activeCall.id}`, {
          credentials: "include",
        });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !!activeCall && isCallActive,
  });

  // WebSocket: Listen for new messages
  useWebSocketEvent('new_message', (message: MessageWithSender) => {
    console.log('WebSocket: New message received', message);
    // Invalidate conversations list to update latest message
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    // If we're viewing the conversation, invalidate messages
    if (matchId && message.matchId === matchId) {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
    }
  });

  // WebSocket: Listen for incoming calls
  useWebSocketEvent('incoming_call', (call: VideoCall) => {
    console.log('WebSocket: Incoming call received', call);
    if (matchId && call.matchId === matchId) {
      queryClient.invalidateQueries({ queryKey: ["/api/video-call/incoming", matchId] });
    }
  });

  // WebSocket: Listen for call status updates
  useWebSocketEvent('call_status_update', (call: VideoCall) => {
    console.log('WebSocket: Call status update received', call);
    if (activeCall && call.id === activeCall.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/video-call/status", call.id] });
    }
    // Also invalidate messages to show call record
    if (matchId && call.matchId === matchId) {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
    }
  });

  // Detect if other party ended the call
  useEffect(() => {
    if (!activeCallStatus || !isCallActive || !activeCall) return;
    
    // If the call status is "ended" but we're still in the call, end it on our side
    if (activeCallStatus.status === 'ended' && activeCallStatus.id === activeCall.id) {
      console.log('Other party ended the call, closing on our side');
      
      // Calculate duration
      const duration = activeCallStatus.duration || 0;
      
      // Close the call on our side
      setIsCallActive(false);
      setActiveCall(null);
      setCallToken("");
      setJoinedCallId(null);
      
      queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
      
      const formattedDuration = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;
      toast({
        title: "Call ended",
        description: duration > 0 ? `Duration: ${formattedDuration}` : "The other party ended the call",
      });
    }
  }, [activeCallStatus, isCallActive, activeCall, matchId, toast]);

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
      const callAge = Date.now() - new Date(incomingCall.createdAt || Date.now()).getTime();
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
      setPendingMessage(content); // Show "sending..." state
      const receiverId = match.user1Id === user?.id ? match.user2Id : match.user1Id;
      return apiRequest("POST", "/api/messages", {
        matchId: matchId!,
        receiverId,
        content,
      });
    },
    onSuccess: () => {
      setMessageText("");
      setPendingMessage(null); // Clear pending state
      queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
    },
    onError: (error) => {
      setPendingMessage(null); // Clear pending state on error
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
      
      // Show connecting toast
      toast({
        title: "Connecting...",
        description: "Starting video call",
      });
      
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

  const handleEndCall = async (duration: number) => {
    if (!activeCall || !matchId || !user) return;
    
    try {
      await apiRequest("PATCH", `/api/video-call/${activeCall.id}/status`, {
        status: "ended",
      });
      
      // Create a call record message
      const otherUserId = activeCall.callerId === user.id ? activeCall.receiverId : activeCall.callerId;
      await apiRequest("POST", "/api/messages", {
        matchId,
        receiverId: otherUserId,
        content: `Video call`,
        messageType: 'call_record',
        callDuration: duration,
      });
      
      setIsCallActive(false);
      setActiveCall(null);
      setCallToken("");
      setJoinedCallId(null); // Reset so new calls can be joined
      
      queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
      
      const formattedDuration = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;
      toast({
        title: "Call ended",
        description: duration > 0 ? `Duration: ${formattedDuration}` : "The video call has been ended",
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

  // Show conversations list when no matchId is provided
  if (!matchId) {
    if (conversationsLoading) {
      return (
        <div className="min-h-screen bg-background pb-20">
          <div className="container max-w-3xl mx-auto p-4">
            <div className="mb-6">
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="mb-3">
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="container max-w-3xl mx-auto p-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Messages</h1>
            <p className="text-muted-foreground">
              {conversations.length === 0 
                ? "No conversations yet" 
                : `${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'}`
              }
            </p>
          </div>

          {conversations.length === 0 ? (
            <div className="text-center py-16">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2 text-lg">No Messages Yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Start swiping to find matches and begin conversations
              </p>
              <Button 
                onClick={() => setLocation("/discover")}
                data-testid="button-start-discovering"
              >
                Start Discovering
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => {
                const displayName = conversation.otherUser.useNickname
                  ? conversation.otherUser.displayName.split(' ')[0]
                  : conversation.otherUser.displayName;

                const isCallRecord = conversation.latestMessage?.messageType === 'call_record';
                const latestMessagePreview = conversation.latestMessage 
                  ? isCallRecord
                    ? `📹 ${conversation.latestMessage.content}`
                    : conversation.latestMessage.content
                  : "Start a conversation";

                const isMyMessage = conversation.latestMessage?.senderId === user?.id;

                return (
                  <Card
                    key={conversation.matchId}
                    className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all"
                    onClick={() => {
                      console.log('Navigating to:', `/messages/${conversation.matchId}`);
                      setLocation(`/messages/${conversation.matchId}`);
                    }}
                    data-testid={`conversation-${conversation.matchId}`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 flex-shrink-0">
                        <AvatarImage src={conversation.otherUser.photos?.[0]} />
                        <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">
                            {displayName}, {conversation.otherUser.age}
                          </h3>
                          {conversation.otherUser.isVerified && (
                            <CheckCircle2 className="h-4 w-4 text-primary fill-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className={`text-sm truncate ${conversation.unreadCount > 0 && !isMyMessage ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {isMyMessage && conversation.latestMessage && !isCallRecord && "You: "}
                          {latestMessagePreview}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {conversation.latestMessage?.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conversation.latestMessage.createdAt), { 
                              addSuffix: false 
                            })}
                          </span>
                        )}
                        {conversation.unreadCount > 0 && !isMyMessage && (
                          <Badge 
                            variant="default" 
                            className="h-5 min-w-5 rounded-full px-1.5 text-xs"
                            data-testid={`unread-badge-${conversation.matchId}`}
                          >
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show conversation detail when matchId is provided
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
              onClick={() => setLocation("/messages")}
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
          {messages.length === 0 && !pendingMessage ? (
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
            <>
              {messages.map((message) => {
              const isMe = message.senderId === user?.id;
              
              // Render call records differently
              if (message.messageType === 'call_record') {
                const formatDuration = (seconds: number) => {
                  const mins = Math.floor(seconds / 60);
                  const secs = seconds % 60;
                  return `${mins}:${secs.toString().padStart(2, '0')}`;
                };
                
                return (
                  <div
                    key={message.id}
                    className="flex justify-center"
                    data-testid={`message-${message.id}`}
                  >
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border text-muted-foreground">
                      <Video className="h-4 w-4" />
                      <span className="text-sm">
                        {message.content} • {message.callDuration ? formatDuration(message.callDuration) : '0:00'}
                      </span>
                    </div>
                  </div>
                );
              }
              
              // Regular text messages
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
                    <div className={`flex items-center gap-1.5 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <p className="text-xs text-muted-foreground">
                        {message.createdAt && formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </p>
                      {isMe && (
                        <CheckCircle2 className="h-3 w-3 text-muted-foreground" data-testid="message-sent-indicator" />
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
              
              {/* Pending message (sending...) */}
              {pendingMessage && (
                <div
                  className="flex justify-end"
                  data-testid="message-sending"
                >
                  <div className="max-w-[70%]">
                    <Card className="p-3 bg-primary text-primary-foreground opacity-70">
                      <p className="text-sm leading-relaxed break-words">{pendingMessage}</p>
                    </Card>
                    <div className="flex items-center gap-1.5 mt-1 justify-end">
                      <p className="text-xs text-muted-foreground italic">Sending...</p>
                    </div>
                  </div>
                </div>
              )}
            </>
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

      {/* Video Call - Full Screen */}
      {isCallActive && activeCall && callToken && (
        <VideoCallComponent
          callId={activeCall.id}
          channelName={activeCall.channelName}
          token={callToken}
          onEndCall={handleEndCall}
          isInitiator={activeCall.callerId === user?.id}
        />
      )}
    </div>
  );
}
