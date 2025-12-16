import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, X, MapPin, Search, Calendar, Crown, Play } from "lucide-react";
import type { ProfileWithUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import logoImage from "@assets/NEW logo 2_1761587557587.png";

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
  
  // Animation state
  const [showAnimation, setShowAnimation] = useState<'like' | 'pass' | null>(null);
  
  // Video modal state
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Fetch discover profiles
  const { data: profiles = [], isLoading } = useQuery<ProfileWithUser[]>({
    queryKey: ["/api/discover"],
  });

  // Fetch today's matches
  const { data: todaysMatches = [] } = useQuery<any[]>({
    queryKey: ["/api/matches"],
    select: (data) => data.slice(0, 5), // Get first 5 matches for "Today's Matches"
  });

  // Check subscription status
  const { data: subscriptionStatus } = useQuery<{ hasActiveSubscription: boolean }>({
    queryKey: ["/api/subscription-status"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
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
      setShowAnimation(direction === "right" ? 'like' : 'pass');
      setTimeout(() => setShowAnimation(null), 800);
      swipeMutation.mutate({ profileId: currentProfile.userId, direction });
    }
  };

  // Touch/drag handlers
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
    const swipeThreshold = 100;
    if (Math.abs(dragOffset.x) > swipeThreshold) {
      handleSwipe(dragOffset.x > 0 ? "right" : "left");
    }
    setDragStart(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const currentProfile = profiles[currentIndex];

  // Calculate match percentage (mock for now - can be enhanced with actual algorithm)
  const calculateMatchPercentage = () => {
    return Math.floor(Math.random() * 20) + 80; // 80-99%
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20">
        <div className="container max-w-md mx-auto py-8 px-4">
          <Skeleton className="h-96 w-full rounded-2xl mb-4" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="text-center px-4">
          <div className="h-24 w-24 rounded-full bg-card flex items-center justify-center mx-auto mb-6">
            <Heart className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No More Profiles</h2>
          <p className="text-muted-foreground mb-6">
            Check back later for more matches
          </p>
        </div>
      </div>
    );
  }

  const age = currentProfile.age;
  const photos = currentProfile.photos;
  const displayName = currentProfile.useNickname ? currentProfile.displayName.split(' ')[0] : currentProfile.displayName;
  const matchPercentage = calculateMatchPercentage();
  
  const rotation = dragOffset.x / 20;
  const opacity = 1 - Math.abs(dragOffset.x) / 300;
  const cardStyle = {
    transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${rotation}deg)`,
    opacity: isDragging ? opacity : 1,
    transition: isDragging ? 'none' : 'all 0.3s ease-out',
  };

  // Get religious practice badges
  const religiousBadges = [];
  if (currentProfile.religiousPractice) {
    religiousBadges.push(currentProfile.religiousPractice.split(' ')[0]); // "Practicing" from "Strictly practising"
  }
  if (currentProfile.sect && currentProfile.sect !== 'No preference') {
    religiousBadges.push(currentProfile.sect);
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Swipe Animations */}
      <AnimatePresence>
        {showAnimation === 'like' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm pointer-events-none z-50"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.8 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
            >
              <Heart className="h-40 w-40 text-primary fill-primary filter drop-shadow-[0_0_30px_rgba(212,175,55,0.8)]" />
            </motion.div>
          </>
        )}
        {showAnimation === 'pass' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-md pointer-events-none z-50"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.1, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.8 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
            >
              <X className="h-40 w-40 text-foreground filter drop-shadow-[0_0_40px_rgba(248,244,227,0.8)]" strokeWidth={3} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="container max-w-md mx-auto py-6 px-4 space-y-4">
        {/* Logo */}
        <div className="flex justify-center mb-2">
          <img src={logoImage} alt="Fusion" className="h-16 w-auto" data-testid="img-logo" />
        </div>

        {/* Today's Matches */}
        {todaysMatches.length > 0 && (
          <Card className="bg-card/50 border-primary/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-foreground">Today's Matches</h3>
              <Badge className="bg-primary text-primary-foreground">
                {todaysMatches.length} New
              </Badge>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {todaysMatches.map((match: any, i: number) => {
                const matchProfile = match.profile1?.userId === user?.id ? match.profile2 : match.profile1;
                const matchName = matchProfile?.displayName?.split(' ')[0] || 'User';
                const matchPhoto = matchProfile?.photos?.[0];
                return (
                  <div key={i} className="flex flex-col items-center gap-1 min-w-[70px]">
                    <div className="h-16 w-16 rounded-full border-2 border-primary overflow-hidden bg-card">
                      {matchPhoto ? (
                        <img 
                          src={matchPhoto} 
                          alt={matchName} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="w-full h-full items-center justify-center text-xl font-bold text-primary" style={{ display: matchPhoto ? 'none' : 'flex' }}>
                        {matchName.charAt(0)}
                      </div>
                    </div>
                    <span className="text-xs text-foreground font-medium truncate w-full text-center">
                      {matchName}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Main Profile Card */}
        <Card 
          className="relative overflow-hidden rounded-2xl shadow-xl border-2 border-primary/10 touch-none select-none"
          style={cardStyle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          data-testid="card-profile"
        >
          {/* Photo */}
          <div className="relative aspect-[3/4]">
            {photos && photos[0] ? (
              <img
                src={photos[0]}
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
            <div className="w-full h-full bg-card items-center justify-center" style={{ display: photos && photos[0] ? 'none' : 'flex' }}>
              <span className="text-6xl font-bold text-primary">
                {displayName.charAt(0)}
              </span>
            </div>
            
            {/* Match Percentage Badge */}
            <div className="absolute top-4 right-4">
              <Badge className="bg-primary text-primary-foreground font-bold text-sm px-3 py-1">
                {matchPercentage}% Match
              </Badge>
            </div>

            {/* Video Intro Button */}
            {currentProfile.introVideoUrl && (
              <div className="absolute top-4 left-4">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-12 w-12 rounded-full bg-white/90 hover:bg-white shadow-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowVideoModal(true);
                  }}
                  data-testid="button-play-video"
                >
                  <Play className="h-6 w-6 text-primary fill-primary" />
                </Button>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            
            {/* Swipe Indicators */}
            {isDragging && (
              <>
                {dragOffset.x > 50 && (
                  <div className="absolute top-8 left-8 bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-bold text-xl rotate-12">
                    LIKE
                  </div>
                )}
                {dragOffset.x < -50 && (
                  <div className="absolute top-8 right-8 bg-foreground/90 text-background px-6 py-3 rounded-lg font-bold text-xl -rotate-12">
                    PASS
                  </div>
                )}
              </>
            )}

            {/* Profile Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white space-y-3">
              <div>
                <h2 className="text-3xl font-bold mb-1">{displayName}, {age}</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{currentProfile.profession || currentProfile.occupation}</span>
                  {currentProfile.location && (
                    <>
                      <span>•</span>
                      <span>2 miles away</span>
                    </>
                  )}
                </div>
              </div>

              {/* Religious Badges */}
              {religiousBadges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {religiousBadges.map((badge, i) => (
                    <Badge key={i} className="bg-primary/90 text-primary-foreground border-0 font-medium">
                      {badge}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Bio */}
              {currentProfile.bio && (
                <p className="text-sm leading-relaxed line-clamp-3">
                  {currentProfile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 p-6 bg-card">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 h-14 text-lg font-semibold border-2 hover-elevate"
              onClick={() => handleSwipe("left")}
              data-testid="button-pass"
            >
              <X className="h-6 w-6 mr-2" />
              Pass
            </Button>
            <Button
              size="lg"
              className="flex-1 h-14 text-lg font-semibold shadow-lg"
              onClick={() => handleSwipe("right")}
              data-testid="button-like"
            >
              <Heart className="h-6 w-6 mr-2" />
              Like
            </Button>
          </div>
        </Card>

        {/* Advanced Search & Events */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 hover-elevate cursor-pointer bg-card/80 border-primary/10" data-testid="card-advanced-search">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Advanced Search</h3>
            <p className="text-xs text-muted-foreground">Filter preferences</p>
          </Card>
          <Card className="p-4 hover-elevate cursor-pointer bg-card/80 border-primary/10" data-testid="card-events">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Events</h3>
            <p className="text-xs text-muted-foreground">Community meetups</p>
          </Card>
        </div>
      </div>

      {/* Video Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Video Introduction</DialogTitle>
            <DialogDescription>Watch {currentProfile?.displayName?.split(' ')[0] || 'their'} intro video</DialogDescription>
          </DialogHeader>
          <div className="relative aspect-[9/16] w-full max-h-[80vh]">
            {currentProfile?.introVideoUrl && (
              <video
                src={currentProfile.introVideoUrl}
                className="w-full h-full object-cover"
                controls
                autoPlay
                playsInline
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscribe Dialog */}
      <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
        <DialogContent className="sm:max-w-md bg-card border-primary/20">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl font-serif">
              Upgrade to See Your Matches
            </DialogTitle>
            <DialogDescription className="text-center">
              To see who you've liked and connect with them, upgrade to Fusion Premium for just £9.99/month.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowSubscribeDialog(false)} className="flex-1">
              Maybe Later
            </Button>
            <Button onClick={() => setLocation("/subscribe")} className="flex-1">
              Upgrade Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
