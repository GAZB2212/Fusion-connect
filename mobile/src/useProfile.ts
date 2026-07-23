import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./api";
import type { Profile } from "./types";

// Fetches the current user's profile. Returns null (not error) when no profile
// exists yet, so callers can route new users into profile setup.
export function useProfile() {
  return useQuery<Profile | null>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      try {
        return await apiRequest<Profile>("GET", "/api/profile");
      } catch {
        return null;
      }
    },
  });
}
