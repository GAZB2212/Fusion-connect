import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, MapPin, CheckCircle2, Heart, Crown, Lock, UserX, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MatchWithProfiles } from "@shared/schema";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { IOSHeader } from "@/components/ios-header";
import { IOSSpinner } from "@/components/ios-spinner";
import { PullToRefresh } from "@/components/pull-to-refresh";

export default function Matches() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscribe } = useWebSocket();
  const [showUnmatchDialog, setShowUnmatchDialog] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMatchName, setSelectedMatchName] = useState<string>("");
  
  const { data: matches = [], isLoading, error, refetch } = useQuery<MatchWithProfiles[]>({
    queryKey: ["/api/matches"],
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const handleRefresh = async () => {
    await refetch();
  };

  // Subscribe to real-time match updates via WebSocket
  useEffect(() => {
    const unsubscribe = subscribe('new_match', () => {
      console.log('[Matches] Received new_match event, invalidating cache');
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    });
    return unsubscribe;
  }, [subscribe]);

  // Check if error is subscription required (403)
  const requiresSubscription = error && (error as any).message?.includes("403");

  const unmatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest("DELETE", `/api/matches/${matchId}`);
    },
    onSuccess: () => {
      toast({
        title: "Unmatched",
        description: "You have been unmatched from this person",
      });
      setShowUnmatchDialog(false);
      setSelectedMatchId(null);
      setSelectedMatchName("");
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unmatch",
        description: error.message || "Could not unmatch",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <IOSSpinner size="lg" className="text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading matches...</p>
        </div>
      </div>
    );
  }

  // Show paywall if subscription is required
  if (requiresSubscription) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] golden-shimmer pb-20">
        <div className="container max-w-3xl mx-auto py-8 px-4">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Crown className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2 text-[#F8F4E3] font-serif">Upgrade to Premium</h1>
            <p className="text-[#F8F4E3]/70">
              You have matches waiting! Subscribe to view and connect with them.
            </p>
          </div>

          <Card className="bg-[#0A0E17] border-white/10">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-[#F8F4E3] font-serif">Fusion Premium</CardTitle>
              <CardDescription className="text-[#F8F4E3]/70">
                Unlock all features for just £9.99/month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#F8F4E3] font-medium">View All Your Matches</p>
                    <p className="text-[#F8F4E3]/60 text-sm">See everyone who swiped right on you</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#F8F4E3] font-medium">Unlimited Messaging</p>
                    <p className="text-[#F8F4E3]/60 text-sm">Chat with all your matches without limits</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#F8F4E3] font-medium">Chaperone Support</p>
                    <p className="text-[#F8F4E3]/60 text-sm">Add your Wali or guardian to conversations</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#F8F4E3] font-medium">Full Privacy Controls</p>
                    <p className="text-[#F8F4E3]/60 text-sm">Control who sees your photos and profile</p>
                  </div>
                </div>
              </div>

              <div className="text-center py-4 border-t border-white/10">
                <div className="text-5xl font-bold text-primary mb-2 font-serif">£9.99</div>
                <div className="text-[#F8F4E3]/70">per month • Cancel anytime</div>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                onClick={() => setLocation("/subscribe")}
                data-testid="button-subscribe-now"
              >
                <Crown className="h-4 w-4 mr-2" />
                Subscribe Now
              </Button>

              <p className="text-xs text-[#F8F4E3]/50 text-center">
                Your subscription will automatically renew each month
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <IOSHeader 
        title="Matches" 
        subtitle={`${matches.length} ${matches.length === 1 ? 'person' : 'people'} you both liked`}
      />
      <div className="container max-w-4xl mx-auto px-4 py-4">

        {matches.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Heart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Matches Yet</h2>
            <p className="text-muted-foreground mb-6">
              Keep swiping to find your perfect match!
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-start-swiping">
              Start Swiping
            </Button>
          </div>
        ) : (
          <PullToRefresh onRefresh={handleRefresh} className="h-full">
          <div className="grid md:grid-cols-2 gap-6">
            {matches.map((match) => {
              // Determine which profile is the other user
              const otherProfile = user?.id === match.user1Id 
                ? match.user2Profile 
                : match.user1Profile;
              
              const displayName = otherProfile.useNickname 
                ? otherProfile.displayName.split(' ')[0] 
                : otherProfile.displayName;

              return (
                <Card key={match.id} className="overflow-hidden hover-elevate" data-testid={`card-match-${match.id}`}>
                  <div className="relative aspect-[4/3] bg-muted">
                    {otherProfile.photos?.[0] ? (
                      <img
                        src={otherProfile.photos[0]}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-full h-full items-center justify-center" 
                      style={{ display: otherProfile.photos?.[0] ? 'none' : 'flex' }}
                    >
                      <span className="text-6xl text-muted-foreground">
                        {displayName.charAt(0)}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold">{displayName}, {otherProfile.age}</h3>
                        {otherProfile.isVerified && (
                          <CheckCircle2 className="h-5 w-5 text-primary fill-primary" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{otherProfile.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {otherProfile.lookingFor}
                      </Badge>
                      {otherProfile.sect && (
                        <Badge variant="outline">
                          {otherProfile.sect}
                        </Badge>
                      )}
                    </div>

                    {otherProfile.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {otherProfile.bio}
                      </p>
                    )}

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setLocation(`/matches/${match.id}/profile`)}
                      data-testid={`button-view-profile-${match.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Profile
                    </Button>
                    <Button
                      className="w-full"
                      onClick={() => setLocation(`/messages/${match.id}`)}
                      data-testid={`button-message-${match.id}`}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setSelectedMatchId(match.id);
                        setSelectedMatchName(displayName);
                        setShowUnmatchDialog(true);
                      }}
                      data-testid={`button-unmatch-${match.id}`}
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Unmatch
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
          </PullToRefresh>
        )}
      </div>

      {/* Unmatch Confirmation Dialog */}
      <Dialog open={showUnmatchDialog} onOpenChange={setShowUnmatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unmatch from {selectedMatchName}?</DialogTitle>
            <DialogDescription>
              This will remove your match and delete any conversation. You can match with them again in the future.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUnmatchDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedMatchId && unmatchMutation.mutate(selectedMatchId)}
              disabled={unmatchMutation.isPending}
              data-testid="button-confirm-unmatch"
            >
              {unmatchMutation.isPending ? "Unmatching..." : "Unmatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
