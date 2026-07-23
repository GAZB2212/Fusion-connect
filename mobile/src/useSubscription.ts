import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./api";

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
}

/** The auto-renewable subscription product configured in App Store Connect. */
export const PREMIUM_PRODUCT_ID = "com.gajocreative.fusion.premium.monthly";

/** Current premium entitlement from the backend (Stripe or Apple IAP). */
export function useSubscription() {
  const query = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription-status"],
    queryFn: () => apiRequest("GET", "/api/subscription-status"),
    staleTime: 60_000,
  });

  return {
    ...query,
    isPremium: query.data?.hasActiveSubscription ?? false,
  };
}
