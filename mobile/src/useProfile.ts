import { useQuery } from "@tanstack/react-query";
import { apiRequest, ApiError } from "./api";
import type { Profile } from "./types";

/** True when a profile request failed because the member has no profile yet. */
export const isNoProfile = (error: unknown) => error instanceof ApiError && error.status === 404;

// Fetches the current user's profile. Resolves null ONLY when the server says
// no profile exists (404) so new users are routed into profile setup; any other
// failure (offline, server error) stays an error, so an existing member with a
// flaky connection is never mistaken for a new one and sent back to onboarding.
export function useProfile() {
  return useQuery<Profile | null>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      try {
        return await apiRequest<Profile>("GET", "/api/profile");
      } catch (e) {
        if (isNoProfile(e)) return null;
        throw e;
      }
    },
  });
}
