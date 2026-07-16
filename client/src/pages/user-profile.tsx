import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Heart, 
  X, 
  ChevronLeft,
  ChevronRight,
  MapPin, 
  CheckCircle2,
  Loader2,
  GraduationCap,
  Briefcase,
  Moon,
  Users,
  Sparkles,
  Play,
  Crown,
  Lock
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";
import type { Profile } from "@shared/schema";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/video-recorder";

interface ProfileResponse {
  profile: Profile;
  hasActiveSubscription: boolean;
}

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const { data, isLoading, error } = useQuery<ProfileResponse>({
    queryKey: ["/api/users", userId, "profile"],
    enabled: !!userId,
    retry: false,
  });

  const profile = data?.profile;
  const hasActiveSubscription = data?.hasActiveSubscription || false;

  const swipeMutation = useMutation({
    mutationFn: async ({ direction }: { direction: 'left' | 'right' }) => {
      return apiRequest("POST", "/api/swipe", {
        swipedId: userId,
        direction,
      });
    },
    onSuccess: async (response, { direction }) => {
      haptic.success();
      queryClient.invalidateQueries({ queryKey: ["/api/likes"] });
      
      const data = await response.json();
      
      if (direction === 'right' && data.isMatch) {
        toast({
          title: t('likes.itsAMatch', "It's a Match!"),
          description: t('likes.matchDesc', 'You can now message each other'),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
        setLocation("/matches");
      } else {
        setLocation("/likes");
      }
    },
    onError: (error: any) => {
      toast({
        title: t('common.error', 'Error'),
        description: error.message || t('likes.swipeFailed', 'Failed to process'),
        variant: "destructive",
      });
    },
  });

  const handleLike = () => {
    haptic.medium();
    swipeMutation.mutate({ direction: 'right' });
  };

  const handlePass = () => {
    haptic.light();
    swipeMutation.mutate({ direction: 'left' });
  };

  const handleBack = () => {
    setLocation("/likes");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{t('likes.profileNotFound', 'Profile not found')}</p>
          <Button onClick={handleBack} data-testid="button-go-back">
            {t('common.goBack', 'Go Back')}
          </Button>
        </div>
      </div>
    );
  }

  const photos = profile.photos || [];
  const currentPhoto = photos[currentPhotoIndex];

  return (
    <div className="min-h-screen pb-32 bg-background">
      <div className="relative">
        <div className="aspect-[3/4] max-h-[70vh] relative overflow-hidden">
          <AnimatePresence mode="wait">
            {currentPhoto && (
              <motion.img
                key={currentPhotoIndex}
                src={currentPhoto}
                alt={profile.displayName}
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

          <button
            onClick={handleBack}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white z-10"
            style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          {photos.length > 1 && (
            <div 
              className="absolute top-4 left-0 right-0 flex justify-center gap-1 px-16 z-10"
              style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
            >
              {photos.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    idx === currentPhotoIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}

          {photos.length > 1 && (
            <>
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/20 backdrop-blur-sm text-white/80"
                onClick={() => setCurrentPhotoIndex(prev => Math.max(0, prev - 1))}
                disabled={currentPhotoIndex === 0}
                data-testid="button-prev-photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/20 backdrop-blur-sm text-white/80"
                onClick={() => setCurrentPhotoIndex(prev => Math.min(photos.length - 1, prev + 1))}
                disabled={currentPhotoIndex === photos.length - 1}
                data-testid="button-next-photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {profile.introVideoUrl && (
            <Button
              size="icon"
              className="absolute top-16 right-4 h-12 w-12 rounded-full bg-white/90 hover:bg-white shadow-xl"
              onClick={() => setShowVideoModal(true)}
              style={{ top: 'calc(env(safe-area-inset-top) + 4rem)' }}
              data-testid="button-play-video"
            >
              <Play className="h-5 w-5 text-primary fill-primary" />
            </Button>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-white">
                {profile.displayName}
              </h1>
              {profile.age && (
                <span className="text-3xl text-white/90">{profile.age}</span>
              )}
              {profile.faceVerified && (
                <CheckCircle2 className="h-6 w-6 text-[#f59e0b]" />
              )}
            </div>
            {profile.location && (
              <div className="flex items-center gap-1 text-white/80">
                <MapPin className="h-4 w-4" />
                <span>{profile.location}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-6 space-y-6">
          {profile.bio && (
            <div>
              <h2 className="text-lg font-semibold mb-2">{t('profile.aboutMe', 'About Me')}</h2>
              <p className="text-muted-foreground">{profile.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {profile.occupation && (
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{profile.occupation}</span>
                </div>
              </Card>
            )}
            {profile.education && (
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{profile.education}</span>
                </div>
              </Card>
            )}
            {profile.religiousPractice && (
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{profile.religiousPractice}</span>
                </div>
              </Card>
            )}
            {profile.sect && (
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{profile.sect}</span>
                </div>
              </Card>
            )}
          </div>

          {profile.interests && (profile.interests as string[]).length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">{t('profile.interests', 'Interests')}</h2>
              <div className="flex flex-wrap gap-2">
                {(profile.interests as string[]).map((interest, idx) => (
                  <Badge key={idx} variant="secondary" className="px-3 py-1">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(profile.profilePrompts) && (profile.profilePrompts as Array<{ promptId: string; answer: string }>).length > 0 && (
            <div className="space-y-4">
              {(profile.profilePrompts as Array<{ promptId: string; answer: string }>).map((prompt, idx) => (
                <Card key={idx} className="p-4">
                  <p className="text-sm text-muted-foreground mb-2">{prompt.promptId}</p>
                  <p className="font-medium">{prompt.answer}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <div 
        className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <div className="flex items-center justify-center gap-6 max-w-md mx-auto">
          <Button
            size="lg"
            variant="outline"
            className="h-16 w-16 rounded-full border-2 border-muted-foreground/30"
            onClick={handlePass}
            disabled={swipeMutation.isPending}
            data-testid="button-pass"
          >
            <X className="h-8 w-8 text-muted-foreground" />
          </Button>
          
          <Button
            size="lg"
            className="h-20 w-20 rounded-full bg-[#f59e0b] hover:bg-[#f59e0b]/90 shadow-lg"
            onClick={handleLike}
            disabled={swipeMutation.isPending}
            data-testid="button-like"
          >
            {swipeMutation.isPending ? (
              <Loader2 className="h-10 w-10 text-white animate-spin" />
            ) : (
              <Heart className="h-10 w-10 text-white fill-white" />
            )}
          </Button>
        </div>
      </div>

      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {profile.introVideoUrl && (
            <VideoPlayer
              videoUrl={profile.introVideoUrl}
              autoPlay={true}
              className="w-full aspect-[9/16] max-h-[80vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
