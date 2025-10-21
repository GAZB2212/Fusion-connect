import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/ChatGPT Image Oct 20, 2025 at 10_42_27 PM_1760996558103.png";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      toast({
        title: "Welcome to Fusion!",
        description: "Your account has been created successfully.",
      });

      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center px-4 py-12 islamic-pattern">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-6">
            <img src={logoImage} alt="Fusion Logo" className="h-24 w-auto" />
          </div>
          <h1 className="text-3xl font-bold mb-3 text-[#F8F4E3] font-serif">Create Your Account</h1>
          <p className="text-[#F8F4E3]/70">Join thousands finding meaningful connections</p>
        </div>

        <Card className="p-8 bg-[#0E1220] border-[#F8F4E3]/20">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="text-sm font-medium mb-2 block text-[#F8F4E3]">
                  First Name
                </label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="First"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  data-testid="input-firstname"
                  className="bg-[#0A0E17]/50 border-[#F8F4E3]/20 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40 focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="text-sm font-medium mb-2 block text-[#F8F4E3]">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Last"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  data-testid="input-lastname"
                  className="bg-[#0A0E17]/50 border-[#F8F4E3]/20 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="text-sm font-medium mb-2 block text-[#F8F4E3]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                data-testid="input-email"
                className="bg-[#0A0E17]/50 border-[#F8F4E3]/20 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40 focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium mb-2 block text-[#F8F4E3]">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                data-testid="input-password"
                className="bg-[#0A0E17]/50 border-[#F8F4E3]/20 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40 focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="text-sm font-medium mb-2 block text-[#F8F4E3]">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                data-testid="input-confirm-password"
                className="bg-[#0A0E17]/50 border-[#F8F4E3]/20 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40 focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              className="w-full shadow-lg shadow-primary/20"
              disabled={isLoading}
              data-testid="button-signup"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-[#F8F4E3]/70">
              Already have an account?{" "}
              <button
                onClick={() => setLocation("/login")}
                className="text-primary font-semibold hover:underline"
                data-testid="link-login"
              >
                Sign In
              </button>
            </p>
          </div>
        </Card>

        <p className="text-center text-xs text-[#F8F4E3]/50 mt-6">
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
