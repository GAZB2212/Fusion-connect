import { Button } from "@/components/ui/button";
import { Heart, Shield, Users, MessageSquare, CheckCircle2, Star } from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: Shield,
      title: "Privacy & Safety First",
      description: "Verified profiles, photo blur options, and complete control over your visibility. Your privacy is our priority."
    },
    {
      icon: Heart,
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
    { number: "15M+", label: "Muslim Singles" },
    { number: "600K+", label: "Success Stories" },
    { number: "500+", label: "Daily Matches" }
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
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Heart className="h-7 w-7 text-primary fill-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Halal Hearts
            </span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="container relative px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
              <Star className="h-4 w-4 text-primary fill-primary" />
              <span className="text-muted-foreground">Trusted by Muslims worldwide</span>
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Where Muslims Meet
              <span className="block bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                For Marriage
              </span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto">
              Join thousands of Muslim singles finding meaningful connections through halal interactions. 
              Verified profiles, chaperone support, and complete privacy.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base" asChild data-testid="button-get-started">
                <a href="/api/login">Get Started Free</a>
              </Button>
              <Button size="lg" variant="outline" className="text-base" asChild>
                <a href="#features">Learn More</a>
              </Button>
            </div>
            
            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-4 md:gap-8">
              {stats.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl md:text-4xl font-bold text-primary">{stat.number}</div>
                  <div className="text-sm md:text-base text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container px-4">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for Halal Relationships
            </h2>
            <p className="text-lg text-muted-foreground">
              Every feature designed to respect Islamic values while making it easy to find your perfect match.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <div key={i} className="bg-card rounded-xl border p-8 hover-elevate">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container px-4">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Find your life partner in four simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { step: "1", title: "Create Profile", desc: "Share your values, preferences, and what you're looking for" },
              { step: "2", title: "Get Verified", desc: "Upload a selfie for profile verification and safety" },
              { step: "3", title: "Discover Matches", desc: "Browse profiles that match your Islamic preferences" },
              { step: "4", title: "Start Chatting", desc: "Connect with mutual matches, with optional chaperone" }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/30">
        <div className="container px-4">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Success Stories
            </h2>
            <p className="text-lg text-muted-foreground">
              Join thousands of couples who found their match
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((testimonial, i) => (
              <div key={i} className="bg-card rounded-xl border p-8">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-lg mb-6 italic">"{testimonial.quote}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{testimonial.author}</div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {testimonial.badge}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Find Your Match?
          </h2>
          <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of Muslim singles who are finding meaningful connections while respecting their faith and values.
          </p>
          <Button size="lg" variant="secondary" className="text-base" asChild data-testid="button-join-now">
            <a href="/api/login">Join Now - It's Free</a>
          </Button>
          <p className="mt-4 text-sm opacity-75">
            No credit card required • 100% halal • Verified profiles
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Heart className="h-6 w-6 text-primary fill-primary" />
              <span className="font-semibold">Halal Hearts</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Halal Hearts. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
