import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const forgotPasswordMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/forgot-password", { email });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Email Sent",
        description: "If an account exists with that email, you will receive a password reset link.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    forgotPasswordMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-[#1A1E27] border-[#2A2E37]">
        <div className="mb-8 text-center">
          <div className="text-5xl mb-4">🌙</div>
          <h1 className="text-2xl font-bold text-[#F8F4E3] mb-2">Forgot Password?</h1>
          <p className="text-[#9CA3AF]">
            {submitted 
              ? "Check your email for a password reset link"
              : "Enter your email and we'll send you a link to reset your password"
            }
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-[#F8F4E3]">Email Address</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="pl-10 bg-[#0A0E17] border-[#2A2E37] text-[#F8F4E3] placeholder:text-[#6B7280]"
                  data-testid="input-reset-email"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#D4AF37] hover:bg-[#C19B2B] text-[#0A0E17] font-semibold"
              disabled={forgotPasswordMutation.isPending}
              data-testid="button-send-reset"
            >
              {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
            </Button>

            <div className="text-center">
              <Link href="/login">
                <a className="text-[#D4AF37] hover:text-[#C19B2B] text-sm flex items-center justify-center gap-2" data-testid="link-back-to-login">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </a>
              </Link>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="p-4 bg-[#0F5132]/20 border border-[#0F5132] rounded-lg">
              <p className="text-[#F8F4E3] text-sm">
                We've sent a password reset link to <strong>{email}</strong>. 
                Please check your inbox and spam folder.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => setSubmitted(false)}
                variant="outline"
                className="w-full border-[#2A2E37] text-[#F8F4E3] hover:bg-[#2A2E37]"
                data-testid="button-try-again"
              >
                Try Different Email
              </Button>

              <Link href="/login">
                <a className="block">
                  <Button
                    variant="ghost"
                    className="w-full text-[#D4AF37] hover:text-[#C19B2B] hover:bg-[#2A2E37]"
                    data-testid="button-back-login"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Login
                  </Button>
                </a>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
