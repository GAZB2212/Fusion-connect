import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Users, MessageSquare, CheckCircle2, Star, Sparkles } from "lucide-react";
import logoImage from "@assets/logo 40_1761066001045.png";
import heroVideo from "@assets/Animate_this_logo_202510211818 (1)_1761067145031.mp4";
import heroVideoMobile from "@assets/Animate_this_logo_202510211838_5e5g3_1761068326631.mp4";

function CountUpNumber({ end, suffix = "", duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <>{count}{suffix}</>;
}

export default function Landing() {
  const [videoEnded, setVideoEnded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const features = [
    {
      icon: Shield,
      title: "Privacy & Safety First",
      description: "Verified profiles, photo blur options, and complete control over your visibility. Your privacy is our priority."
    },
    {
      icon: Sparkles,
      title: "Faith-Based Matching",
      description: "Find someone who shares your values. Filter by sect, prayer habits, halal lifestyle, and marriage intentions."
    },
    {
      icon: Users,
      title: "Chaperone Feature",
      description: "Include your Wali or guardian in conversations for traditional courtship with modern convenience."
    },
    {
      icon: MessageSquare,
      title: "Safe Communication",
      description: "Message only after mutual matches. No unsolicited messages, no pressure, just meaningful connections."
    }
  ];

  const stats = [
    { number: 15, suffix: "M+", label: "Muslim Singles" },
    { number: 600, suffix: "K+", label: "Success Stories" },
    { number: 500, suffix: "+", label: "Daily Matches" }
  ];

  const testimonials = [
    {
      quote: "A beautiful halal way to meet my spouse. The chaperone feature gave my family peace of mind.",
      author: "Fatima & Ahmed",
      badge: "Married 2024"
    },
    {
      quote: "Finally, an app that respects our values and traditions while being modern and easy to use.",
      author: "Aisha & Omar",
      badge: "Married 2023"
    }
  ];

  return (
    <div className="min-h-screen bg-black golden-shimmer">
      {/* Navigation - Fixed to top, outside hero section */}
      {videoEnded && (
        <nav className="fixed top-0 left-0 right-0 z-50 w-full border-b border-white/10 bg-black/20 backdrop-blur-md animate-in fade-in duration-1000">
          <div className="w-full max-w-7xl mx-auto flex flex-row h-16 md:h-20 items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Fusion Logo" className="h-12 md:h-[5.25rem] w-auto" />
            </div>
            <Button 
              variant="outline" 
              className="border-primary text-primary hover:bg-primary/10 text-sm md:text-base"
              asChild 
              data-testid="button-login"
            >
              <a href="/login">Sign In</a>
            </Button>
          </div>
        </nav>
      )}
      
      {/* Hero Section - Black Background */}
      <section className="relative overflow-hidden min-h-screen flex items-center justify-center bg-black golden-shimmer">
        
        {/* Full-screen Video - only show while playing */}
        {!videoEnded && (
          <video
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-contain md:object-cover px-4 md:px-0"
            onEnded={() => setVideoEnded(true)}
            key={isMobile ? 'mobile' : 'desktop'}
          >
            <source src={isMobile ? heroVideoMobile : heroVideo} type="video/mp4" />
          </video>
        )}
        
        {/* Hero content - only show after video ends */}
        {videoEnded && (
          <div className="container relative z-10 px-4 py-20 animate-in fade-in duration-1000">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-6 py-2 backdrop-blur-sm">
                <Star className="h-4 w-4 text-primary fill-primary" />
                <span className="text-[#F8F4E3] text-sm font-medium">Trusted by Muslims worldwide</span>
              </div>
              <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl font-serif text-[#F8F4E3]">
                Where Muslims Meet
              </h1>
              <p className="mb-10 text-lg md:text-xl max-w-2xl mx-auto text-[#F8F4E3]/80 leading-relaxed">
                Join thousands of Muslim singles finding meaningful connections through halal interactions. 
                Verified profiles, chaperone support, and complete privacy.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="text-base font-semibold shadow-lg shadow-primary/20" 
                  asChild 
                  data-testid="button-get-started"
                >
                  <a href="/signup">Get Started Free</a>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-base border-[#F8F4E3]/30 text-[#F8F4E3] hover:bg-[#F8F4E3]/10 backdrop-blur-sm" 
                  asChild
                >
                  <a href="#features">Learn More</a>
                </Button>
              </div>
              
              {/* Stats */}
              <div className="mt-20 grid grid-cols-3 gap-6 md:gap-12">
                {stats.map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className="text-3xl md:text-5xl font-bold text-primary font-serif">
                      <CountUpNumber end={stat.number} suffix={stat.suffix} />
                    </div>
                    <div className="text-sm md:text-base text-[#F8F4E3]/70 mt-2">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Features Section - Elevated Navy Cards */}
      <section id="features" className="py-24 bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] relative golden-shimmer">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-20" />
        <div className="container px-4 relative">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 font-serif text-[#F8F4E3]">
              Built for Halal Relationships
            </h2>
            <p className="text-lg md:text-xl text-[#F8F4E3]/70">
              Every feature designed to respect Islamic values while making it easy to find your perfect match.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="bg-gradient-to-br from-[#0E1220] to-[#0A0E17] rounded-xl border border-[#F8F4E3]/10 p-8 hover-elevate transition-all duration-300"
              >
                <div className="h-14 w-14 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center mb-6">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl md:text-2xl font-semibold mb-3 text-[#F8F4E3] font-serif">{feature.title}</h3>
                <p className="text-[#F8F4E3]/70 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-gradient-to-b from-[#0E1220] via-[#0A0E17] to-[#0A0E17] relative golden-shimmer">
        <div className="absolute inset-0 bg-gradient-to-tl from-primary/5 via-transparent to-transparent opacity-20" />
        <div className="container px-4 relative">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 font-serif text-[#F8F4E3]">
              How It Works
            </h2>
            <p className="text-lg text-[#F8F4E3]/70">
              Simple, respectful, and designed for serious marriage seekers
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { step: "1", title: "Create Profile", desc: "Share your faith journey and what you're looking for" },
              { step: "2", title: "Get Verified", desc: "Build trust with selfie verification and profile review" },
              { step: "3", title: "Match & Connect", desc: "Swipe based on values, lifestyle, and compatibility" },
              { step: "4", title: "Meet Halal", desc: "Chat with chaperone support and video calls" }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="mb-4 mx-auto h-16 w-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary font-serif">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[#F8F4E3]">{item.title}</h3>
                <p className="text-sm text-[#F8F4E3]/60">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gradient-to-b from-[#0A0E17] via-[#0E1220] to-[#0A0E17] relative golden-shimmer">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-20" />
        <div className="container px-4 relative">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 font-serif text-[#F8F4E3]">
              Real Love Stories
            </h2>
            <p className="text-lg text-[#F8F4E3]/70">
              Thousands of Muslim couples have found their perfect match
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((testimonial, i) => (
              <div 
                key={i} 
                className="bg-gradient-to-br from-[#0A0E17] to-[#0E1220] rounded-xl border border-[#F8F4E3]/10 p-8 hover-elevate"
              >
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-5 w-5 text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-[#F8F4E3]/90 mb-6 text-lg leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[#F8F4E3]">{testimonial.author}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-secondary/20 border border-secondary/40 px-3 py-1">
                    <CheckCircle2 className="h-4 w-4 text-secondary" />
                    <span className="text-xs text-[#F8F4E3]/80 font-medium">{testimonial.badge}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-b from-[#0A0E17] via-[#0E1220] to-black relative overflow-hidden golden-shimmer">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5 opacity-30" />
        <div className="container px-4 relative">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 font-serif text-[#F8F4E3]">
              Begin Your Journey Today
            </h2>
            <p className="text-lg mb-10 text-[#F8F4E3]/70 max-w-2xl mx-auto">
              Join thousands of Muslim singles who are finding meaningful connections while respecting their faith and values.
            </p>
            <Button 
              size="lg" 
              className="text-lg px-10 py-6 h-auto font-semibold shadow-xl shadow-primary/30" 
              asChild 
              data-testid="button-join-now"
            >
              <a href="/signup">Join Now - It's Free</a>
            </Button>
            <p className="mt-6 text-sm text-[#F8F4E3]/50">
              No credit card required • 100% halal • Verified profiles
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-black border-t border-[#F8F4E3]/10 golden-shimmer">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Fusion" className="h-10 w-auto" />
            </div>
            <p className="text-sm text-[#F8F4E3]/50">
              © 2025 Fusion. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
