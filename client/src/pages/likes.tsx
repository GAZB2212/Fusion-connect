import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Sparkles,
  Clock,
  Users,
  Wifi
} from "lucide-react";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useTranslation } from "react-i18next";
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

type FilterType = 'recent' | 'nearby' | 'compatible' | 'online';

export default function Likes() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterType>('recent');

  const { data, isLoading, refetch } = useQuery<LikesResponse>({
    queryKey: ["/api/likes"],
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const rawLikes = data?.likes || [];
  const hasActiveSubscription = data?.hasActiveSubscription || false;
  
  const likes = rawLikes.filter((like, index, self) => 
    index === self.findIndex((l) => l.profile.userId === like.profile.userId)
  );

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

  const filters: { id: FilterType; label: string; icon: React.ReactNode }[] = [
    { id: 'recent', label: t('likes.filterRecent', 'Recent'), icon: <Clock className="h-3 w-3" /> },
    { id: 'nearby', label: t('likes.filterNearby', 'Nearby'), icon: <MapPin className="h-3 w-3" /> },
    { id: 'compatible', label: t('likes.filterCompatible', 'Compatible'), icon: <Heart className="h-3 w-3" /> },
    { id: 'online', label: t('likes.filterOnline', 'Online'), icon: <Wifi className="h-3 w-3" /> },
  ];

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
      <div className="min-h-screen bg-muted/30" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}>
        <header 
          className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/50"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-foreground">
                {t('likes.title', 'Likes You')}
              </h1>
              {likes.length > 0 && (
                <Badge className="bg-primary/10 text-primary border-0 gap-1.5 px-3 py-1">
                  <Heart className="h-3 w-3 fill-primary" />
                  {likes.length}
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                    activeFilter === filter.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  data-testid={`button-filter-${filter.id}`}
                >
                  {filter.icon}
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="px-4 pt-4">
          {!hasActiveSubscription && likes.length > 0 && (
            <div 
              className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#0A1628] to-[#1a2744] relative overflow-hidden shadow-lg cursor-pointer"
              onClick={() => setLocation("/subscribe")}
              data-testid="card-premium-banner"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#f59e0b] rounded-full blur-3xl opacity-20 -mr-10 -mt-10" />
              <div className="relative z-10 flex flex-col items-start">
                <Badge className="bg-[#f59e0b] text-white border-0 text-[10px] font-bold px-2 py-0.5 mb-2">
                  PREMIUM
                </Badge>
                <h3 className="font-bold text-lg text-white leading-tight mb-1">
                  {t('likes.seeWhoLikes', 'See who likes you')}
                </h3>
                <p className="text-white/60 text-xs mb-3">
                  {t('likes.upgradeToUnblur', 'Upgrade to Premium to unblur photos and match instantly.')}
                </p>
                <Button 
                  size="sm" 
                  className="bg-white text-[#0A1628] hover:bg-white/90 font-bold"
                  data-testid="button-upgrade-banner"
                >
                  <Crown className="h-4 w-4 mr-1.5 text-[#f59e0b]" />
                  {t('likes.upgradeNow', 'Upgrade Now')}
                </Button>
              </div>
            </div>
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
            <>
              <div className="grid grid-cols-2 gap-3 pb-8">
                {likes.map((like, index) => (
                  <LikeCard
                    key={like.swipeId}
                    profile={like.profile}
                    isBlurred={!hasActiveSubscription}
                    isNew={index < 2}
                    onClick={() => handleCardClick(like.profile.userId)}
                  />
                ))}
              </div>

              {!hasActiveSubscription && likes.length > 0 && (
                <div className="fixed bottom-16 left-0 right-0 z-20 pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                  <div className="h-32 bg-gradient-to-t from-background via-background/90 to-transparent flex flex-col items-center justify-end pb-4 px-6 pointer-events-auto">
                    <Button 
                      size="lg"
                      className="w-full max-w-sm bg-gradient-to-r from-[#f59e0b] to-[#d97706] hover:from-[#d97706] hover:to-[#b45309] text-white font-bold shadow-lg"
                      onClick={() => setLocation("/subscribe")}
                      data-testid="button-unlock-all"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      {t('likes.unlockAllLikes', 'Unlock All Likes')}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('likes.startingFrom', 'Starting from £9.99/month')}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </PullToRefresh>
  );
}

interface LikeCardProps {
  profile: Profile;
  isBlurred: boolean;
  isNew?: boolean;
  onClick: () => void;
}

function LikeCard({ profile, isBlurred, isNew, onClick }: LikeCardProps) {
  const mainPhoto = profile.photos?.[profile.mainPhotoIndex || 0] || profile.photos?.[0];
  
  return (
    <div 
      className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-card shadow-sm cursor-pointer hover-elevate active-elevate-2"
      onClick={onClick}
      data-testid={`card-like-${profile.userId}`}
    >
      <div className="absolute inset-0 bg-muted">
        {mainPhoto ? (
          <img
            src={mainPhoto}
            alt={profile.displayName}
            className={`w-full h-full object-cover transition-all duration-300 ${
              isBlurred ? 'blur-xl scale-110' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Heart className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
      </div>
      
      <div className="absolute inset-0 bg-black/10" />

      {isBlurred && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-2">
            <Lock className="h-5 w-5 text-white" />
          </div>
        </div>
      )}

      {isNew && (
        <div className="absolute top-2 right-2">
          <Badge className="bg-[#f59e0b] text-white border-0 text-[10px] font-bold px-2 py-0.5">
            NEW
          </Badge>
        </div>
      )}

      <div className="absolute bottom-0 w-full p-3 bg-gradient-to-t from-black/70 to-transparent">
        {isBlurred ? (
          <>
            <div className="h-4 w-16 bg-white/50 rounded mb-1 backdrop-blur-sm" />
            <div className="h-3 w-24 bg-white/30 rounded backdrop-blur-sm" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-1 mb-0.5">
              <h3 className="font-semibold text-white text-base truncate">
                {profile.displayName}
              </h3>
              {profile.age && (
                <span className="text-white/90 text-base">, {profile.age}</span>
              )}
              {profile.faceVerified && (
                <CheckCircle2 className="h-3.5 w-3.5 text-[#f59e0b] flex-shrink-0" />
              )}
            </div>
            {profile.location && (
              <div className="flex items-center gap-1 text-white/70 text-xs">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{profile.location}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
