import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/logo 40_1761066001045.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });

      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center px-4 islamic-pattern">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-6">
            <img src={logoImage} alt="Fusion Logo" className="h-24 w-auto" />
          </div>
          <h1 className="text-3xl font-bold mb-3 text-[#F8F4E3] font-serif">Welcome Back</h1>
          <p className="text-[#F8F4E3]/70">Sign in to continue your journey</p>
        </div>

        <Card className="p-8 bg-[#0E1220] border-[#F8F4E3]/20">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="text-sm font-medium mb-2 block text-[#F8F4E3]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
                className="bg-[#0A0E17]/50 border-[#F8F4E3]/20 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40 focus:border-primary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="text-sm font-medium text-[#F8F4E3]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setLocation("/forgot-password")}
                  className="text-xs text-primary hover:underline"
                  data-testid="link-forgot-password"
                >
                  Forgot Password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
                className="bg-[#0A0E17]/50 border-[#F8F4E3]/20 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40 focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              className="w-full shadow-lg shadow-primary/20"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-[#F8F4E3]/70">
              Don't have an account?{" "}
              <button
                onClick={() => setLocation("/signup")}
                className="text-primary font-semibold hover:underline"
                data-testid="link-signup"
              >
                Sign Up
              </button>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
