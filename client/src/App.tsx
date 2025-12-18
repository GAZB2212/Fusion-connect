import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Profile } from "@shared/schema";
import { initializePushNotifications } from "@/lib/unifiedPushNotifications";
import { VideoCallProvider } from "@/contexts/VideoCallContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import Landing from "@/pages/landing";
import Launch from "@/pages/launch";
import AdminQR from "@/pages/admin-qr";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Home from "@/pages/home";
import ProfileSetup from "@/pages/profile-setup";
import Verification from "@/pages/verification";
import Matches from "@/pages/matches";
import MatchProfile from "@/pages/match-profile";
import Messages from "@/pages/messages";
import Settings from "@/pages/settings";
import Subscribe from "@/pages/subscribe";
import Suggestions from "@/pages/suggestions";
import Feedback from "@/pages/feedback";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import ChaperonePortal from "@/pages/chaperone-portal";
import GuidanceHub from "@/pages/guidance-hub";
import NotFound from "@/pages/not-found";
import { BottomNav } from "@/components/navigation";
import { Skeleton } from "@/components/ui/skeleton";

function Router() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Check for URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const isRestart = searchParams.get('restart') === 'true';

  // Fetch user profile if authenticated
  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
    retry: false,
  });

  const isLoading = authLoading || (isAuthenticated && profileLoading);

  // Redirect to profile setup if authenticated but no complete profile
  useEffect(() => {
    if (!isLoading && isAuthenticated && !profile?.isComplete && location !== "/") {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, profile, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  // Not authenticated - show public routes
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/launch" component={Launch} />
        <Route path="/admin/qr-code" component={AdminQR} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route path="/chaperone" component={ChaperonePortal} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Authenticated but profile not complete - show standard profile setup
  if (!profile?.isComplete) {
    return (
      <Switch>
        <Route path="/" component={ProfileSetup} />
        <Route path="/:rest*">
          {() => {
            setLocation("/");
            return null;
          }}
        </Route>
      </Switch>
    );
  }

  // Authenticated with complete profile but not verified - show verification
  // UNLESS restart=true, then allow profile setup to update photos
  if (profile?.isComplete && !profile?.faceVerified && !isRestart) {
    return (
      <Switch>
        <Route path="/" component={Verification} />
        <Route path="/:rest*">
          {() => {
            setLocation("/");
            return null;
          }}
        </Route>
      </Switch>
    );
  }

  // If restart=true and profile is complete, show profile setup to update photos
  if (isRestart && profile?.isComplete) {
    return (
      <Switch>
        <Route path="/" component={ProfileSetup} />
        <Route path="/:rest*">
          {() => {
            setLocation("/");
            return null;
          }}
        </Route>
      </Switch>
    );
  }

  // Authenticated with complete profile - show app routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/launch" component={Launch} />
      <Route path="/admin/qr-code" component={AdminQR} />
      <Route path="/suggestions" component={Suggestions} />
      <Route path="/matches" component={Matches} />
      <Route path="/matches/:matchId/profile" component={MatchProfile} />
      <Route path="/messages/:matchId?" component={Messages} />
      <Route path="/settings" component={Settings} />
      <Route path="/guidance" component={GuidanceHub} />
      <Route path="/feedback" component={Feedback} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/chaperone" component={ChaperonePortal} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  const { data: profile } = useQuery<Profile>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Initialize push notifications when user is authenticated with complete profile
  // Uses unified push service that works on both web and native (Capacitor)
  useEffect(() => {
    const setupPushNotifications = async () => {
      if (!isAuthenticated || !profile?.isComplete || !profile?.faceVerified) {
        return;
      }

      // VAPID key only needed for web push, native uses FCM/APNs
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      try {
        // Initialize unified push notifications (handles web and native automatically)
        await initializePushNotifications(vapidKey);

        // Request permission if not already granted (for web browser)
        // The unified service handles native permission requests internally
        const { getNotificationPermission, enablePushNotifications } = await import('@/lib/unifiedPushNotifications');
        const permission = await getNotificationPermission();
        
        if (permission === 'prompt') {
          await enablePushNotifications(vapidKey);
        }
      } catch (error) {
        console.error('Failed to setup push notifications:', error);
      }
    };

    setupPushNotifications();
  }, [isAuthenticated, profile?.isComplete, profile?.faceVerified]);

  return (
    <>
      <Router />
      {isAuthenticated && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WebSocketProvider>
          <VideoCallProvider>
            <Toaster />
            <AppContent />
          </VideoCallProvider>
        </WebSocketProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
