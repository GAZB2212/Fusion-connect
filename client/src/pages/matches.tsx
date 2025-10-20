import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, MapPin, CheckCircle2, Heart } from "lucide-react";
import type { MatchWithProfiles } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

export default function Matches() {
  const [, setLocation] = useLocation();
  
  const { data: matches = [], isLoading } = useQuery<MatchWithProfiles[]>({
    queryKey: ["/api/matches"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Matches</h1>
          <p className="text-muted-foreground">
            {matches.length} {matches.length === 1 ? 'person' : 'people'} you both liked
          </p>
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Heart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Matches Yet</h2>
            <p className="text-muted-foreground mb-6">
              Keep swiping to find your perfect match!
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-start-swiping">
              Start Swiping
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {matches.map((match) => {
              // Determine which profile is the other user
              const otherProfile = match.user1Profile.userId === match.user1Id 
                ? match.user2Profile 
                : match.user1Profile;
              
              const displayName = otherProfile.useNickname 
                ? otherProfile.displayName.split(' ')[0] 
                : otherProfile.displayName;

              return (
                <Card key={match.id} className="overflow-hidden hover-elevate" data-testid={`card-match-${match.id}`}>
                  <div className="relative aspect-[4/3] bg-muted">
                    {otherProfile.photos?.[0] ? (
                      <img
                        src={otherProfile.photos[0]}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl text-muted-foreground">
                          {displayName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold">{displayName}, {otherProfile.age}</h3>
                        {otherProfile.isVerified && (
                          <CheckCircle2 className="h-5 w-5 text-primary fill-primary" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{otherProfile.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {otherProfile.lookingFor}
                      </Badge>
                      {otherProfile.sect && (
                        <Badge variant="outline">
                          {otherProfile.sect}
                        </Badge>
                      )}
                    </div>

                    {otherProfile.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {otherProfile.bio}
                      </p>
                    )}

                    <Button
                      className="w-full"
                      onClick={() => setLocation(`/messages/${match.id}`)}
                      data-testid={`button-message-${match.id}`}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
