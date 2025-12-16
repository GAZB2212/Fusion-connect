import { Progress } from "@/components/ui/progress";
import { QUESTIONS } from "@/lib/onboarding/prompts";

interface OnboardingProgressProps {
  currentQuestion: number;
}

export function OnboardingProgress({ currentQuestion }: OnboardingProgressProps) {
  const totalQuestions = QUESTIONS.length;
  const progress = Math.min((currentQuestion / totalQuestions) * 100, 100);

  return (
    <div className="space-y-2 px-4 py-3 border-b bg-background">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Profile Setup</span>
        <span className="text-muted-foreground">
          Question {Math.min(currentQuestion, totalQuestions)} of {totalQuestions}
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
