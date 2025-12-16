import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { OnboardingChoice } from "@/components/onboarding/OnboardingChoice";
import { FastOnboardingChat } from "@/components/onboarding/FastOnboardingChat";
import { OnboardingReview } from "@/components/onboarding/OnboardingReview";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ExtractedData } from "@/lib/onboarding/prompts";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type OnboardingStep = "choice" | "chat" | "review";

export default function FastOnboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<OnboardingStep>("choice");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [existingConversation, setExistingConversation] = useState<any>(null);

  // Check for existing conversation
  const { data: conversationData, isLoading } = useQuery<{
    exists: boolean;
    conversation?: any;
  }>({
    queryKey: ["/api/onboarding/conversation"],
    retry: false,
  });

  useEffect(() => {
    if (conversationData?.exists && conversationData?.conversation) {
      setExistingConversation(conversationData.conversation);
      setShowResumeDialog(true);
    }
  }, [conversationData]);

  const completeMutation = useMutation({
    mutationFn: async (data: ExtractedData) => {
      const response = await apiRequest("POST", "/api/onboarding/complete", {
        profileData: data,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile saved!",
        description: "Now let's add some photos to complete your profile.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      // Redirect to profile setup to add photos (skip to photo step)
      setLocation("/?fastOnboardingComplete=true");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearConversationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/onboarding/conversation");
      return response.json();
    },
  });

  const handleChooseFast = () => {
    setStep("chat");
  };

  const handleChooseStandard = () => {
    // Go to standard profile setup
    setLocation("/?onboardingMethod=standard");
  };

  const handleChatComplete = (data: ExtractedData) => {
    setExtractedData(data);
    setStep("review");
  };

  const handleExitToForms = () => {
    // Save progress and exit to standard forms
    toast({
      title: "Switching to forms",
      description: "Your progress has been saved. Continue with standard forms.",
    });
    setLocation("/?onboardingMethod=standard");
  };

  const handleConfirmProfile = () => {
    if (extractedData) {
      completeMutation.mutate(extractedData);
    }
  };

  const handleEditField = (field: keyof ExtractedData) => {
    // For now, go back to chat to make edits
    // In a more advanced version, we could jump to specific questions
    setStep("chat");
    toast({
      title: "Edit mode",
      description: `You can update your ${field} in the chat.`,
    });
  };

  const handleStartOver = async () => {
    await clearConversationMutation.mutateAsync();
    setExtractedData(null);
    setStep("choice");
  };

  const handleResumeConversation = () => {
    setShowResumeDialog(false);
    if (existingConversation?.extractedData) {
      // If we have extracted data, might be able to go to review
      const data = existingConversation.extractedData as ExtractedData;
      if (data.firstName && data.age && data.city) {
        setExtractedData(data);
        setStep("review");
      } else {
        setStep("chat");
      }
    } else {
      setStep("chat");
    }
  };

  const handleStartFresh = async () => {
    setShowResumeDialog(false);
    await clearConversationMutation.mutateAsync();
    setStep("choice");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {step === "choice" && (
        <OnboardingChoice
          onChooseFast={handleChooseFast}
          onChooseStandard={handleChooseStandard}
        />
      )}

      {step === "chat" && (
        <FastOnboardingChat
          onComplete={handleChatComplete}
          onExitToForms={handleExitToForms}
        />
      )}

      {step === "review" && extractedData && (
        <OnboardingReview
          data={extractedData}
          onConfirm={handleConfirmProfile}
          onEdit={handleEditField}
          onStartOver={handleStartOver}
          isSubmitting={completeMutation.isPending}
        />
      )}

      {/* Resume Dialog */}
      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Continue where you left off?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unfinished profile setup. Would you like to continue from where you left off?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStartFresh}>
              Start Fresh
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResumeConversation}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
