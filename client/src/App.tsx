import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { Profile } from "@shared/schema";
import { 
  initializeEarly, 
  registerTokenWithBackend, 
  setNavigationCallback,
  initializePushNotifications 
} from "@/lib/unifiedPushNotifications";
import { isCapacitorNative } from "@/lib/platform";
import { VideoCallProvider } from "@/contexts/VideoCallContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { TextSizeProvider } from "@/contexts/TextSizeContext";
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
import { Loader2 } from "lucide-react";

function Router() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Check for URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const isRestart = searchParams.get('restart') === 'true';
  const isSetupMode = searchParams.get('setup') === 'true';
  const isFastOnboardingComplete = searchParams.get('fastOnboardingComplete') === 'true';
  
  // Combined flag for any mode that requires profile setup access
  const needsProfileSetup = isRestart || isSetupMode || isFastOnboardingComplete;

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
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
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
  // UNLESS user needs profile setup (restart, setup mode, or fast onboarding complete)
  if (profile?.isComplete && !profile?.faceVerified && !needsProfileSetup) {
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

  // If user needs profile setup and profile is complete but not verified, show profile setup
  if (needsProfileSetup && profile?.isComplete && !profile?.faceVerified) {
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
  const [, setLocation] = useLocation();
  const { data: profile } = useQuery<Profile>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
    retry: false,
  });
  
  // Track if we've done early push init
  const earlyInitDone = useRef(false);
  // Track if we've registered token with backend
  const tokenRegistered = useRef(false);

  // STEP 1: Initialize push notifications EARLY on app launch (before login)
  // This sets up listeners and requests permission to get the device token
  useEffect(() => {
    const earlyInit = async () => {
      if (earlyInitDone.current) return;
      earlyInitDone.current = true;
      
      // Only do early init for native apps
      if (!isCapacitorNative()) {
        console.log('[Push] Web platform - skipping early init, will use standard flow');
        return;
      }
      
      console.log('[Push] App launch - starting early push notification init...');
      
      // Set navigation callback early
      setNavigationCallback((matchId: string) => {
        console.log('[Push] Navigating to chat from notification:', matchId);
        setLocation(`/messages/${matchId}`);
      });
      
      try {
        // Initialize early - this requests permission and gets APNs/FCM token
        const token = await initializeEarly();
        if (token) {
          console.log('[Push] Early init successful - token ready for backend registration');
        } else {
          console.warn('[Push] Early init completed but no token obtained');
        }
      } catch (error) {
        console.error('[Push] Early init failed:', error);
      }
    };
    
    earlyInit();
  }, [setLocation]);

  // STEP 2: Register token with backend when user is authenticated
  useEffect(() => {
    const registerToken = async () => {
      // Only register if user is fully authenticated
      if (!isAuthenticated || !profile?.isComplete || !profile?.faceVerified) {
        return;
      }
      
      // Don't re-register if already done this session
      if (tokenRegistered.current) {
        return;
      }
      tokenRegistered.current = true;
      
      console.log('[Push] User authenticated - registering push token with backend...');
      
      // For native apps, use the pending token from early init
      if (isCapacitorNative()) {
        try {
          const success = await registerTokenWithBackend();
          if (success) {
            console.log('[Push] Token registered with backend successfully');
          } else {
            console.warn('[Push] Failed to register token with backend');
          }
        } catch (error) {
          console.error('[Push] Token registration error:', error);
        }
      } else {
        // For web, use the standard initialization flow
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        
        try {
          const handleNavigateToChat = (matchId: string) => {
            console.log('[Push] Navigating to chat from notification:', matchId);
            setLocation(`/messages/${matchId}`);
          };

          await initializePushNotifications(vapidKey, handleNavigateToChat);

          const { getNotificationPermission, enablePushNotifications } = await import('@/lib/unifiedPushNotifications');
          const permission = await getNotificationPermission();
          
          if (permission === 'prompt') {
            await enablePushNotifications(vapidKey);
          }
        } catch (error) {
          console.error('[Push] Web push setup failed:', error);
        }
      }
    };

    registerToken();
  }, [isAuthenticated, profile?.isComplete, profile?.faceVerified, setLocation]);

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
      <LanguageProvider>
        <TextSizeProvider>
          <TooltipProvider>
            <WebSocketProvider>
              <VideoCallProvider>
                <Toaster />
                <AppContent />
              </VideoCallProvider>
            </WebSocketProvider>
          </TooltipProvider>
        </TextSizeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
