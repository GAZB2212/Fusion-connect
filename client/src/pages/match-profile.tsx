import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  MapPin, 
  CheckCircle2, 
  Heart, 
  Briefcase,
  GraduationCap,
  Languages,
  Ruler,
  MessageSquare,
  Baby,
  Users,
  Moon,
  BookOpen
} from "lucide-react";
import type { MatchWithProfiles } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

export default function MatchProfile() {
  const { matchId } = useParams<{ matchId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: matches = [], isLoading } = useQuery<MatchWithProfiles[]>({
    queryKey: ["/api/matches"],
  });

  const match = matches.find(m => String(m.id) === matchId);
  
  const profile = match && user?.id === match.user1Id 
    ? match.user2Profile 
    : match?.user1Profile;

  const displayName = profile?.useNickname 
    ? profile?.displayName?.split(' ')[0] 
    : profile?.displayName;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-4">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="aspect-[3/4] w-full mb-4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!match || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Match not found</h2>
          <Button onClick={() => setLocation("/matches")} data-testid="button-back-to-matches">
            Back to Matches
          </Button>
        </div>
      </div>
    );
  }

  const formatHeight = (height: number | null | undefined, unit: string | null | undefined) => {
    if (!height) return null;
    if (unit === 'ft') {
      const feet = Math.floor(height / 30.48);
      const inches = Math.round((height % 30.48) / 2.54);
      return `${feet}'${inches}"`;
    }
    return `${height} cm`;
  };

  return (
    <div className="min-h-screen bg-background pb-32 pt-14">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b p-3 flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setLocation("/matches")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{displayName}'s Profile</h1>
      </header>

      <div className="max-w-2xl mx-auto">
        {/* Photo Gallery */}
        <div className="p-4">
          {profile.photos && profile.photos.length > 0 ? (
            <div className="space-y-4">
              {profile.photos.map((photo, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="aspect-[4/5] bg-muted">
                    <img
                      src={photo}
                      alt={`${displayName} photo ${index + 1}`}
                      className="w-full h-full object-cover"
                      data-testid={`img-profile-photo-${index}`}
                    />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="aspect-[4/5] bg-muted flex items-center justify-center">
                <span className="text-8xl text-muted-foreground">
                  {displayName?.charAt(0)}
                </span>
              </div>
            </Card>
          )}
        </div>

        {/* Profile Info */}
        <div className="p-4 space-y-6">
          {/* Name and Basic Info */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold">{displayName}, {profile.age}</h2>
              {profile.isVerified && (
                <CheckCircle2 className="h-6 w-6 text-primary fill-primary" data-testid="icon-verified" />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{profile.location}</span>
            </div>
          </div>

          {/* Quick Info Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">
              <Heart className="h-3 w-3 mr-1" />
              {profile.lookingFor}
            </Badge>
            {profile.sect && (
              <Badge variant="secondary">
                <Moon className="h-3 w-3 mr-1" />
                {profile.sect}
              </Badge>
            )}
            {profile.religiousPractice && (
              <Badge variant="outline">
                <BookOpen className="h-3 w-3 mr-1" />
                {profile.religiousPractice}
              </Badge>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
              </CardContent>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <h3 className="font-semibold">Details</h3>
              
              {profile.profession && (
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Profession</p>
                    <p>{profile.profession}</p>
                  </div>
                </div>
              )}

              {profile.education && (
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Education</p>
                    <p>{profile.education}</p>
                  </div>
                </div>
              )}

              {formatHeight(profile.height, profile.heightUnit) && (
                <div className="flex items-center gap-3">
                  <Ruler className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Height</p>
                    <p>{formatHeight(profile.height, profile.heightUnit)}</p>
                  </div>
                </div>
              )}

              {profile.maritalStatus && (
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Marital Status</p>
                    <p>{profile.maritalStatus}</p>
                  </div>
                </div>
              )}

              {profile.wantsChildren && (
                <div className="flex items-center gap-3">
                  <Baby className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Wants Children</p>
                    <p>{profile.wantsChildren}</p>
                  </div>
                </div>
              )}

              {profile.languages && profile.languages.length > 0 && (
                <div className="flex items-center gap-3">
                  <Languages className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Languages</p>
                    <p>{profile.languages.join(", ")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-semibold mb-3">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest, index) => (
                    <Badge key={index} variant="outline" data-testid={`badge-interest-${index}`}>
                      {interest}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ethnicities */}
          {profile.ethnicities && profile.ethnicities.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-semibold mb-3">Ethnicity</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.ethnicities.map((ethnicity, index) => (
                    <Badge key={index} variant="secondary" data-testid={`badge-ethnicity-${index}`}>
                      {ethnicity}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Religious Details */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <h3 className="font-semibold">Religious Background</h3>
              
              {profile.bornMuslim !== null && profile.bornMuslim !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Born Muslim</span>
                  <span>{profile.bornMuslim ? "Yes" : "No (Revert)"}</span>
                </div>
              )}

              {profile.prayerFrequency && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prayer</span>
                  <span>{profile.prayerFrequency}</span>
                </div>
              )}

              {profile.halalImportance && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Halal Diet</span>
                  <span>{profile.halalImportance}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              className="flex-1"
              onClick={() => setLocation(`/messages/${match.id}`)}
              data-testid="button-send-message"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
