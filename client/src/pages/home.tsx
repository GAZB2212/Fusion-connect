import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, X, MapPin, Briefcase, GraduationCap, CheckCircle2, Info } from "lucide-react";
import type { ProfileWithUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch discover profiles
  const { data: profiles = [], isLoading } = useQuery<ProfileWithUser[]>({
    queryKey: ["/api/discover"],
  });

  // Swipe mutation
  const swipeMutation = useMutation<{ success: boolean; isMatch: boolean }, Error, { profileId: string; direction: "right" | "left" }>({
    mutationFn: async ({ profileId, direction }) => {
      const result = await apiRequest("POST", "/api/swipe", { swipedId: profileId, direction });
      return result as unknown as { success: boolean; isMatch: boolean };
    },
    onSuccess: (data) => {
      if (data.isMatch) {
        toast({
          title: "🎉 It's a Match!",
          description: "You both liked each other! Start a conversation now.",
        });
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
      swipeMutation.mutate({ profileId: currentProfile.userId, direction });
    }
  };

  const currentProfile = profiles[currentIndex];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-md mx-auto py-8 px-4">
          <Skeleton className="h-96 w-full rounded-2xl mb-4" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Heart className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No More Profiles</h2>
          <p className="text-muted-foreground mb-6">
            Check back later for more matches, or adjust your filters.
          </p>
          <Button asChild>
            <a href="/">Back to Home</a>
          </Button>
        </div>
      </div>
    );
  }

  const age = currentProfile.age;
  const photos = currentProfile.photos;
  const displayName = currentProfile.useNickname ? currentProfile.displayName.split(' ')[0] : currentProfile.displayName;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-md mx-auto py-8 px-4">
        {/* Profile Card */}
        <Card className="relative overflow-hidden rounded-2xl shadow-lg mb-6">
          {/* Photo */}
          <div className="relative aspect-[3/4] bg-muted">
            {photos && photos[0] ? (
              <img
                src={photos[0]}
                alt={displayName}
                className={`w-full h-full object-cover ${currentProfile.photoVisibility === 'blurred' ? 'blur-xl' : ''}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl text-muted-foreground">
                  {displayName.charAt(0)}
                </span>
              </div>
            )}
            
            {currentProfile.photoVisibility === 'blurred' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                <div className="bg-background/95 rounded-lg p-4 text-center max-w-xs mx-4">
                  <Info className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Photo Blurred for Privacy</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Will be revealed after matching
                  </p>
                </div>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-3xl font-bold">{displayName}, {age}</h2>
                {currentProfile.isVerified && (
                  <CheckCircle2 className="h-6 w-6 text-primary fill-primary" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm mb-3">
                <MapPin className="h-4 w-4" />
                <span>{currentProfile.location}</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {currentProfile.lookingFor}
                </Badge>
                {currentProfile.sect && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">
                    {currentProfile.sect}
                  </Badge>
                )}
                {currentProfile.prayerFrequency && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">
                    Prays {currentProfile.prayerFrequency}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="p-6 space-y-4">
            {currentProfile.bio && (
              <div>
                <h3 className="font-semibold mb-2">About Me</h3>
                <p className="text-muted-foreground">{currentProfile.bio}</p>
              </div>
            )}

            <div className="grid gap-3">
              {currentProfile.occupation && (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Occupation</div>
                    <div className="font-medium">{currentProfile.occupation}</div>
                  </div>
                </div>
              )}

              {currentProfile.education && (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Education</div>
                    <div className="font-medium">{currentProfile.education}</div>
                  </div>
                </div>
              )}
            </div>

            {currentProfile.religiosity && (
              <div>
                <h3 className="font-semibold mb-2">Faith & Values</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {currentProfile.religiosity}
                  </Badge>
                  {currentProfile.halalImportance && (
                    <Badge variant="outline">
                      Halal: {currentProfile.halalImportance}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6">
          <Button
            size="icon"
            variant="outline"
            className="h-16 w-16 rounded-full border-2"
            onClick={() => handleSwipe("left")}
            disabled={swipeMutation.isPending}
            data-testid="button-pass"
          >
            <X className="h-8 w-8 text-muted-foreground" />
          </Button>

          <Button
            size="icon"
            className="h-20 w-20 rounded-full"
            onClick={() => handleSwipe("right")}
            disabled={swipeMutation.isPending}
            data-testid="button-like"
          >
            <Heart className="h-10 w-10 fill-current" />
          </Button>
        </div>

        {/* Counter */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          {currentIndex + 1} of {profiles.length}
        </p>
      </div>
    </div>
  );
}
