import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function SubscribeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/matches`,
      },
    });

    setIsProcessing(false);

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Subscription Successful",
        description: "Welcome to Fusion Premium! You can now view your matches.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full"
        size="lg"
        data-testid="button-subscribe"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          'Subscribe for £9.99/month'
        )}
      </Button>
    </form>
  );
}

export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiRequest("POST", "/api/create-subscription")
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Failed to create subscription:", error);
        setIsLoading(false);
      });
  }, []);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] golden-shimmer">
        <Card className="w-full max-w-md bg-[#0A0E17] border-white/10">
          <CardHeader>
            <CardTitle className="text-[#F8F4E3]">Subscription Error</CardTitle>
            <CardDescription className="text-[#F8F4E3]/70">
              Unable to create subscription. Please try again later.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="w-full"
              data-testid="button-retry"
            >
              Retry
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-black via-[#0A0E17] to-[#0E1220] golden-shimmer">
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
                <p className="text-[#F8F4E3] font-medium">Chaperone Support</p>
                <p className="text-[#F8F4E3]/60 text-sm">Add your Wali or guardian to conversations</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#F8F4E3] font-medium">Privacy Controls</p>
                <p className="text-[#F8F4E3]/60 text-sm">Control who sees your photos and profile</p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="text-center py-4">
            <div className="inline-block">
              <div className="text-5xl font-bold text-primary mb-2 font-serif">£9.99</div>
              <div className="text-[#F8F4E3]/70">per month</div>
              <div className="text-[#F8F4E3]/50 text-sm mt-1">Cancel anytime</div>
            </div>
          </div>

          {/* Payment Form */}
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <SubscribeForm />
          </Elements>
        </CardContent>

        <CardFooter className="flex-col gap-2">
          <p className="text-xs text-[#F8F4E3]/50 text-center">
            Your subscription will automatically renew each month. You can cancel at any time from your settings.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
