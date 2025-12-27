import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, X, MapPin, Play, ChevronLeft, ChevronRight, ShieldCheck, Users, Sparkles, Moon, Star, User, Ruler, Briefcase, GraduationCap, Baby } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProfileWithUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { IOSSpinner } from "@/components/ios-spinner";
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

export default function Home() {
  const { user } = useAuth();
  const { toast } = useToast();
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
        toast({
          title: "It's a Match!",
          description: "You both liked each other! Opening conversation...",
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
      setIsProfileExpanded(false);
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
      setCurrentPhotoIndex((prev) => Math.max(0, prev - 1));
    } else if (x > (width * 2) / 3) {
      const maxIndex = (currentProfile?.photos?.length || 1) - 1;
      setCurrentPhotoIndex((prev) => Math.min(maxIndex, prev + 1));
    }
  };

  const currentProfile = profiles[currentIndex];

  if (isLoading) {
    return (
      <div className="fixed inset-0 bottom-16 flex items-center justify-center bg-background">
        <div className="text-center">
          <IOSSpinner size="lg" className="text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Finding profiles...</p>
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="fixed inset-0 bottom-16 flex items-center justify-center bg-background">
        <div className="text-center px-4">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
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
      {/* Swipe Animations */}
      <AnimatePresence>
        {showAnimation === 'like' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gradient-to-b from-primary/30 via-primary/20 to-primary/30 backdrop-blur-md pointer-events-none z-50"
            />
            {/* Decorative Stars */}
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
            {/* Main Heart with Crescent */}
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

      {/* Full Screen Profile Card */}
      <div 
        className="absolute inset-0 bottom-0"
        style={cardStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handlePhotoTap}
        data-testid="card-profile"
      >
        {/* Photo */}
        <div className="absolute inset-0">
          {currentPhoto ? (
            <motion.img
              key={currentPhotoIndex}
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              src={currentPhoto}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
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

        {/* Photo Navigation Dots */}
        {photos.length > 1 && (
          <div className="absolute top-4 left-4 right-4 flex gap-1 z-20" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
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

        {/* Photo Navigation Arrows (Desktop) */}
        {photos.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/20 backdrop-blur-sm text-white/80 hover:bg-black/40 transition-colors z-20 hidden md:flex"
              onClick={(e) => {
                e.stopPropagation();
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
                setCurrentPhotoIndex((prev) => Math.min(photos.length - 1, prev + 1));
              }}
              disabled={currentPhotoIndex === photos.length - 1}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Video Intro Button */}
        {currentProfile.introVideoUrl && (
          <div className="absolute top-16 right-4 z-20" style={{ top: 'calc(env(safe-area-inset-top) + 2rem)' }}>
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

        {/* Swipe Indicators */}
        <AnimatePresence>
          {isDragging && dragOffset.x > 50 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: -15 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-24 left-6 bg-primary text-primary-foreground px-8 py-4 rounded-lg font-bold text-2xl shadow-2xl z-30"
              style={{ top: 'calc(env(safe-area-inset-top) + 4rem)' }}
            >
              LIKE
            </motion.div>
          )}
          {isDragging && dragOffset.x < -50 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotate: 20 }}
              animate={{ opacity: 1, scale: 1, rotate: 15 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-24 right-6 bg-white text-black px-8 py-4 rounded-lg font-bold text-2xl shadow-2xl z-30"
              style={{ top: 'calc(env(safe-area-inset-top) + 4rem)' }}
            >
              PASS
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />

        {/* Profile Info Overlay */}
        <div className="absolute bottom-24 left-0 right-0 px-5 text-white z-10">
          {/* Verification Badges */}
          <div className="flex items-center gap-2 mb-3">
            {currentProfile.isVerified && (
              <Badge className="bg-emerald-500/90 text-white border-0 gap-1.5 px-2.5 py-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified
              </Badge>
            )}
            {currentProfile.waliInvolvement && currentProfile.waliInvolvement !== 'not_needed' && (
              <Badge className="bg-primary/90 text-primary-foreground border-0 gap-1.5 px-2.5 py-1">
                <Users className="h-3.5 w-3.5" />
                Wali Involved
              </Badge>
            )}
            {currentProfile.lookingFor === "Marriage" && (
              <Badge className="bg-rose-500/90 text-white border-0 gap-1.5 px-2.5 py-1">
                <Sparkles className="h-3.5 w-3.5" />
                Nikkah Ready
              </Badge>
            )}
          </div>

          {/* Name and Age */}
          <h2 className="text-4xl font-bold mb-2 drop-shadow-lg">{displayName}, {age}</h2>
          
          {/* Location and Profession */}
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

          {/* Religious Info Badges */}
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

          {/* Islamic Profile Prompt */}
          {currentProfile.profilePrompts && (currentProfile.profilePrompts as ProfilePromptAnswer[]).length > 0 && (
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

          {/* Bio */}
          {currentProfile.bio && !currentProfile.profilePrompts && (
            <p className="text-base leading-relaxed text-white/90 line-clamp-2 mb-2">
              {currentProfile.bio}
            </p>
          )}
        </div>

        {/* Premium Action Buttons */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6 z-20">
          {/* Pass Button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            className="group relative h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg flex items-center justify-center transition-all duration-300 hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              handleSwipe("left");
            }}
            data-testid="button-pass"
          >
            <X className="h-6 w-6 text-white/80 group-hover:text-white transition-colors" strokeWidth={2} />
          </motion.button>

          {/* View Profile Button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            className="group relative h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg flex items-center justify-center transition-all duration-300 hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setIsProfileExpanded(!isProfileExpanded);
            }}
            data-testid="button-view-profile"
          >
            <User className="h-6 w-6 text-white/80 group-hover:text-white transition-colors" />
          </motion.button>

          {/* Like Button - Premium gold accent */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            className="group relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 shadow-[0_8px_32px_rgba(212,175,55,0.4)] flex items-center justify-center transition-all duration-300"
            onClick={(e) => {
              e.stopPropagation();
              handleSwipe("right");
            }}
            data-testid="button-like"
          >
            <Heart className="h-6 w-6 text-primary-foreground" fill="currentColor" />
            <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </motion.button>
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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl font-bold">
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

      {/* Expanded Profile Sheet - slides up from bottom */}
      <AnimatePresence>
        {isProfileExpanded && currentProfile && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 top-[35%] bg-card rounded-t-3xl z-50 shadow-2xl"
          >
            {/* Handle bar */}
            <div 
              className="flex justify-center pt-3 pb-2 cursor-pointer"
              onClick={() => setIsProfileExpanded(false)}
            >
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
            
            <ScrollArea className="h-[calc(100%-60px)] px-5">
              <div className="pb-32">
                {/* Name and verification */}
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-2xl font-bold">{displayName}, {age}</h2>
                  {currentProfile.isVerified && (
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  )}
                </div>

                {/* Location */}
                {currentProfile.location && (
                  <p className="flex items-center gap-1 text-muted-foreground mb-4">
                    <MapPin className="h-4 w-4" />
                    {currentProfile.location}
                  </p>
                )}

                {/* Bio */}
                {currentProfile.bio && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">About Me</h3>
                    <p className="text-foreground">{currentProfile.bio}</p>
                  </div>
                )}

                {/* Profile Prompts */}
                {currentProfile.profilePrompts && (currentProfile.profilePrompts as ProfilePromptAnswer[]).length > 0 && (
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

                {/* Basic Info */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Basic Info</h3>
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
                        <span>{currentProfile.hasChildren ? 'Has children' : 'No children'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Religious Info */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Religious Background</h3>
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
                        Prays {String(currentProfile.prayerFrequency).toLowerCase()}
                      </Badge>
                    )}
                    {currentProfile.bornMuslim !== null && currentProfile.bornMuslim !== undefined && (
                      <Badge variant="outline" className="bg-primary/10 border-primary/30">
                        {currentProfile.bornMuslim ? 'Born Muslim' : 'Revert'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Fixed Action Buttons at bottom */}
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
                  Pass
                </Button>
                <Button 
                  className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                  onClick={() => {
                    setIsProfileExpanded(false);
                    handleSwipe("right");
                  }}
                >
                  <Heart className="h-4 w-4 mr-2" fill="currentColor" />
                  Like
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
