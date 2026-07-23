// Shapes returned by the backend (subset of fields the app uses).

export interface Profile {
  id: string;
  userId: string;
  displayName: string;
  age: number;
  gender: string;
  location: string;
  bio?: string | null;
  photos?: string[] | null;
  sect?: string | null;
  religiousPractice?: string | null;
  prayerFrequency?: string | null;
  profession?: string | null;
  occupation?: string | null;
  lookingFor?: string | null;
  interests?: string[] | null;
  faceVerified?: boolean | null;
  isComplete?: boolean | null;
  useNickname?: boolean | null;
}

export interface DiscoverProfile extends Profile {
  user?: { id: string; firstName?: string | null };
}

export interface LikeEntry {
  swipeId: string;
  swipedAt: string;
  profile: Profile;
}

export interface MatchEntry {
  id: string;
  createdAt: string;
  user1Id: string;
  user2Id: string;
  user1Profile: Profile & { user?: { id: string } };
  user2Profile: Profile & { user?: { id: string } };
}

export interface SwipeResult {
  success: boolean;
  isMatch: boolean;
  matchId: string | null;
  requiresVerification?: boolean;
}
