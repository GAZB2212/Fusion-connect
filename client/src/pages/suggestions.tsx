import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, X, Sparkles, CheckCircle2, Loader2, Clock, Crown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import type { ProfileWithUser } from "@shared/schema";
import { IOSHeader } from "@/components/ios-header";
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

export default function Suggestions() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [timeUntilReset, setTimeUntilReset] = useState<string>("");

  const { data, isLoading, isError } = useQuery<SuggestionsResponse>({
    queryKey: ["/api/suggestions"],
  });

  useEffect(() => {
    if (!data?.resetTime) return;

    const updateCountdown = () => {
      const now = new Date();
      const reset = new Date(data.resetTime);
      const diff = reset.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilReset("Refreshing...");
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
  }, [data?.resetTime]);

  const handleSwipe = async (pick: ForYouPick, direction: "right" | "left") => {
    setSwipingId(pick.profile.userId);
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
          title: "It's a Match!",
          description: "You both liked each other!",
        });
        setLocation("/matches");
      } else {
        toast({
          title: direction === "right" ? "Liked!" : "Passed",
          description:
            direction === "right"
              ? "We'll notify them if they like you back"
              : "Profile skipped",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to swipe",
        variant: "destructive",
      });
    } finally {
      setSwipingId(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-amber-400";
    if (score >= 70) return "text-emerald-400";
    if (score >= 50) return "text-primary";
    return "text-[#F8F4E3]/70";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 85) return "from-amber-500 via-yellow-400 to-amber-600";
    if (score >= 70) return "from-emerald-500 to-teal-400";
    return "from-primary to-primary/80";
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bottom-16 flex items-center justify-center bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220]">
        <div className="text-center">
          <div className="relative">
            <Sparkles className="h-12 w-12 text-amber-400 mx-auto mb-4 animate-pulse" />
            <div className="absolute inset-0 blur-xl bg-amber-400/20 rounded-full" />
          </div>
          <p className="text-[#F8F4E3]/70 font-serif">Curating your daily picks...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="fixed inset-0 bottom-16 flex items-center justify-center bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] p-4">
        <Card className="bg-gradient-to-br from-[#0A0E17] to-[#0E1220] border-red-500/20 max-w-md shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="relative inline-block mb-6">
              <X className="h-16 w-16 text-red-400 mx-auto" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#F8F4E3] mb-2">
              Unable to Load Picks
            </h2>
            <p className="text-[#F8F4E3]/70 mb-6">
              We couldn't load your personalized matches. Please try again.
            </p>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] })} 
              data-testid="button-retry-suggestions"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const picks = Array.isArray(data?.picks) ? data.picks : [];
  const remainingPicks = picks.filter(p => !p.userAction);

  if (!picks.length || remainingPicks.length === 0) {
    return (
      <div className="fixed inset-0 bottom-16 flex items-center justify-center bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] p-4">
        <Card className="bg-gradient-to-br from-[#0A0E17] to-[#0E1220] border-amber-500/20 max-w-md shadow-xl shadow-amber-500/5">
          <CardContent className="p-8 text-center">
            <div className="relative inline-block mb-6">
              <Crown className="h-16 w-16 text-amber-400 mx-auto" />
              <div className="absolute inset-0 blur-2xl bg-amber-400/30 rounded-full" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#F8F4E3] mb-2">
              Daily Picks Complete
            </h2>
            <p className="text-[#F8F4E3]/70 mb-4">
              You've reviewed all your curated matches for today.
            </p>
            {timeUntilReset && (
              <div className="flex items-center justify-center gap-2 text-amber-400 mb-6">
                <Clock className="h-5 w-5" />
                <span className="font-medium">New picks in {timeUntilReset}</span>
              </div>
            )}
            <Button onClick={() => setLocation("/")} data-testid="button-go-discover">
              Discover More Profiles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bottom-16 overflow-y-auto bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220]">
      <IOSHeader 
        title="For You"
        subtitle="AI-curated matches based on your values"
        rightElement={<Crown className="h-6 w-6 text-amber-400" />}
      />
      
      <div className="max-w-4xl mx-auto px-4 py-4 pb-8">
        <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Sparkles className="h-6 w-6 text-amber-400" />
              <div className="absolute inset-0 blur-lg bg-amber-400/30 rounded-full" />
            </div>
            <div>
              <p className="text-[#F8F4E3] font-medium">Today's Picks</p>
              <p className="text-[#F8F4E3]/60 text-sm">
                {remainingPicks.length} of {data?.dailyLimit} remaining
              </p>
            </div>
          </div>
          {timeUntilReset && (
            <div className="flex items-center gap-2 text-[#F8F4E3]/60 text-sm">
              <Clock className="h-4 w-4" />
              <span>Resets in {timeUntilReset}</span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {remainingPicks.map((pick) => {
            const profile = pick.profile;
            if (!profile) return null;
            const photos = Array.isArray(profile.photos) ? profile.photos : [];
            const mainPhoto = photos[profile.mainPhotoIndex || 0];
            const isSwiping = swipingId === profile.userId;
            const isHighMatch = (pick.compatibilityScore || 0) >= 85;

            return (
              <Card
                key={pick.id}
                className={`overflow-hidden hover-elevate transition-all duration-300 ${
                  isHighMatch 
                    ? "bg-gradient-to-br from-[#0A0E17] to-[#0E1220] border-amber-500/30 shadow-lg shadow-amber-500/10" 
                    : "bg-[#0A0E17]/80 border-white/10"
                }`}
                data-testid={`suggestion-card-${profile.userId}`}
              >
                {isHighMatch && (
                  <div className="bg-gradient-to-r from-amber-500/20 via-yellow-400/10 to-amber-500/20 px-4 py-2 border-b border-amber-500/20">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Crown className="h-4 w-4" />
                      <span className="text-sm font-medium">Exceptional Match</span>
                    </div>
                  </div>
                )}
                <CardContent className="p-0">
                  <div className="md:flex">
                    <div className="md:w-1/3 relative">
                      <div className="aspect-[3/4] md:aspect-square relative overflow-hidden">
                        {mainPhoto ? (
                          <img
                            src={mainPhoto}
                            alt={profile.displayName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="w-full h-full bg-[#0E1220] items-center justify-center" style={{ display: mainPhoto ? 'none' : 'flex' }}>
                          <span className="text-4xl text-[#F8F4E3]/30">
                            {profile?.displayName?.charAt(0) || '?'}
                          </span>
                        </div>
                        
                        <div className="absolute top-3 left-3">
                          <Badge
                            className={`backdrop-blur-sm border-0 ${
                              isHighMatch 
                                ? "bg-gradient-to-r from-amber-500/90 to-yellow-500/90 text-black font-medium" 
                                : "bg-black/60 border-primary/50"
                            }`}
                          >
                            {isHighMatch && <Crown className="h-3 w-3 mr-1" />}
                            <Sparkles className="h-3 w-3 mr-1" />
                            {pick.compatibilityScore}% Match
                          </Badge>
                        </div>

                        {profile.faceVerified && (
                          <div className="absolute top-3 right-3">
                            <Badge variant="default" className="bg-emerald-600/80 backdrop-blur-sm">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:w-2/3 p-6">
                      <div className="mb-4">
                        <h2 className="text-2xl font-serif font-bold text-[#F8F4E3] mb-1">
                          {profile.displayName}, {profile.age}
                        </h2>
                        <p className="text-[#F8F4E3]/70">
                          {profile.location}
                        </p>
                        {profile.profession && (
                          <p className="text-[#F8F4E3]/60 text-sm">
                            {profile.profession}
                          </p>
                        )}
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-3xl font-bold ${getScoreColor(pick.compatibilityScore)}`}>
                            {pick.compatibilityScore}%
                          </span>
                          <span className="text-[#F8F4E3]/70">Compatible</span>
                        </div>
                        <div className="w-full bg-[#0E1220] rounded-full h-2">
                          <div
                            className={`bg-gradient-to-r ${getScoreGradient(pick.compatibilityScore)} h-2 rounded-full transition-all`}
                            style={{ width: `${pick.compatibilityScore}%` }}
                          />
                        </div>
                      </div>

                      {Array.isArray(pick.matchReasons) && pick.matchReasons.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-sm font-semibold text-[#F8F4E3]/80 mb-2 flex items-center gap-1">
                            <Sparkles className={`h-4 w-4 ${isHighMatch ? "text-amber-400" : "text-primary"}`} />
                            Why you might connect:
                          </h3>
                          <div className="space-y-2">
                            {pick.matchReasons.map((reason, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 text-sm text-[#F8F4E3]/70"
                              >
                                <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isHighMatch ? "text-amber-400" : "text-primary"}`} />
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {profile.bio && (
                        <div className="mb-6">
                          <p className="text-[#F8F4E3]/70 text-sm line-clamp-3">
                            {profile.bio}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => handleSwipe(pick, "left")}
                          disabled={isSwiping}
                          className="flex-1"
                          data-testid={`button-pass-${profile.userId}`}
                        >
                          {isSwiping ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <X className="h-5 w-5 mr-2" />
                              Pass
                            </>
                          )}
                        </Button>
                        <Button
                          size="lg"
                          onClick={() => handleSwipe(pick, "right")}
                          disabled={isSwiping}
                          className={`flex-1 ${
                            isHighMatch 
                              ? "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black" 
                              : "bg-gradient-to-r from-primary to-primary/80"
                          }`}
                          data-testid={`button-like-${profile.userId}`}
                        >
                          {isSwiping ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <Heart className="h-5 w-5 mr-2" />
                              Like
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
