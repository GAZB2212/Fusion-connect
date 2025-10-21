import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Profile } from "@shared/schema";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Home from "@/pages/home";
import ProfileSetup from "@/pages/profile-setup";
import Matches from "@/pages/matches";
import Messages from "@/pages/messages";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { BottomNav } from "@/components/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { SplashScreen } from "@/components/splash-screen";

function Router() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();

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
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Authenticated but profile not complete - only show profile setup
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

  // Authenticated with complete profile - show app routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/matches" component={Matches} />
      <Route path="/messages/:matchId?" component={Messages} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Router />
      {isAuthenticated && <BottomNav />}
    </>
  );
}

function App() {
  // Show splash screen only on initial load (not on HMR updates)
  const [showSplash, setShowSplash] = useState(() => {
    // Check if this is a fresh load
    const isInitialLoad = !window.sessionStorage.getItem('app_loaded');
    if (isInitialLoad) {
      window.sessionStorage.setItem('app_loaded', 'true');
      return true;
    }
    return false;
  });

  const handleSplashComplete = () => {
    console.log("Splash complete callback");
    setShowSplash(false);
  };

  console.log("App rendering, showSplash:", showSplash);

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
