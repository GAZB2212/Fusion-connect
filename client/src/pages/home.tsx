import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, X, MapPin, Briefcase, GraduationCap, CheckCircle2, Info, Crown } from "lucide-react";
import type { ProfileWithUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";

export default function Home() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  
  // Swipe gesture state
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Fetch discover profiles
  const { data: profiles = [], isLoading } = useQuery<ProfileWithUser[]>({
    queryKey: ["/api/discover"],
  });

  // Check subscription status
  const { data: subscriptionStatus } = useQuery<{ hasActiveSubscription: boolean }>({
    queryKey: ["/api/subscription-status"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always refetch to ensure fresh subscription status
  });

  // Swipe mutation
  const swipeMutation = useMutation<{ success: boolean; isMatch: boolean }, Error, { profileId: string; direction: "right" | "left" }>({
    mutationFn: async ({ profileId, direction }) => {
      const result = await apiRequest("POST", "/api/swipe", { swipedId: profileId, direction });
      return result as unknown as { success: boolean; isMatch: boolean };
    },
    onSuccess: (data, variables) => {
      if (data.isMatch) {
        toast({
          title: "🎉 It's a Match!",
          description: "You both liked each other! Start a conversation now.",
        });
      } else if (variables.direction === "right" && !subscriptionStatus?.hasActiveSubscription) {
        // Show subscribe dialog for free users who swipe right
        setShowSubscribeDialog(true);
      }
      setCurrentIndex((prev) => prev + 1);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSwipe = (direction: "right" | "left") => {
    if (currentProfile) {
      swipeMutation.mutate({ profileId: currentProfile.userId, direction });
    }
  };

  // Touch/drag handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragStart) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
    if (!dragStart) return;
    
    const swipeThreshold = 100; // pixels
    
    if (Math.abs(dragOffset.x) > swipeThreshold) {
      if (dragOffset.x > 0) {
        // Swiped right - like
        handleSwipe("right");
      } else {
        // Swiped left - pass
        handleSwipe("left");
      }
    }
    
    // Reset
    setDragStart(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || !isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleMouseUp = () => {
    if (!dragStart) return;
    
    const swipeThreshold = 100;
    
    if (Math.abs(dragOffset.x) > swipeThreshold) {
      if (dragOffset.x > 0) {
        handleSwipe("right");
      } else {
        handleSwipe("left");
      }
    }
    
    setDragStart(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const currentProfile = profiles[currentIndex];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-md mx-auto py-8 px-4">
          <Skeleton className="h-96 w-full rounded-2xl mb-4" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Heart className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No More Profiles</h2>
          <p className="text-muted-foreground mb-6">
            Check back later for more matches, or adjust your filters.
          </p>
          <Button asChild>
            <a href="/">Back to Home</a>
          </Button>
        </div>
      </div>
    );
  }

  const age = currentProfile.age;
  const photos = currentProfile.photos;
  const displayName = currentProfile.useNickname ? currentProfile.displayName.split(' ')[0] : currentProfile.displayName;

  // Calculate card transform based on drag
  const rotation = dragOffset.x / 20; // Rotate based on horizontal drag
  const opacity = 1 - Math.abs(dragOffset.x) / 300;
  const cardStyle = {
    transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${rotation}deg)`,
    opacity: isDragging ? opacity : 1,
    transition: isDragging ? 'none' : 'all 0.3s ease-out',
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-md mx-auto py-8 px-4">
        {/* Profile Card */}
        <Card 
          className="relative overflow-hidden rounded-2xl shadow-lg mb-6 touch-none select-none"
          style={cardStyle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Photo */}
          <div className="relative aspect-[3/4] bg-muted">
            {photos && photos[0] ? (
              <img
                src={photos[0]}
                alt={displayName}
                className={`w-full h-full object-cover ${currentProfile.photoVisibility === 'blurred' ? 'blur-xl' : ''}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl text-muted-foreground">
                  {displayName.charAt(0)}
                </span>
              </div>
            )}
            
            {currentProfile.photoVisibility === 'blurred' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                <div className="bg-background/95 rounded-lg p-4 text-center max-w-xs mx-4">
                  <Info className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Photo Blurred for Privacy</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Will be revealed after matching
                  </p>
                </div>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            {/* Swipe Indicators */}
            {isDragging && (
              <>
                {dragOffset.x > 50 && (
                  <div className="absolute top-8 left-8 bg-primary/90 text-white px-6 py-3 rounded-lg font-bold text-xl rotate-12 pointer-events-none">
                    LIKE
                  </div>
                )}
                {dragOffset.x < -50 && (
                  <div className="absolute top-8 right-8 bg-destructive/90 text-white px-6 py-3 rounded-lg font-bold text-xl -rotate-12 pointer-events-none">
                    PASS
                  </div>
                )}
              </>
            )}

            {/* Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-3xl font-bold">{displayName}, {age}</h2>
                {currentProfile.isVerified && (
                  <CheckCircle2 className="h-6 w-6 text-primary fill-primary" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm mb-3">
                <MapPin className="h-4 w-4" />
                <span>{currentProfile.location}</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {currentProfile.lookingFor}
                </Badge>
                {currentProfile.sect && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">
                    {currentProfile.sect}
                  </Badge>
                )}
                {currentProfile.prayerFrequency && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">
                    Prays {currentProfile.prayerFrequency}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="p-6 space-y-4">
            {currentProfile.bio && (
              <div>
                <h3 className="font-semibold mb-2">About Me</h3>
                <p className="text-muted-foreground">{currentProfile.bio}</p>
              </div>
            )}

            <div className="grid gap-3">
              {currentProfile.occupation && (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Occupation</div>
                    <div className="font-medium">{currentProfile.occupation}</div>
                  </div>
                </div>
              )}

              {currentProfile.education && (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Education</div>
                    <div className="font-medium">{currentProfile.education}</div>
                  </div>
                </div>
              )}
            </div>

            {currentProfile.religiosity && (
              <div>
                <h3 className="font-semibold mb-2">Faith & Values</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {currentProfile.religiosity}
                  </Badge>
                  {currentProfile.halalImportance && (
                    <Badge variant="outline">
                      Halal: {currentProfile.halalImportance}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6">
          <Button
            size="icon"
            variant="outline"
            className="h-16 w-16 rounded-full border-2"
            onClick={() => handleSwipe("left")}
            disabled={swipeMutation.isPending}
            data-testid="button-pass"
          >
            <X className="h-8 w-8 text-muted-foreground" />
          </Button>

          <Button
            size="icon"
            className="h-20 w-20 rounded-full"
            onClick={() => handleSwipe("right")}
            disabled={swipeMutation.isPending}
            data-testid="button-like"
          >
            <Heart className="h-10 w-10 fill-current" />
          </Button>
        </div>

        {/* Counter */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          {currentIndex + 1} of {profiles.length}
        </p>
      </div>

      {/* Subscribe Dialog */}
      <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
        <DialogContent className="sm:max-w-md bg-[#0A0E17] border-white/10">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl text-[#F8F4E3] font-serif">
              Upgrade to See Your Matches
            </DialogTitle>
            <DialogDescription className="text-center text-[#F8F4E3]/70">
              To see who you've liked and connect with them, upgrade to Fusion Premium for just £9.99/month.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[#F8F4E3]/90">View all your matches</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[#F8F4E3]/90">Unlimited messaging</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[#F8F4E3]/90">Chaperone support</p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full"
              onClick={() => {
                setShowSubscribeDialog(false);
                setLocation("/subscribe");
              }}
              data-testid="button-subscribe-dialog"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Premium
            </Button>
            <Button
              variant="outline"
              className="w-full border-[#F8F4E3]/30 text-[#F8F4E3] hover:bg-[#F8F4E3]/10"
              onClick={() => setShowSubscribeDialog(false)}
              data-testid="button-continue-free"
            >
              Continue with Free
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
