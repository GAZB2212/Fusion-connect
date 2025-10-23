import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, CheckCircle, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
    } else {
      toast({
        title: "Invalid Link",
        description: "This password reset link is invalid or missing the token",
        variant: "destructive",
      });
    }
  }, []);

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      return apiRequest("POST", "/api/reset-password", { token, newPassword });
    },
    onSuccess: () => {
      setResetSuccess(true);
      toast({
        title: "Password Reset",
        description: "Your password has been successfully reset",
      });
      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetPasswordMutation.mutate();
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 bg-[#1A1E27] border-[#2A2E37]">
          <div className="text-center">
            <div className="text-5xl mb-4">🌙</div>
            <h1 className="text-2xl font-bold text-[#F8F4E3] mb-4">Invalid Reset Link</h1>
            <p className="text-[#9CA3AF] mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button
              onClick={() => setLocation("/forgot-password")}
              className="bg-[#D4AF37] hover:bg-[#C19B2B] text-[#0A0E17] font-semibold"
            >
              Request New Link
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-[#1A1E27] border-[#2A2E37]">
        <div className="mb-8 text-center">
          <div className="text-5xl mb-4">🌙</div>
          <h1 className="text-2xl font-bold text-[#F8F4E3] mb-2">Reset Your Password</h1>
          <p className="text-[#9CA3AF]">
            {resetSuccess 
              ? "Your password has been reset successfully"
              : "Enter your new password below"
            }
          </p>
        </div>

        {resetSuccess ? (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <CheckCircle className="h-16 w-16 text-[#0F5132]" />
            </div>
            <div className="text-center">
              <p className="text-[#F8F4E3] mb-2">Password Reset Complete!</p>
              <p className="text-[#9CA3AF] text-sm">
                Redirecting you to login...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="newPassword" className="text-[#F8F4E3]">New Password</Label>
              <div className="relative mt-2">
                <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pl-10 pr-10 bg-[#0A0E17] border-[#2A2E37] text-[#F8F4E3] placeholder:text-[#6B7280]"
                  data-testid="input-new-password-reset"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F8F4E3]"
                  data-testid="button-toggle-new-password"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-1">At least 6 characters</p>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-[#F8F4E3]">Confirm New Password</Label>
              <div className="relative mt-2">
                <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pl-10 pr-10 bg-[#0A0E17] border-[#2A2E37] text-[#F8F4E3] placeholder:text-[#6B7280]"
                  data-testid="input-confirm-password-reset"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F8F4E3]"
                  data-testid="button-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#D4AF37] hover:bg-[#C19B2B] text-[#0A0E17] font-semibold"
              disabled={resetPasswordMutation.isPending || !newPassword || !confirmPassword}
              data-testid="button-reset-password"
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
