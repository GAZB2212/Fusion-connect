import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/NEW logo 2_1761587557587.png";
import { 
  Shield, 
  Users, 
  Video, 
  Check, 
  Sparkles,
  Gift,
  Clock,
  Heart
} from "lucide-react";

export default function Launch() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [position, setPosition] = useState(0);

  // Fetch count of signups
  const { data: countData } = useQuery({
    queryKey: ["/api/early-signup/count"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const signupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/early-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Signup failed");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setPromoCode(data.signup.promoCode);
      setPosition(data.signup.position);
      setShowSuccess(true);
      toast({
        title: "Welcome to Fusion! 🎉",
        description: "Check your email for your exclusive promo code",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    signupMutation.mutate();
  };

  const spotsRemaining = (countData as any)?.remaining ?? 1000;
  const totalSignups = (countData as any)?.total ?? 0;

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0E17] geometric-pattern">
        <Card className="w-full max-w-2xl text-center bg-[#0A0E17] border-primary/20">
          <CardContent className="p-8 md:p-12">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Gift className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#F8F4E3] font-serif mb-4">
                You're In! 🎉
              </h1>
              <p className="text-[#F8F4E3]/70 text-lg mb-6">
                You're one of the first {position} people to join Fusion
              </p>
            </div>

            <div className="bg-[#0E1220] border border-primary/30 rounded-lg p-6 mb-6">
              <p className="text-sm text-[#F8F4E3]/70 mb-2">Your Exclusive Promo Code</p>
              <div className="text-2xl font-bold text-primary font-mono mb-3">
                {promoCode}
              </div>
              <p className="text-sm text-[#F8F4E3]/70">
                Save this code! Use it when we launch to get <span className="text-primary font-semibold">2 months free premium</span>
              </p>
            </div>

            <div className="space-y-3 text-sm text-[#F8F4E3]/70">
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-left">We'll email you this code and keep you updated on our launch</p>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-left">Be first to access when we go live</p>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-left">Get exclusive beta features and priority support</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-xs text-[#F8F4E3]/50">
                Share Fusion with friends who are also looking for meaningful connections
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] geometric-pattern">
      <div className="container max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-8">
            <img src={logoImage} alt="Fusion Logo" className="w-full max-w-2xl h-auto" data-testid="img-fusion-logo" />
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-[#F8F4E3] mb-4 font-serif">
            Where Faith Meets Forever
          </h2>
          <p className="text-xl md:text-2xl text-[#F8F4E3]/80 mb-8 max-w-3xl mx-auto">
            The luxury Muslim matchmaking platform designed for meaningful, halal connections leading to marriage
          </p>

          <div className="inline-flex items-center justify-center bg-primary/10 border border-primary/30 rounded-full px-6 py-3 mb-8">
            <span className="text-[#F8F4E3] font-semibold">🔥 Limited Early Access - Join 1,000 Founding Members</span>
          </div>

          <div className="max-w-md mx-auto mb-8">
            <Card className="bg-[#0A0E17] border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <p className="text-[#F8F4E3]/70 text-sm font-medium">First 1,000 Users Get</p>
                </div>
                <div className="text-5xl font-bold text-primary mb-2 font-serif">
                  2 Months Free
                </div>
                <div className="text-[#F8F4E3]/60 text-sm mb-3">
                  Premium access worth £19.98
                </div>
                <div className="text-2xl text-emerald-400 font-bold mb-4" data-testid="text-spots-remaining">
                  {spotsRemaining} spots left
                </div>
                <div className="w-full bg-[#0E1220] rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-primary via-amber-400 to-emerald-400 h-3 rounded-full transition-all duration-500 animate-pulse"
                    style={{ width: `${Math.max((totalSignups / 1000) * 100, 5)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-[#F8F4E3]/50 mt-3">
                  {totalSignups} members have already joined
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="max-w-md mx-auto bg-[#0A0E17]/90 border-primary/20 backdrop-blur-sm">
            <CardContent className="p-8">
              <h3 className="text-2xl font-serif font-bold text-[#F8F4E3] mb-2 text-center">
                Secure Your Spot
              </h3>
              <p className="text-[#F8F4E3]/70 text-sm mb-6 text-center">
                Join the waitlist and get early access when we launch
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    placeholder="First name (optional)"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-[#0E1220] border-white/10 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40"
                    data-testid="input-first-name"
                  />
                </div>
                <div>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-[#0E1220] border-white/10 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40"
                    data-testid="input-email"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={signupMutation.isPending || spotsRemaining === 0}
                  className="w-full text-lg h-12"
                  size="lg"
                  data-testid="button-join-waitlist"
                >
                  {signupMutation.isPending ? "Joining..." : spotsRemaining === 0 ? "Early Access Full" : "🎁 Get 2 Months Free"}
                </Button>
              </form>
              <p className="text-xs text-[#F8F4E3]/50 text-center mt-4">
                ✨ We'll send you your exclusive promo code via email
              </p>
              <p className="text-xs text-[#F8F4E3]/40 text-center mt-2">
                No credit card required • 18+ only
              </p>
            </CardContent>
          </Card>
        </div>

        {/* What You Get Section */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h3 className="text-3xl md:text-4xl font-serif font-bold text-center text-[#F8F4E3] mb-4">
            What to Expect
          </h3>
          <p className="text-[#F8F4E3]/70 text-center mb-12 max-w-2xl mx-auto">
            Fusion combines modern matchmaking technology with Islamic values to help you find a meaningful, halal relationship leading to marriage.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Card className="bg-[#0A0E17]/60 border-white/10 backdrop-blur-sm hover-elevate">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-[#F8F4E3] mb-2">
                  Safe & Verified Profiles
                </h3>
                <p className="text-sm text-[#F8F4E3]/70">
                  Face verification ensures every profile is authentic. We screen all members and verify photos to keep you safe from fake accounts and catfishing.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0A0E17]/60 border-white/10 backdrop-blur-sm hover-elevate">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-[#F8F4E3] mb-2">
                  Faith-Centered Matching
                </h3>
                <p className="text-sm text-[#F8F4E3]/70">
                  Match based on what matters: sect, practice level, prayer frequency, halal lifestyle, education, profession, and shared values for a compatible future together.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0A0E17]/60 border-white/10 backdrop-blur-sm hover-elevate">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-[#F8F4E3] mb-2">
                  Chaperone Support
                </h3>
                <p className="text-sm text-[#F8F4E3]/70">
                  Honor tradition by involving your Wali or guardian in conversations. Add a chaperone to view messages and ensure courtship follows Islamic principles.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0A0E17]/60 border-white/10 backdrop-blur-sm hover-elevate">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-[#F8F4E3] mb-2">
                  Secure Video Calls
                </h3>
                <p className="text-sm text-[#F8F4E3]/70">
                  Meet your matches face-to-face with built-in video calling. Get to know each other better in a respectful, halal way before taking the next step.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Pricing Info */}
        <div className="mt-16 max-w-2xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-serif font-bold text-[#F8F4E3] mb-4">
                Premium Membership
              </h3>
              <div className="text-5xl font-bold text-primary mb-2 font-serif">
                £9.99/mo
              </div>
              <p className="text-[#F8F4E3]/70 mb-6">
                Cancel anytime • Free to browse • Premium to connect
              </p>
              <div className="grid md:grid-cols-2 gap-3 text-sm text-[#F8F4E3]/80 text-left">
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>View all your matches</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Unlimited messaging</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Video calling with matches</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Add chaperone support</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16 pt-8 border-t border-white/10">
          <p className="text-sm text-[#F8F4E3]/50">
            © 2025 Fusion. Building the future of Muslim matchmaking with respect, authenticity, and faith.
          </p>
        </div>
      </div>
    </div>
  );
}
