import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import logoImage from "@assets/NEW logo 2_1761587557587.png";
import loadingVideo from "@assets/Scene_a_muslim_202512100938_lunmc_1765359545154.mp4";

export default function Landing() {
  const [showLoading, setShowLoading] = useState(() => {
    const hasSeenAnimation = sessionStorage.getItem('fusionAnimationShown');
    return !hasSeenAnimation;
  });
  const [fadeOut, setFadeOut] = useState(false);
  const [contentVisible, setContentVisible] = useState(!showLoading);
  const [logoVisible, setLogoVisible] = useState(false);
  const [elementsVisible, setElementsVisible] = useState(false);

  useEffect(() => {
    if (!showLoading) {
      setTimeout(() => setElementsVisible(true), 100);
      return;
    }

    sessionStorage.setItem('fusionAnimationShown', 'true');

    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 8000);

    const removeTimer = setTimeout(() => {
      setShowLoading(false);
    }, 9000);

    const contentTimer = setTimeout(() => {
      setContentVisible(true);
    }, 8500);

    const elementsTimer = setTimeout(() => {
      setElementsVisible(true);
    }, 9200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
      clearTimeout(contentTimer);
      clearTimeout(elementsTimer);
    };
  }, [showLoading]);
  
  useEffect(() => {
    if (showLoading) {
      const logoTimer = setTimeout(() => {
        setLogoVisible(true);
      }, 1500);
      return () => clearTimeout(logoTimer);
    }
  }, [showLoading]);

  if (showLoading) {
    return (
      <div 
        className={`fixed inset-0 bg-background flex items-center justify-center z-50 transition-opacity duration-1000 ${
          fadeOut ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <video
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          data-testid="video-loading"
        >
          <source src={loadingVideo} type="video/mp4" />
        </video>
        
        <div className="absolute inset-0 bg-black/40" />
        
        <div 
          className={`absolute inset-x-0 top-0 flex justify-center pt-16 pointer-events-none transition-all duration-1000 ease-out ${
            logoVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
          }`}
        >
          <img 
            src={logoImage} 
            alt="Fusion Logo" 
            className="w-72 h-auto drop-shadow-[0_8px_40px_rgba(0,0,0,0.9)]"
            data-testid="img-splash-logo"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 flex flex-col transition-opacity duration-700 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        {/* Logo */}
        <div 
          className={`mb-6 transition-all duration-700 ease-out ${
            elementsVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <img 
            src={logoImage} 
            alt="Fusion" 
            className="w-64 md:w-80 h-auto"
            data-testid="img-auth-logo"
          />
        </div>

        {/* Tagline */}
        <p 
          className={`text-center text-lg md:text-xl text-foreground/70 mb-12 max-w-xs transition-all duration-700 delay-100 ease-out ${
            elementsVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          Where Muslims Meet
        </p>

        {/* Auth buttons */}
        <div 
          className={`w-full max-w-sm flex flex-col gap-4 transition-all duration-700 delay-200 ease-out ${
            elementsVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <Button 
            size="lg" 
            className="w-full h-14 text-base font-semibold rounded-full shadow-lg shadow-primary/25"
            asChild 
            data-testid="button-create-account"
          >
            <Link href="/signup">Create Account</Link>
          </Button>

          <Button 
            variant="ghost" 
            size="lg"
            className="w-full h-14 text-base text-foreground/80 hover:text-foreground hover:bg-transparent"
            asChild
            data-testid="button-sign-in"
          >
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>

      {/* Footer with Terms & Privacy */}
      <div 
        className={`pb-8 pt-4 px-8 text-center transition-all duration-700 delay-300 ease-out ${
          elementsVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <p className="text-xs text-foreground/40 leading-relaxed">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-foreground/60" data-testid="link-terms">
            Terms of Service
          </Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-foreground/60" data-testid="link-privacy">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
