import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Heart, X, MapPin, Play, ChevronLeft, ChevronRight, ShieldCheck, Users, Sparkles, Moon, Star, User, Ruler, Briefcase, GraduationCap, Baby, Loader2, Info, CheckCircle2, Clock, Crown, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProfileWithUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getPromptById, type ProfilePromptAnswer } from "@/lib/islamicPrompts";
import { haptic } from "@/lib/haptics";

interface ForYouPick {
  id: string;
  profile: ProfileWithUser;
  compatibilityScore: number;
  matchReasons: string[];
  userAction: string | null;
  isForYouPick: boolean;
}

interface SuggestionsResponse {
  picks: ForYouPick[];
  dailyLimit: number;
  picksRemaining: number;
  resetTime: string;
}

function ProfilePhotoCarousel({ photos, displayName }: { photos: string[]; displayName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && activeIndex < photos.length - 1) {
        setActiveIndex(prev => prev + 1);
      } else if (diff < 0 && activeIndex > 0) {
        setActiveIndex(prev => prev - 1);
      }
    }
    setTouchStart(null);
  };

  return (
    <div className="relative mb-4 px-5">
      <div 
        className="relative w-full aspect-[4/5] rounded-xl overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={activeIndex}
            src={photos[activeIndex]}
            alt={`${displayName} photo ${activeIndex + 1}`}
            className="w-full h-full object-cover"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.2 }}
          />
        </AnimatePresence>
        
        {photos.length > 1 && (
          <>
            {activeIndex > 0 && (
              <button
                onClick={() => setActiveIndex(prev => prev - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
            )}
            {activeIndex < photos.length - 1 && (
              <button
                onClick={() => setActiveIndex(prev => prev + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            )}
          </>
        )}
      </div>
      
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {photos.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                idx === activeIndex ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoModalPlayer({ videoUrl, displayName }: { videoUrl: string; displayName: string }) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [videoUrl]);

  if (hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
          <Play className="h-8 w-8 text-white/50" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Video Unavailable</h3>
        <p className="text-sm text-white/60">
          {displayName}'s intro video couldn't be loaded on this device.
        </p>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover"
        controls
        autoPlay
        playsInline
        onLoadedData={() => setIsLoading(false)}
        onError={() => {
          console.log('[VideoModalPlayer] Video playback error for:', videoUrl);
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </>
  );
}

function CuratedMatchCard({ 
  pick, 
  onSwipe,
  isLoading 
}: { 
  pick: ForYouPick; 
  onSwipe: (direction: 'right' | 'left') => void;
  isLoading: boolean;
}) {
  const [, setLocation] = useLocation();
  const profile = pick.profile;
  const photo = profile.photos?.[profile.mainPhotoIndex || 0] || profile.photos?.[0];
  const displayName = profile.useNickname ? profile.displayName?.split(' ')[0] : profile.displayName;
  
  return (
    <Card 
      className="flex-shrink-0 w-[260px] overflow-hidden cursor-pointer hover-elevate active-elevate-2 border-[#f59e0b]/30"
      onClick={() => setLocation(`/profile/${profile.userId}`)}
      data-testid={`card-curated-${profile.userId}`}
    >
      <div className="relative aspect-[3/4]">
        {photo ? (
          <img
            src={photo}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <User className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        <div className="absolute top-3 right-3">
          <Badge className="bg-[#f59e0b]/90 text-white border-0 gap-1 px-2 py-1 text-xs font-semibold">
            {pick.compatibilityScore}% Match
          </Badge>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="font-semibold text-white text-base truncate">
              {displayName}
            </h3>
            {profile.age && (
              <span className="text-white/90 text-base">, {profile.age}</span>
            )}
            {profile.faceVerified && (
              <CheckCircle2 className="h-4 w-4 text-[#f59e0b] flex-shrink-0" />
            )}
          </div>
          {profile.location && (
            <div className="flex items-center gap-1 text-white/70 text-xs">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{profile.location}</span>
            </div>
          )}
          
          {pick.matchReasons && pick.matchReasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {pick.matchReasons.slice(0, 2).map((reason, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px] bg-white/10 text-white/90 border-white/20 px-1.5 py-0.5">
                  {reason}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function CuratedMatchesSection({ 
  onViewProfile 
}: { 
  onViewProfile: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [timeUntilReset, setTimeUntilReset] = useState<string>("");

  const { data, isLoading } = useQuery<SuggestionsResponse>({
    queryKey: ["/api/suggestions"],
  });

  useEffect(() => {
    if (!data?.resetTime) return;

    const updateCountdown = () => {
      const now = new Date();
      const reset = new Date(data.resetTime);
      const diff = reset.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilReset(t('forYou.refreshing', 'Refreshing...'));
        queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilReset(`${hours}h ${minutes}m`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [data?.resetTime, t]);

  const handleSwipe = async (pick: ForYouPick, direction: "right" | "left") => {
    haptic.medium();

    try {
      if (pick.id) {
        await apiRequest("POST", `/api/suggestions/${pick.id}/action`, {
          action: direction === "right" ? "liked" : "passed",
        });
      }

      const response = await apiRequest("POST", "/api/swipe", {
        swipedId: pick.profile.userId,
        direction,
      });

      const result = await response.json();

      if (result.isMatch) {
        haptic.success();
        toast({
          title: t('discover.itsAMatch'),
          description: t('discover.matchNotification'),
        });
        setLocation("/matches");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to swipe",
        variant: "destructive",
      });
    }
  };

  const picks = (data && Array.isArray(data.picks)) ? data.picks : [];
  const remainingPicks = Array.isArray(picks) ? picks.filter(p => p && !p.userAction) : [];
  const viewedCount = picks.length - remainingPicks.length;

  if (isLoading) {
    return (
      <Card className="mx-4 mb-4 p-4 border-l-4 border-l-[#f59e0b] bg-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#f59e0b]/20 flex items-center justify-center animate-pulse">
            <Sparkles className="h-5 w-5 text-[#f59e0b]" />
          </div>
          <div>
            <div className="h-4 w-40 bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </Card>
    );
  }

  if (remainingPicks.length === 0 && picks.length > 0) {
    return (
      <Card className="mx-4 mb-4 p-4 border-l-4 border-l-[#f59e0b]/50 bg-card/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-muted-foreground">
              {t('forYou.allViewedToday', 'All curated matches viewed today!')}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
              <Clock className="h-3 w-3" />
              <span>{t('forYou.newMatchesIn', 'New matches in')} {timeUntilReset}</span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (picks.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <Card className="mx-4 mb-3 p-4 border-l-4 border-l-[#f59e0b] bg-card shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#f59e0b]/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-[#f59e0b]" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                {t('forYou.curatedMatches', '8 Curated Matches for You Today')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('forYou.basedOnValues', 'Based on your values and preferences')} • {viewedCount} {t('forYou.ofViewed', 'of')} {picks.length} {t('forYou.viewed', 'viewed')}
              </p>
            </div>
          </div>
        </div>
      </Card>
      
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-3 px-4 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {remainingPicks.map((pick) => (
          <div key={pick.id} className="snap-start">
            <CuratedMatchCard
              pick={pick}
              onSwipe={(dir) => handleSwipe(pick, dir)}
              isLoading={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showAnimation, setShowAnimation] = useState<'like' | 'pass' | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  
  const [hasSwipedOnce, setHasSwipedOnce] = useState(
    localStorage.getItem('hasSwipedBefore') === 'true'
  );
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: profiles = [], isLoading } = useQuery<ProfileWithUser[]>({
    queryKey: ["/api/discover"],
  });

  const { data: subscriptionStatus } = useQuery<{ hasActiveSubscription: boolean }>({
    queryKey: ["/api/subscription-status"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const swipeMutation = useMutation<{ success: boolean; isMatch: boolean; matchId: string | null }, Error, { profileId: string; direction: "right" | "left" }>({
    mutationFn: async ({ profileId, direction }) => {
      const result = await apiRequest("POST", "/api/swipe", { swipedId: profileId, direction });
      return result as unknown as { success: boolean; isMatch: boolean; matchId: string | null };
    },
    onSuccess: (data, variables) => {
      if (data.isMatch && data.matchId) {
        haptic.success();
        toast({
          title: t('discover.itsAMatch'),
          description: t('discover.matchNotification'),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
        setTimeout(() => {
          setLocation(`/messages/${data.matchId}`);
        }, 1200);
      } else if (variables.direction === "right" && !subscriptionStatus?.hasActiveSubscription) {
        setShowSubscribeDialog(true);
      }
      setCurrentIndex((prev) => prev + 1);
      setCurrentPhotoIndex(0);
      setImageLoadError(false);
      setIsProfileExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/likes"] });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSwipe = (direction: "right" | "left") => {
    if (currentProfile) {
      if (!hasSwipedOnce) {
        setHasSwipedOnce(true);
        localStorage.setItem('hasSwipedBefore', 'true');
      }
      
      haptic.medium();
      setShowAnimation(direction === "right" ? 'like' : 'pass');
      setTimeout(() => setShowAnimation(null), 800);
      swipeMutation.mutate({ profileId: currentProfile.userId, direction });
    }
  };
  
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

  const handlePhotoTap = (e: React.MouseEvent) => {
    if (isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    if (x < width / 3) {
      setImageLoadError(false);
      setCurrentPhotoIndex((prev) => Math.max(0, prev - 1));
    } else if (x > (width * 2) / 3) {
      setImageLoadError(false);
      const maxIndex = (currentProfile?.photos?.length || 1) - 1;
      setCurrentPhotoIndex((prev) => Math.min(maxIndex, prev + 1));
    }
  };

  const currentProfile = profiles[currentIndex];

  useEffect(() => {
    setCurrentPhotoIndex(0);
    setImageLoadError(false);
  }, [currentProfile?.id]);

  useEffect(() => {
    const card = cardRef.current;
    if (card && currentProfile?.id) {
      card.style.transform = 'scale(0.97) translateY(15px)';
      card.style.opacity = '0';
      
      requestAnimationFrame(() => {
        card.style.transition = 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
        card.style.transform = 'scale(1) translateY(0)';
        card.style.opacity = '1';
      });
    }
  }, [currentProfile?.id]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bottom-16 flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="min-h-screen pb-20 bg-background">
        <div className="pt-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
          <CuratedMatchesSection onViewProfile={(userId) => setLocation(`/profile/${userId}`)} />
        </div>
        
        <div className="flex flex-col items-center justify-center px-4 py-16">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Heart className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{t('discover.noMoreProfiles')}</h2>
          <p className="text-muted-foreground mb-6 text-center">
            {t('discover.checkBackLater')}
          </p>
        </div>
      </div>
    );
  }

  const age = currentProfile.age;
  const photos = currentProfile.photos || [];
  const displayName = currentProfile.useNickname ? currentProfile.displayName.split(' ')[0] : currentProfile.displayName;
  
  const rotation = dragOffset.x / 25;
  const opacity = 1 - Math.abs(dragOffset.x) / 400;
  const cardStyle = {
    transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y * 0.3}px) rotate(${rotation}deg)`,
    opacity: isDragging ? opacity : 1,
    transition: isDragging ? 'none' : 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  };

  const currentPhoto = photos[currentPhotoIndex] || photos[0];

  return (
    <div className="fixed inset-0 bottom-16 bg-background overflow-hidden flex flex-col">
      <AnimatePresence>
        {showAnimation === 'like' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gradient-to-b from-primary/30 via-primary/20 to-primary/30 backdrop-blur-md pointer-events-none z-50"
            />
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                animate={{ 
                  scale: [0, 1, 0.8], 
                  opacity: [0, 1, 0],
                  x: Math.cos((i / 8) * Math.PI * 2) * 120,
                  y: Math.sin((i / 8) * Math.PI * 2) * 120,
                }}
                transition={{ duration: 1, delay: i * 0.05 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
              >
                <Star className="h-6 w-6 text-primary fill-primary" />
              </motion.div>
            ))}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1 }}
              className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-50"
            >
              <div className="relative">
                <Moon className="h-32 w-32 text-primary fill-primary filter drop-shadow-[0_0_40px_rgba(212,175,55,0.8)] -rotate-45" />
                <Star className="absolute -top-4 -right-4 h-12 w-12 text-primary fill-primary filter drop-shadow-[0_0_20px_rgba(212,175,55,0.8)]" />
              </div>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
                transition={{ duration: 1, delay: 0.2 }}
                className="text-2xl font-bold text-primary mt-4 drop-shadow-lg"
              >
                Mashallah!
              </motion.p>
            </motion.div>
          </>
        )}
        {showAnimation === 'pass' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-md pointer-events-none z-50"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.8 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
            >
              <X className="h-40 w-40 text-white/80 filter drop-shadow-[0_0_40px_rgba(255,255,255,0.6)]" strokeWidth={3} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-shrink-0 overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="pt-4">
          <CuratedMatchesSection onViewProfile={(userId) => setLocation(`/profile/${userId}`)} />
        </div>
        
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium">
            {t('discover.orKeepDiscovering', 'Or keep discovering')}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </div>

      <div 
        ref={cardRef}
        className="flex-1 relative cursor-grab active:cursor-grabbing"
        style={cardStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handlePhotoTap}
        data-testid="card-profile"
      >
        <div className="absolute inset-0">
          {currentPhoto && !imageLoadError ? (
            <img
              key={`${currentProfile.id}-${currentPhotoIndex}`}
              src={currentPhoto}
              alt={displayName}
              className="w-full h-full object-cover"
              loading="eager"
              onLoad={() => {
                console.log('[Home] Image loaded successfully:', currentPhoto);
              }}
              onError={(e) => {
                console.log('[Home] Image load error for:', currentPhoto, e);
                setImageLoadError(true);
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-primary/20 to-primary/40 flex items-center justify-center">
              <span className="text-9xl font-bold text-primary/60">
                {displayName.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {photos.length > 1 && (
          <div className="absolute top-4 left-4 right-4 flex gap-1 z-20">
            {photos.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex-1 h-1 rounded-full transition-all duration-300",
                  idx === currentPhotoIndex 
                    ? "bg-white" 
                    : "bg-white/40"
                )}
              />
            ))}
          </div>
        )}

        {photos.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/20 backdrop-blur-sm text-white/80 hover:bg-black/40 transition-colors z-20 hidden md:flex"
              onClick={(e) => {
                e.stopPropagation();
                setImageLoadError(false);
                setCurrentPhotoIndex((prev) => Math.max(0, prev - 1));
              }}
              disabled={currentPhotoIndex === 0}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/20 backdrop-blur-sm text-white/80 hover:bg-black/40 transition-colors z-20 hidden md:flex"
              onClick={(e) => {
                e.stopPropagation();
                setImageLoadError(false);
                setCurrentPhotoIndex((prev) => Math.min(photos.length - 1, prev + 1));
              }}
              disabled={currentPhotoIndex === photos.length - 1}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {currentProfile.introVideoUrl && (
          <div className="absolute top-16 right-4 z-20">
            <Button
              size="icon"
              className="h-12 w-12 rounded-full bg-white/90 hover:bg-white shadow-xl active:scale-95 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                setShowVideoModal(true);
              }}
              data-testid="button-play-video"
            >
              <Play className="h-5 w-5 text-primary fill-primary" />
            </Button>
          </div>
        )}

        <AnimatePresence>
          {isDragging && dragOffset.x > 50 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: -15 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-8 left-6 bg-primary text-primary-foreground px-8 py-4 rounded-lg font-bold text-2xl shadow-2xl z-30"
            >
              LIKE
            </motion.div>
          )}
          {isDragging && dragOffset.x < -50 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotate: 20 }}
              animate={{ opacity: 1, scale: 1, rotate: 15 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-8 right-6 bg-white text-black px-8 py-4 rounded-lg font-bold text-2xl shadow-2xl z-30"
            >
              PASS
            </motion.div>
          )}
        </AnimatePresence>

        {!hasSwipedOnce && (
          <>
            <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <ChevronLeft 
                className="w-14 h-14 text-white/40 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] animate-pulse" 
                strokeWidth={2.5} 
              />
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <ChevronRight 
                className="w-14 h-14 text-white/40 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] animate-pulse" 
                strokeWidth={2.5} 
              />
            </div>
          </>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />

        <div className="absolute bottom-40 left-0 right-0 px-5 text-white z-10">
          <div className="flex items-center gap-2 mb-3">
            {currentProfile.isVerified && (
              <Badge className="bg-emerald-500/90 text-white border-0 gap-1.5 px-2.5 py-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('discover.verified')}
              </Badge>
            )}
            {currentProfile.waliInvolvement && currentProfile.waliInvolvement !== 'not_needed' && (
              <Badge className="bg-primary/90 text-primary-foreground border-0 gap-1.5 px-2.5 py-1">
                <Users className="h-3.5 w-3.5" />
                {t('profile.waliInvolved')}
              </Badge>
            )}
            {currentProfile.lookingFor === "Marriage" && (
              <Badge className="bg-rose-500/90 text-white border-0 gap-1.5 px-2.5 py-1">
                <Sparkles className="h-3.5 w-3.5" />
                {t('profile.nikkahReady')}
              </Badge>
            )}
          </div>

          <h2 className="text-4xl font-bold mb-2 drop-shadow-lg">{displayName}, {age}</h2>
          
          <div className="flex items-center gap-3 text-white/90 mb-3">
            {currentProfile.profession && (
              <span className="font-medium">{currentProfile.profession}</span>
            )}
            {currentProfile.location && (
              <>
                <span className="text-white/50">|</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {currentProfile.location}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {currentProfile.sect && currentProfile.sect !== 'No preference' && (
              <Badge variant="outline" className="bg-white/10 text-white border-white/30 backdrop-blur-sm">
                {currentProfile.sect}
              </Badge>
            )}
            {currentProfile.religiousPractice && (
              <Badge variant="outline" className="bg-white/10 text-white border-white/30 backdrop-blur-sm">
                {currentProfile.religiousPractice}
              </Badge>
            )}
            {currentProfile.prayerFrequency && (
              <Badge variant="outline" className="bg-white/10 text-white border-white/30 backdrop-blur-sm">
                {String(currentProfile.prayerFrequency)}
              </Badge>
            )}
          </div>

          {currentProfile.profilePrompts && Array.isArray(currentProfile.profilePrompts) && (currentProfile.profilePrompts as ProfilePromptAnswer[]).length > 0 && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-3">
              {(() => {
                const prompts = currentProfile.profilePrompts as ProfilePromptAnswer[];
                const firstPrompt = prompts[0];
                const promptConfig = getPromptById(firstPrompt.promptId);
                return (
                  <div>
                    <p className="text-xs text-white/70 mb-1">{promptConfig?.prompt || 'About me...'}</p>
                    <p className="text-sm text-white font-medium line-clamp-2">{firstPrompt.answer}</p>
                  </div>
                );
              })()}
            </div>
          )}

          {currentProfile.bio && !currentProfile.profilePrompts && (
            <p className="text-base leading-relaxed text-white/90 line-clamp-2 mb-2">
              {currentProfile.bio}
            </p>
          )}
        </div>

        <div className="absolute bottom-20 left-0 right-0 flex justify-center items-center gap-4 px-4 z-20">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleSwipe("left");
            }}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-95 transition-all duration-200"
            aria-label="Pass"
            data-testid="button-pass"
          >
            <X className="w-5 h-5 text-white/70" strokeWidth={2.5} />
          </button>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsProfileExpanded(!isProfileExpanded);
            }}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-95 transition-all duration-200"
            aria-label="More info"
            data-testid="button-view-profile"
          >
            <Info className="w-5 h-5 text-white/70" strokeWidth={2.5} />
          </button>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleSwipe("right");
            }}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg shadow-amber-500/30"
            aria-label="Like"
            data-testid="button-like"
          >
            <Heart className="w-6 h-6 text-white" strokeWidth={2.5} fill="white" />
          </button>
        </div>
      </div>

      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Video Introduction</DialogTitle>
            <DialogDescription>Watch {currentProfile?.displayName?.split(' ')[0] || 'their'} intro video</DialogDescription>
          </DialogHeader>
          <div className="relative aspect-[9/16] w-full max-h-[80vh]">
            {currentProfile?.introVideoUrl && (
              <VideoModalPlayer 
                videoUrl={currentProfile.introVideoUrl}
                displayName={currentProfile?.displayName?.split(' ')[0] || 'This user'}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
        <DialogContent className="sm:max-w-md bg-card border-primary/20">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl font-bold">
              {t('subscription.upgradeToMatch')}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t('subscription.upgradeDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowSubscribeDialog(false)} className="flex-1">
              {t('common.maybeLater')}
            </Button>
            <Button onClick={() => setLocation("/subscribe")} className="flex-1">
              {t('subscription.upgradeNow')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {isProfileExpanded && currentProfile && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                setIsProfileExpanded(false);
              }
            }}
            className="fixed inset-x-0 bottom-0 top-[35%] bg-card rounded-t-3xl z-50 shadow-2xl touch-pan-x"
          >
            <div 
              className="flex justify-center pt-3 pb-2 cursor-pointer"
              onClick={() => setIsProfileExpanded(false)}
            >
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
            
            <ScrollArea className="h-[calc(100%-60px)]">
              <div className="pb-32">
                {photos.length > 0 && (
                  <ProfilePhotoCarousel photos={photos} displayName={displayName} />
                )}

                <div className="flex items-center gap-2 mb-4 px-5">
                  <h2 className="text-2xl font-bold">{displayName}, {age}</h2>
                  {currentProfile.isVerified && (
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  )}
                </div>

                {currentProfile.location && (
                  <p className="flex items-center gap-1 text-muted-foreground mb-4 px-5">
                    <MapPin className="h-4 w-4" />
                    {currentProfile.location}
                  </p>
                )}

                {currentProfile.bio && (
                  <div className="mb-6 px-5">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('discover.aboutMe')}</h3>
                    <p className="text-foreground">{currentProfile.bio}</p>
                  </div>
                )}

                {currentProfile.profilePrompts && Array.isArray(currentProfile.profilePrompts) && (currentProfile.profilePrompts as ProfilePromptAnswer[]).length > 0 && (
                  <div className="space-y-3 mb-6 px-5">
                    {(currentProfile.profilePrompts as ProfilePromptAnswer[]).map((prompt, idx) => {
                      const promptConfig = getPromptById(prompt.promptId);
                      return (
                        <div key={idx} className="bg-muted/50 rounded-xl p-4">
                          <p className="text-xs text-muted-foreground mb-1">{promptConfig?.prompt || 'About me...'}</p>
                          <p className="text-foreground font-medium">{prompt.answer}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mb-6 px-5">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('profile.basicInfo')}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {currentProfile.height && (
                      <div className="flex items-center gap-2 text-sm">
                        <Ruler className="h-4 w-4 text-primary" />
                        <span>{currentProfile.height} {currentProfile.heightUnit || 'cm'}</span>
                      </div>
                    )}
                    {currentProfile.profession && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <span>{currentProfile.profession}</span>
                      </div>
                    )}
                    {currentProfile.education && (
                      <div className="flex items-center gap-2 text-sm">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        <span>{currentProfile.education}</span>
                      </div>
                    )}
                    {currentProfile.hasChildren !== null && currentProfile.hasChildren !== undefined && (
                      <div className="flex items-center gap-2 text-sm">
                        <Baby className="h-4 w-4 text-primary" />
                        <span>{currentProfile.hasChildren ? t('profile.hasChildren') : t('profile.noChildren')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-6 px-5">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('profile.religiousBackground')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentProfile.sect && currentProfile.sect !== 'No preference' && (
                      <Badge variant="outline" className="bg-primary/10 border-primary/30">
                        {currentProfile.sect}
                      </Badge>
                    )}
                    {currentProfile.religiousPractice && (
                      <Badge variant="outline" className="bg-primary/10 border-primary/30">
                        {currentProfile.religiousPractice}
                      </Badge>
                    )}
                    {currentProfile.prayerFrequency && (
                      <Badge variant="outline" className="bg-primary/10 border-primary/30">
                        {t('profile.prays')} {String(currentProfile.prayerFrequency).toLowerCase()}
                      </Badge>
                    )}
                    {currentProfile.bornMuslim !== null && currentProfile.bornMuslim !== undefined && (
                      <Badge variant="outline" className="bg-primary/10 border-primary/30">
                        {currentProfile.bornMuslim ? t('profile.bornMuslim') : t('profile.revert')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-card via-card to-transparent pt-8">
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setIsProfileExpanded(false);
                    handleSwipe("left");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('discover.pass')}
                </Button>
                <Button 
                  className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                  onClick={() => {
                    setIsProfileExpanded(false);
                    handleSwipe("right");
                  }}
                >
                  <Heart className="h-4 w-4 mr-2" fill="currentColor" />
                  {t('discover.like')}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
