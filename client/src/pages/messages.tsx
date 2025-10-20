import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Send, ArrowLeft, Shield, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { MessageWithSender, MatchWithProfiles, Chaperone } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, params] = useRoute("/messages/:matchId");
  const [, setLocation] = useLocation();
  const matchId = params?.matchId;

  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
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
      <div className="border-t bg-background">
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
    </div>
  );
}
