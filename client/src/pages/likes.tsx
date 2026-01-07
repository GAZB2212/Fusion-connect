import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, 
  Crown, 
  Lock, 
  MapPin, 
  CheckCircle2,
  Loader2,
  Sparkles
} from "lucide-react";
import { IOSHeader } from "@/components/ios-header";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from "@shared/schema";

interface LikeData {
  swipeId: string;
  swipedAt: string;
  profile: Profile;
}

interface LikesResponse {
  likes: LikeData[];
  count: number;
  hasActiveSubscription: boolean;
}

export default function Likes() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<LikesResponse>({
    queryKey: ["/api/likes"],
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const likes = data?.likes || [];
  const hasActiveSubscription = data?.hasActiveSubscription || false;

  const handleRefresh = async () => {
    await refetch();
  };

  const handleCardClick = (userId: string) => {
    if (hasActiveSubscription) {
      setLocation(`/profile/${userId}`);
    } else {
      setLocation("/subscribe");
    }
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

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}>
        <IOSHeader 
          title={t('likes.title', 'Likes You')}
          subtitle={likes.length > 0 ? t('likes.subtitle', '{{count}} people like you', { count: likes.length }) : undefined}
        />

        <div className="px-4 py-4">
          {!hasActiveSubscription && likes.length > 0 && (
            <Card 
              className="mb-6 p-4 bg-gradient-to-r from-[#f59e0b]/20 to-[#f59e0b]/10 border-[#f59e0b]/30 cursor-pointer hover-elevate"
              onClick={() => setLocation("/subscribe")}
              data-testid="card-premium-upsell"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[#f59e0b]/20 flex items-center justify-center flex-shrink-0">
                  <Crown className="h-6 w-6 text-[#f59e0b]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {t('likes.upgradeTitle', 'Upgrade to see who likes you')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('likes.upgradeDesc', '£9.99/month • See clear photos and connect')}
                  </p>
                </div>
                <Button size="sm" className="flex-shrink-0" data-testid="button-upgrade-now">
                  {t('likes.upgradeNow', 'Upgrade')}
                </Button>
              </div>
            </Card>
          )}

          {likes.length === 0 ? (
            <div className="text-center py-16">
              <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
                <Heart className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {t('likes.noLikesTitle', 'No likes yet')}
              </h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                {t('likes.noLikesDesc', 'Keep swiping to find your match! When someone likes you, they\'ll appear here.')}
              </p>
              <Button 
                className="mt-6" 
                onClick={() => setLocation("/")}
                data-testid="button-start-swiping"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {t('likes.startSwiping', 'Start Swiping')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {likes.map((like) => (
                <LikeCard
                  key={like.swipeId}
                  profile={like.profile}
                  isBlurred={!hasActiveSubscription}
                  onClick={() => handleCardClick(like.profile.userId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

interface LikeCardProps {
  profile: Profile;
  isBlurred: boolean;
  onClick: () => void;
}

function LikeCard({ profile, isBlurred, onClick }: LikeCardProps) {
  const mainPhoto = profile.photos?.[profile.mainPhotoIndex || 0] || profile.photos?.[0];
  
  return (
    <Card 
      className="relative overflow-hidden cursor-pointer hover-elevate active-elevate-2 group"
      onClick={onClick}
      data-testid={`card-like-${profile.userId}`}
    >
      <div className="aspect-[3/4] relative">
        {mainPhoto ? (
          <img
            src={mainPhoto}
            alt={profile.displayName}
            className={`w-full h-full object-cover transition-all duration-300 ${
              isBlurred ? 'blur-2xl scale-110' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Heart className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {isBlurred && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <Lock className="h-8 w-8 text-white" />
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-center gap-1 mb-1">
            <h3 className="font-semibold text-white text-lg truncate">
              {profile.displayName}
            </h3>
            {profile.age && (
              <span className="text-white/90 text-lg">, {profile.age}</span>
            )}
            {profile.faceVerified && (
              <CheckCircle2 className="h-4 w-4 text-[#f59e0b] flex-shrink-0" />
            )}
          </div>
          {profile.location && (
            <div className="flex items-center gap-1 text-white/70 text-sm">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{profile.location}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
