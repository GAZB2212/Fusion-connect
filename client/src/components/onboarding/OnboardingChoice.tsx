import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, ClipboardList, CheckCircle2, ArrowRight } from "lucide-react";

interface OnboardingChoiceProps {
  onChooseFast: () => void;
  onChooseStandard: () => void;
}

export function OnboardingChoice({ onChooseFast, onChooseStandard }: OnboardingChoiceProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-foreground">Welcome to Fusion!</h1>
          <p className="text-muted-foreground text-lg">
            Choose how you'd like to set up your profile
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card
            className="p-6 hover-elevate cursor-pointer border-2 border-primary/20 hover:border-primary/50 transition-all relative overflow-hidden group"
            onClick={onChooseFast}
            data-testid="card-fast-setup"
          >
            <div className="absolute top-3 right-3">
              <div className="bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded-full">
                Recommended
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">Fast Setup</h2>
                <p className="text-sm text-muted-foreground">AI-guided conversation (3 mins)</p>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Quick and conversational</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Natural chat experience</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Switch to forms anytime</span>
                </li>
              </ul>
              <Button className="w-full group-hover:bg-primary/90" data-testid="button-start-fast">
                Start Fast Setup
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>

          <Card
            className="p-6 hover-elevate cursor-pointer border-2 border-border hover:border-muted-foreground/30 transition-all"
            onClick={onChooseStandard}
            data-testid="card-standard-setup"
          >
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
                <ClipboardList className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">Standard Setup</h2>
                <p className="text-sm text-muted-foreground">Traditional step-by-step forms</p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Full control over each field</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>See all options at once</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Detailed customization</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full" data-testid="button-start-standard">
                Continue with Forms
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          You can switch to standard forms anytime during Fast Setup
        </p>
      </div>
    </div>
  );
}
