import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, X, MapPin, ArrowLeft, ChevronLeft, ChevronRight, ShieldCheck, Users, Sparkles, Moon, Star, Loader2, Info, Clock, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProfileWithUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
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

export default function Curated() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showAnimation, setShowAnimation] = useState<'like' | 'pass' | null>(null);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState<string>("");
  
  const cardRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery<SuggestionsResponse>({
    queryKey: ["/api/suggestions"],
  });

  const picks = data?.picks || [];
  const remainingPicks = picks.filter(p => !p.userAction);

  useEffect(() => {
    if (!data?.resetTime) return;

    const updateCountdown = () => {
      const now = new Date();
      const reset = new Date(data.resetTime);
      const diff = reset.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilReset(t('curated.refreshing', 'Refreshing...'));
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

  const swipeMutation = useMutation({
    mutationFn: async ({ pick, direction }: { pick: ForYouPick; direction: "right" | "left" }) => {
      if (pick.id) {
        await apiRequest("POST", `/api/suggestions/${pick.id}/action`, {
          action: direction === "right" ? "liked" : "passed",
        });
      }

      const response = await apiRequest("POST", "/api/swipe", {
        swipedId: pick.profile.userId,
        direction,
      });

      return response.json();
    },
    onSuccess: (data) => {
      if (data.isMatch) {
        haptic.success();
        toast({
          title: t('discover.itsAMatch'),
          description: t('discover.matchNotification'),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
        setTimeout(() => {
          setLocation(`/messages/${data.matchId}`);
        }, 1200);
      }
      setCurrentIndex((prev) => prev + 1);
      setCurrentPhotoIndex(0);
      setImageLoadError(false);
      setIsProfileExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/likes"] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const currentPick = remainingPicks[currentIndex];
  const currentProfile = currentPick?.profile;

  const handleSwipe = (direction: "right" | "left") => {
    if (currentPick) {
      haptic.medium();
      setShowAnimation(direction === "right" ? 'like' : 'pass');
      setTimeout(() => setShowAnimation(null), 800);
      swipeMutation.mutate({ pick: currentPick, direction });
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
    if (isDragging || !currentProfile) return;
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

  if (!currentProfile || remainingPicks.length === 0) {
    const viewedCount = picks.length - remainingPicks.length;
    
    return (
      <div className="fixed inset-0 bottom-16 bg-background flex flex-col">
        <header 
          className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/50"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <div className="px-4 pb-3">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-1 text-primary mb-2 -ml-1 active:scale-95 transition-transform"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[17px]">{t('common.back', 'Back')}</span>
            </button>
            <h1 className="text-2xl font-bold text-foreground">
              {t('curated.title', 'Curated Matches')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('curated.subtitle', 'Based on your values and preferences')}
            </p>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="h-24 w-24 rounded-full bg-[#f59e0b]/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-12 w-12 text-[#f59e0b]" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-center">
            {t('curated.allViewed', 'All done for today!')}
          </h2>
          <p className="text-muted-foreground mb-4 text-center max-w-sm">
            {t('curated.viewedCount', "You've viewed all {{count}} curated matches for today.", { count: viewedCount })}
          </p>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Clock className="h-4 w-4" />
            <span>{t('curated.newMatchesIn', 'New matches in')} {timeUntilReset}</span>
          </div>

          <Button onClick={() => setLocation("/")} data-testid="button-back-to-discover">
            <Sparkles className="h-4 w-4 mr-2" />
            {t('curated.backToDiscover', 'Back to Discover')}
          </Button>
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
    <div className="fixed inset-0 bottom-16 bg-background overflow-hidden">
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

      <div 
        className="absolute z-40 w-full px-4"
        style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-[#f59e0b]" />
            <span className="text-sm font-medium text-white">
              {remainingPicks.length} {t('curated.remaining', 'remaining')}
            </span>
          </div>
        </div>
      </div>

      {currentPick && (
        <div 
          className="absolute z-30 left-1/2 -translate-x-1/2"
          style={{ top: 'calc(env(safe-area-inset-top) + 60px)' }}
        >
          <Badge className="bg-[#f59e0b]/90 text-white border-0 gap-1.5 px-3 py-1.5 text-sm font-semibold shadow-lg">
            <Star className="h-4 w-4 fill-white" />
            {currentPick.compatibilityScore}% {t('curated.compatible', 'Compatible')}
          </Badge>
        </div>
      )}

      <div 
        ref={cardRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
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
              onError={() => setImageLoadError(true)}
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
          <div className="absolute left-4 right-4 flex gap-1 z-20" style={{ top: 'calc(env(safe-area-inset-top) + 100px)' }}>
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

        <AnimatePresence>
          {isDragging && dragOffset.x > 50 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: -15 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-32 left-6 bg-primary text-primary-foreground px-8 py-4 rounded-lg font-bold text-2xl shadow-2xl z-30"
            >
              LIKE
            </motion.div>
          )}
          {isDragging && dragOffset.x < -50 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotate: 20 }}
              animate={{ opacity: 1, scale: 1, rotate: 15 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-32 right-6 bg-white text-black px-8 py-4 rounded-lg font-bold text-2xl shadow-2xl z-30"
            >
              PASS
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />

        <div className="absolute bottom-40 left-0 right-0 px-5 text-white z-10">
          {currentPick.matchReasons && currentPick.matchReasons.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {currentPick.matchReasons.slice(0, 3).map((reason, idx) => (
                <Badge key={idx} className="bg-[#f59e0b]/80 text-white border-0 text-xs">
                  {reason}
                </Badge>
              ))}
            </div>
          )}

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
          </div>

          {currentProfile.bio && (
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
              <div className="pb-32 px-5">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-2xl font-bold">{displayName}, {age}</h2>
                  {currentProfile.isVerified && (
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  )}
                </div>

                {currentPick.matchReasons && currentPick.matchReasons.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                      {t('curated.whyMatched', 'Why you matched')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {currentPick.matchReasons.map((reason, idx) => (
                        <Badge key={idx} className="bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {currentProfile.location && (
                  <p className="flex items-center gap-1 text-muted-foreground mb-4">
                    <MapPin className="h-4 w-4" />
                    {currentProfile.location}
                  </p>
                )}

                {currentProfile.bio && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('discover.aboutMe')}</h3>
                    <p className="text-foreground">{currentProfile.bio}</p>
                  </div>
                )}

                {currentProfile.profilePrompts && Array.isArray(currentProfile.profilePrompts) && (currentProfile.profilePrompts as ProfilePromptAnswer[]).length > 0 && (
                  <div className="space-y-3 mb-6">
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

                <div className="mb-6">
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
                  className="flex-1 bg-gradient-to-r from-[#f59e0b] to-[#d97706]"
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
