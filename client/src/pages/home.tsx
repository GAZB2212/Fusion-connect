import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, X, MapPin, Play, ChevronLeft, ChevronRight, ShieldCheck, Users, Sparkles } from "lucide-react";
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

  const { data: profiles = [], isLoading } = useQuery<ProfileWithUser[]>({
    queryKey: ["/api/discover"],
  });

  const { data: subscriptionStatus } = useQuery<{ hasActiveSubscription: boolean }>({
    queryKey: ["/api/subscription-status"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const swipeMutation = useMutation<{ success: boolean; isMatch: boolean }, Error, { profileId: string; direction: "right" | "left" }>({
    mutationFn: async ({ profileId, direction }) => {
      const result = await apiRequest("POST", "/api/swipe", { swipedId: profileId, direction });
      return result as unknown as { success: boolean; isMatch: boolean };
    },
    onSuccess: (data, variables) => {
      if (data.isMatch) {
        toast({
          title: "It's a Match!",
          description: "You both liked each other! Start a conversation now.",
        });
      } else if (variables.direction === "right" && !subscriptionStatus?.hasActiveSubscription) {
        setShowSubscribeDialog(true);
      }
      setCurrentIndex((prev) => prev + 1);
      setCurrentPhotoIndex(0);
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
              className="fixed inset-0 bg-primary/20 backdrop-blur-sm pointer-events-none z-50"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.8 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
            >
              <Heart className="h-48 w-48 text-primary fill-primary filter drop-shadow-[0_0_60px_rgba(212,175,55,0.9)]" />
            </motion.div>
          </>
        )}
        {showAnimation === 'pass' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-md pointer-events-none z-50"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.8 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
            >
              <X className="h-48 w-48 text-white filter drop-shadow-[0_0_60px_rgba(255,255,255,0.8)]" strokeWidth={3} />
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
            {currentProfile.chaperoneId && (
              <Badge className="bg-primary/90 text-primary-foreground border-0 gap-1.5 px-2.5 py-1">
                <Users className="h-3.5 w-3.5" />
                Wali Connected
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
                {currentProfile.prayerFrequency}
              </Badge>
            )}
          </div>

          {/* Bio */}
          {currentProfile.bio && (
            <p className="text-base leading-relaxed text-white/90 line-clamp-2 mb-2">
              {currentProfile.bio}
            </p>
          )}
        </div>

        {/* Action Buttons - Floating */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-6 z-20">
          <Button
            size="icon"
            className="h-16 w-16 rounded-full bg-white shadow-2xl hover:bg-gray-100 active:scale-90 transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              handleSwipe("left");
            }}
            data-testid="button-pass"
          >
            <X className="h-8 w-8 text-gray-600" strokeWidth={2.5} />
          </Button>
          <Button
            size="icon"
            className="h-20 w-20 rounded-full bg-primary shadow-2xl hover:bg-primary/90 active:scale-90 transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              handleSwipe("right");
            }}
            data-testid="button-like"
          >
            <Heart className="h-10 w-10 text-primary-foreground" fill="currentColor" />
          </Button>
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
    </div>
  );
}
