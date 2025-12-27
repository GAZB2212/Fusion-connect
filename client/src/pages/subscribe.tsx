import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, Zap, Tag } from "lucide-react";
import { useLocation } from "wouter";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activatingDev, setActivatingDev] = useState(false);
  const [checkout, setCheckout] = useState<any>(null);
  const [paymentElement, setPaymentElement] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoCodeApplied, setPromoCodeApplied] = useState(false);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [trialDays, setTrialDays] = useState(0);

  useEffect(() => {
    // Check subscription status first
    apiRequest("GET", "/api/subscription-status")
      .then((res) => res.json())
      .then((statusData) => {
        // If already has active subscription, redirect to matches
        if (statusData.hasActiveSubscription) {
          toast({
            title: "Already Subscribed",
            description: "You already have an active premium subscription!",
          });
          setLocation("/matches");
          return;
        }
        
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Failed to check subscription status:", error);
        setIsLoading(false);
      });
  }, []);

  const applyPromoCode = async () => {
    if (!promoCode.trim()) {
      toast({
        title: "Promo Code Required",
        description: "Please enter a promo code",
        variant: "destructive",
      });
      return;
    }

    setValidatingPromo(true);

    try {
      const response = await apiRequest("POST", "/api/validate-promo-code", {
        promoCode: promoCode.trim(),
      });
      const data = await response.json();

      if (data.valid) {
        toast({
          title: "Promo Code Applied!",
          description: data.message,
        });
        setPromoCodeApplied(true);
        
        // Create checkout session with promo code
        const sessionResponse = await apiRequest("POST", "/api/create-checkout-session", {
          promoCode: promoCode.trim(),
        });
        const sessionData = await sessionResponse.json();
        setClientSecret(sessionData.clientSecret);
        setTrialDays(sessionData.trialDays || 0);
      } else {
        toast({
          title: "Invalid Promo Code",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to validate promo code",
        variant: "destructive",
      });
    } finally {
      setValidatingPromo(false);
    }
  };

  const continueWithoutPromo = async () => {
    try {
      const sessionResponse = await apiRequest("POST", "/api/create-checkout-session");
      const sessionData = await sessionResponse.json();
      setClientSecret(sessionData.clientSecret);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to create checkout session",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!clientSecret) return;

    const initializeCheckout = async () => {
      const stripe = await stripePromise;
      if (!stripe) return;

      // Initialize Checkout with custom UI mode
      const checkoutInstance = await stripe.initCheckout({
        clientSecret,
      });

      setCheckout(checkoutInstance);

      // Load the checkout actions
      const loadActionsResult = await checkoutInstance.loadActions();
      
      if (loadActionsResult.type === 'success') {
        const { actions } = loadActionsResult;
        const sessionData = actions.getSession();
        setSession(sessionData);

        // Create and mount Payment Element
        const paymentElementInstance = checkoutInstance.createPaymentElement();
        paymentElementInstance.mount('#payment-element');
        setPaymentElement(paymentElementInstance);
      }
    };

    initializeCheckout();
  }, [clientSecret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkout) {
      return;
    }

    setIsProcessing(true);

    const loadActionsResult = await checkout.loadActions();
    if (loadActionsResult.type === 'success') {
      const { actions } = loadActionsResult;
      const result = await actions.confirm();

      if (result.type === 'error') {
        toast({
          title: "Payment Failed",
          description: result.error.message,
          variant: "destructive",
        });
        setIsProcessing(false);
      } else {
        // Payment successful - webhook will handle activation
        toast({
          title: "Payment Processing",
          description: "Your subscription is being activated...",
        });
        
        // Wait a moment for webhook to process, then redirect
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/subscription-status"] });
          setLocation("/matches");
        }, 2000);
      }
    } else {
      setIsProcessing(false);
    }
  };

  const activateDevPremium = async () => {
    setActivatingDev(true);
    try {
      await apiRequest("POST", "/api/dev/activate-premium", {});
      await queryClient.invalidateQueries({ queryKey: ["/api/subscription-status"] });
      toast({
        title: "Premium Activated!",
        description: "Dev mode: You now have premium access for testing.",
      });
      setLocation("/matches");
    } catch (error: any) {
      toast({
        title: "Activation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActivatingDev(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] golden-shimmer">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-[#F8F4E3]/70">Setting up your subscription...</p>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] golden-shimmer">
        <Card className="w-full max-w-md bg-[#0A0E17] border-white/10">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-[#F8F4E3] font-serif mb-2">
              Subscribe to Fusion Premium
            </CardTitle>
            <CardDescription className="text-[#F8F4E3]/70">
              Have an early access promo code? Enter it below to get 2 months free!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-[#F8F4E3]/70 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Promo Code (Optional)
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="FUSION-XXXXX"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="bg-[#0E1220] border-white/10 text-[#F8F4E3] placeholder:text-[#F8F4E3]/40"
                  data-testid="input-promo-code"
                  disabled={validatingPromo}
                />
                <Button
                  onClick={applyPromoCode}
                  disabled={validatingPromo || !promoCode.trim()}
                  variant="outline"
                  data-testid="button-apply-promo"
                >
                  {validatingPromo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
              <p className="text-xs text-[#F8F4E3]/50">
                Early access members get 2 months free with their promo code
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0A0E17] px-2 text-[#F8F4E3]/50">or</span>
              </div>
            </div>

            <Button
              onClick={continueWithoutPromo}
              className="w-full"
              size="lg"
              data-testid="button-continue-without-promo"
            >
              Continue Without Promo Code
            </Button>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <div className="w-full border-t border-white/10 my-2"></div>
            <Button 
              onClick={activateDevPremium}
              disabled={activatingDev}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-dev-activate"
            >
              {activatingDev ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Dev Mode: Activate Premium
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pt-14 bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] golden-shimmer">
      <Card className="w-full max-w-2xl bg-[#0A0E17] border-white/10">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-[#F8F4E3] font-serif mb-2">
            Unlock Fusion Premium
          </CardTitle>
          <CardDescription className="text-[#F8F4E3]/70 text-lg">
            Get full access to view and connect with your matches
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Benefits */}
          <div className="space-y-3 py-4 border-y border-white/10">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#F8F4E3] font-medium">View All Your Matches</p>
                <p className="text-[#F8F4E3]/60 text-sm">See everyone who swiped right on you</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#F8F4E3] font-medium">Unlimited Messaging</p>
                <p className="text-[#F8F4E3]/60 text-sm">Chat with all your matches without limits</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#F8F4E3] font-medium">Video Calling</p>
                <p className="text-[#F8F4E3]/60 text-sm">Connect face-to-face with your matches</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#F8F4E3] font-medium">Chaperone Support</p>
                <p className="text-[#F8F4E3]/60 text-sm">Add your Wali or guardian to conversations</p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="text-center py-4">
            <div className="inline-block">
              {trialDays > 0 && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-2 mb-4">
                  <p className="text-primary font-semibold">
                    🎉 Promo Code Applied!
                  </p>
                  <p className="text-[#F8F4E3]/70 text-sm">
                    {trialDays} days free, then £9.99/month
                  </p>
                </div>
              )}
              <div className="text-5xl font-bold text-primary mb-2 font-serif">£9.99</div>
              <div className="text-[#F8F4E3]/70">per month</div>
              <div className="text-[#F8F4E3]/50 text-sm mt-1">Cancel anytime</div>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div id="payment-element" data-testid="payment-element"></div>
            
            <Button 
              type="submit" 
              disabled={!checkout || isProcessing} 
              className="w-full"
              size="lg"
              data-testid="button-subscribe"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : trialDays > 0 ? (
                `Start ${trialDays}-Day Free Trial`
              ) : (
                'Subscribe for £9.99/month'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <div className="space-y-2 text-center">
            <p className="text-xs text-[#F8F4E3]/50">
              {trialDays > 0 ? (
                <>
                  After your {trialDays}-day free trial, your subscription will automatically renew each month at £9.99. You can cancel anytime from Settings → Manage Subscription. No refunds for partial months.
                </>
              ) : (
                <>
                  Your subscription will automatically renew each month at £9.99. You can cancel anytime from Settings → Manage Subscription. No refunds for partial months.
                </>
              )}
            </p>
            <p className="text-xs text-[#F8F4E3]/40">
              By subscribing, you agree to our{" "}
              <button
                type="button"
                onClick={() => window.open("/terms-of-service", "_blank")}
                className="text-primary hover:underline"
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={() => window.open("/privacy-policy", "_blank")}
                className="text-primary hover:underline"
              >
                Privacy Policy
              </button>
            </p>
          </div>
          <div className="w-full border-t border-white/10 my-2"></div>
          <p className="text-xs text-[#F8F4E3]/40 text-center mb-2">Development Mode</p>
          <Button 
            onClick={activateDevPremium}
            disabled={activatingDev}
            variant="outline"
            className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            data-testid="button-dev-activate-footer"
          >
            {activatingDev ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Skip Payment (Dev Mode)
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
