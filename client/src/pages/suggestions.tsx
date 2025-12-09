import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Heart, X, Sparkles, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLocation } from "wouter";
import type { ProfileWithUser } from "@shared/schema";

interface SuggestionResult {
  profile: ProfileWithUser;
  compatibilityScore: number;
  matchReasons: string[];
}

export default function Suggestions() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [swipingId, setSwipingId] = useState<string | null>(null);

  const { data: suggestions, isLoading } = useQuery<SuggestionResult[]>({
    queryKey: ["/api/suggestions"],
  });

  const handleSwipe = async (profileId: string, direction: "right" | "left") => {
    setSwipingId(profileId);

    try {
      const response = await apiRequest("POST", "/api/swipe", {
        swipedId: profileId,
        direction,
      });

      const data = await response.json();

      if (data.isMatch) {
        toast({
          title: "It's a Match! 🎉",
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

      // Refetch suggestions
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
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-primary";
    return "text-[#F8F4E3]/70";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "outline";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-[#F8F4E3]/70">Finding your best matches...</p>
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] p-4">
        <Card className="bg-[#0A0E17] border-white/10 max-w-md">
          <CardContent className="p-8 text-center">
            <Sparkles className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold text-[#F8F4E3] mb-2">
              No Suggestions Yet
            </h2>
            <p className="text-[#F8F4E3]/70 mb-6">
              We're still reviewing profiles to find your best matches. Check back soon!
            </p>
            <Button onClick={() => setLocation("/discover")} data-testid="button-go-discover">
              Start Discovering
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-serif font-bold text-[#F8F4E3]">
              Curated For You
            </h1>
          </div>
          <p className="text-[#F8F4E3]/70">
            Potential matches carefully selected by our team based on your values and preferences
          </p>
        </div>

        {/* Suggestions Grid */}
        <div className="space-y-4">
          {suggestions.map((suggestion) => {
            const profile = suggestion.profile;
            const mainPhoto = profile.photos[profile.mainPhotoIndex || 0];
            const isSwiping = swipingId === profile.userId;

            return (
              <Card
                key={profile.id}
                className="bg-[#0A0E17]/80 border-white/10 backdrop-blur-sm overflow-hidden hover-elevate"
                data-testid={`suggestion-card-${profile.userId}`}
              >
                <CardContent className="p-0">
                  <div className="md:flex">
                    {/* Photo Section */}
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
                            {profile.displayName.charAt(0)}
                          </span>
                        </div>
                        
                        {/* Compatibility Score Badge */}
                        <div className="absolute top-3 left-3">
                          <Badge
                            variant={getScoreBadgeVariant(suggestion.compatibilityScore)}
                            className="bg-black/60 backdrop-blur-sm border-primary/50"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {suggestion.compatibilityScore}% Match
                          </Badge>
                        </div>

                        {/* Verified Badge */}
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

                    {/* Info Section */}
                    <div className="md:w-2/3 p-6">
                      {/* Name & Basic Info */}
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

                      {/* Compatibility Score */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-3xl font-bold ${getScoreColor(suggestion.compatibilityScore)}`}>
                            {suggestion.compatibilityScore}%
                          </span>
                          <span className="text-[#F8F4E3]/70">Compatible</span>
                        </div>
                        <div className="w-full bg-[#0E1220] rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-primary to-emerald-500 h-2 rounded-full transition-all"
                            style={{ width: `${suggestion.compatibilityScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Match Reasons */}
                      {suggestion.matchReasons.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-sm font-semibold text-[#F8F4E3]/80 mb-2 flex items-center gap-1">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Why you might connect:
                          </h3>
                          <div className="space-y-2">
                            {suggestion.matchReasons.map((reason, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 text-sm text-[#F8F4E3]/70"
                              >
                                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bio Preview */}
                      {profile.bio && (
                        <div className="mb-6">
                          <p className="text-[#F8F4E3]/70 text-sm line-clamp-3">
                            {profile.bio}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => handleSwipe(profile.userId, "left")}
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
                          onClick={() => handleSwipe(profile.userId, "right")}
                          disabled={isSwiping}
                          className="flex-1 bg-gradient-to-r from-primary to-primary/80"
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
