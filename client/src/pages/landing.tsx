import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Heart, 
  Shield, 
  Users, 
  Video, 
  Check, 
  Sparkles,
  Gift,
  Clock
} from "lucide-react";

export default function Landing() {
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] golden-shimmer">
        <Card className="w-full max-w-2xl bg-[#0A0E17] border-white/10 text-center">
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

            <div className="bg-black/30 border border-primary/30 rounded-lg p-6 mb-6">
              <p className="text-sm text-[#F8F4E3]/60 mb-2">Your Exclusive Promo Code</p>
              <div className="text-2xl font-bold text-primary font-mono mb-3">
                {promoCode}
              </div>
              <p className="text-sm text-[#F8F4E3]/50">
                Save this code! Use it when we launch to get <span className="text-primary font-semibold">2 months free premium</span>
              </p>
            </div>

            <div className="space-y-3 text-sm text-[#F8F4E3]/60">
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
              <p className="text-xs text-[#F8F4E3]/40">
                Share Fusion with friends who are also looking for meaningful connections
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] golden-shimmer">
      <div className="container max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/50 rounded-full flex items-center justify-center">
              <Heart className="h-8 w-8 text-[#0A0E17]" fill="currentColor" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#F8F4E3] font-serif">
              Fusion
            </h1>
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-[#F8F4E3] mb-4 font-serif">
            Where Faith Meets Love
          </h2>
          <p className="text-xl md:text-2xl text-[#F8F4E3]/70 mb-8 max-w-3xl mx-auto">
            The luxury Muslim matchmaking platform designed for meaningful connections
          </p>

          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-6 py-3 mb-8">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-[#F8F4E3] font-semibold">Limited Early Access</span>
          </div>

          <div className="max-w-md mx-auto mb-8">
            <div className="bg-black/30 border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-primary" />
                <p className="text-[#F8F4E3]/70 text-sm">First 1,000 Users Get</p>
              </div>
              <div className="text-4xl font-bold text-primary mb-2 font-serif">
                2 Months Free
              </div>
              <div className="text-lg text-emerald-400 font-semibold mb-3">
                {spotsRemaining} spots remaining
              </div>
              <div className="w-full bg-black/50 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-primary to-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(totalSignups / 1000) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <Card className="max-w-md mx-auto bg-[#0A0E17] border-white/10">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    placeholder="First name (optional)"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-black/30 border-white/10 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40"
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
                    className="bg-black/30 border-white/10 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40"
                    data-testid="input-email"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={signupMutation.isPending || spotsRemaining === 0}
                  className="w-full"
                  size="lg"
                  data-testid="button-join-waitlist"
                >
                  {signupMutation.isPending ? "Joining..." : spotsRemaining === 0 ? "Early Access Full" : "Claim My Spot"}
                </Button>
              </form>
              <p className="text-xs text-[#F8F4E3]/40 text-center mt-4">
                We'll send you your exclusive promo code via email
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <Card className="bg-[#0A0E17] border-white/10 text-center">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-[#F8F4E3] mb-2">
                Safe & Verified
              </h3>
              <p className="text-sm text-[#F8F4E3]/60">
                AI-powered photo verification and strict profile screening
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#0A0E17] border-white/10 text-center">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-[#F8F4E3] mb-2">
                Islamic Values
              </h3>
              <p className="text-sm text-[#F8F4E3]/60">
                Built with halal principles and respect for your faith
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#0A0E17] border-white/10 text-center">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-[#F8F4E3] mb-2">
                Chaperone Support
              </h3>
              <p className="text-sm text-[#F8F4E3]/60">
                Involve your Wali or family in conversations if you choose
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#0A0E17] border-white/10 text-center">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-[#F8F4E3] mb-2">
                Video Calls
              </h3>
              <p className="text-sm text-[#F8F4E3]/60">
                Connect face-to-face with your matches in a respectful way
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16 pt-8 border-t border-white/10">
          <p className="text-sm text-[#F8F4E3]/40">
            © 2025 Fusion. Building the future of Muslim matchmaking.
          </p>
        </div>
      </div>
    </div>
  );
}
