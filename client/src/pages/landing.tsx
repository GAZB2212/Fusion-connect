import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Users, MessageSquare, CheckCircle2, Star, Sparkles } from "lucide-react";
import logoImage from "@assets/NEW logo 2_1761587557587.png";

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
    <div className="min-h-screen bg-background golden-shimmer">
      {/* Navigation - Fixed to top */}
      <nav className="fixed top-0 left-0 right-0 z-50 w-full border-b border-white/10 bg-background/20 backdrop-blur-md">
        <div className="w-full max-w-7xl mx-auto flex flex-row h-16 md:h-20 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Fusion Logo" className="hidden md:block h-12 md:h-[5.25rem] w-auto" />
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
      
      {/* Hero Section - Dark Navy Background */}
      <section className="relative overflow-hidden min-h-screen flex items-center justify-center bg-background golden-shimmer">
        {/* Hero content */}
        <div className="container relative z-10 px-4 pt-24 md:pt-28 pb-20">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-8 flex justify-center">
                <img src={logoImage} alt="Fusion Logo" className="w-full max-w-2xl h-auto" data-testid="img-hero-logo" />
              </div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-6 py-2 backdrop-blur-sm">
                <Star className="h-4 w-4 text-primary fill-primary" />
                <span className="text-foreground text-sm font-medium">Trusted by Muslims worldwide</span>
              </div>
              <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl font-serif text-foreground">
                Where Muslims Meet
              </h1>
              <p className="mb-10 text-lg md:text-xl max-w-2xl mx-auto text-foreground/80 leading-relaxed">
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
                  className="text-base border-foreground/30 text-foreground hover:bg-foreground/10 backdrop-blur-sm" 
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
                    <div className="text-sm md:text-base text-foreground/70 mt-2">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
      </section>

      {/* Features Section - Elevated Blue Cards */}
      <section id="features" className="py-24 bg-gradient-to-b from-background via-background to-card relative golden-shimmer">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-20" />
        <div className="container px-4 relative">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 font-serif text-foreground">
              Built for Halal Relationships
            </h2>
            <p className="text-lg md:text-xl text-foreground/70">
              Every feature designed to respect Islamic values while making it easy to find your perfect match.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="bg-gradient-to-br from-card to-background rounded-xl border border-foreground/10 p-8 hover-elevate transition-all duration-300"
              >
                <div className="h-14 w-14 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center mb-6">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl md:text-2xl font-semibold mb-3 text-foreground font-serif">{feature.title}</h3>
                <p className="text-foreground/70 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-gradient-to-b from-card via-background to-background relative golden-shimmer">
        <div className="absolute inset-0 bg-gradient-to-tl from-primary/5 via-transparent to-transparent opacity-20" />
        <div className="container px-4 relative">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 font-serif text-foreground">
              How It Works
            </h2>
            <p className="text-lg text-foreground/70">
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
                <h3 className="text-lg font-semibold mb-2 text-foreground">{item.title}</h3>
                <p className="text-sm text-foreground/60">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-gradient-to-b from-card via-background to-card relative golden-shimmer">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-20" />
        <div className="container px-4 relative">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 font-serif text-foreground">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-foreground/70">
              Sign up for free, upgrade to connect with your matches
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="bg-gradient-to-br from-card to-background rounded-xl border border-foreground/10 p-8">
              <h3 className="text-2xl font-bold mb-2 text-foreground font-serif">Free</h3>
              <div className="text-4xl font-bold text-foreground mb-6 font-serif">£0</div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/70">Create your profile</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/70">Browse profiles</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/70">Swipe right and left</span>
                </li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full border-[#F8F4E3]/30 text-foreground hover:bg-[#F8F4E3]/10"
                asChild
                data-testid="button-get-started-free"
              >
                <a href="/signup">Get Started Free</a>
              </Button>
            </div>

            {/* Premium Tier */}
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border-2 border-primary p-8 relative">
              <div className="absolute top-0 right-8 -translate-y-1/2">
                <div className="bg-primary text-black px-4 py-1 rounded-full text-sm font-semibold">
                  MOST POPULAR
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-foreground font-serif">Premium</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold text-primary font-serif">£9.99</span>
                <span className="text-foreground/70 ml-2">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">Everything in Free, plus:</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">View all your matches</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">Unlimited messaging</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">Chaperone support</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">Full privacy controls</span>
                </li>
              </ul>
              <Button 
                className="w-full shadow-lg shadow-primary/20"
                asChild
                data-testid="button-upgrade-premium"
              >
                <a href="/signup">Upgrade to Premium</a>
              </Button>
              <p className="text-xs text-foreground/50 text-center mt-4">Cancel anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gradient-to-b from-background via-card to-background relative golden-shimmer">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-20" />
        <div className="container px-4 relative">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 font-serif text-foreground">
              Real Love Stories
            </h2>
            <p className="text-lg text-foreground/70">
              Thousands of Muslim couples have found their perfect match
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((testimonial, i) => (
              <div 
                key={i} 
                className="bg-gradient-to-br from-background to-card rounded-xl border border-foreground/10 p-8 hover-elevate"
              >
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-5 w-5 text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-foreground/90 mb-6 text-lg leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.author}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-secondary/20 border border-secondary/40 px-3 py-1">
                    <CheckCircle2 className="h-4 w-4 text-secondary" />
                    <span className="text-xs text-foreground/80 font-medium">{testimonial.badge}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-b from-background via-card to-background relative overflow-hidden golden-shimmer">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5 opacity-30" />
        <div className="container px-4 relative">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 font-serif text-foreground">
              Begin Your Journey Today
            </h2>
            <p className="text-lg mb-10 text-foreground/70 max-w-2xl mx-auto">
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
            <p className="mt-6 text-sm text-foreground/50">
              No credit card required • 100% halal • Verified profiles
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-background border-t border-foreground/10 golden-shimmer">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Fusion" className="h-10 w-auto" />
            </div>
            <p className="text-sm text-foreground/50">
              © 2025 Fusion. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
