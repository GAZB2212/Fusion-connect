import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Edit3, RotateCcw, ArrowRight } from "lucide-react";
import type { ExtractedData } from "@/lib/onboarding/prompts";

interface OnboardingReviewProps {
  data: ExtractedData;
  onConfirm: () => void;
  onEdit: (field: keyof ExtractedData) => void;
  onStartOver: () => void;
  isSubmitting?: boolean;
}

const FIELD_LABELS: Record<keyof ExtractedData, string> = {
  firstName: "Name",
  gender: "Gender",
  age: "Age",
  city: "Location",
  ethnicity: "Ethnicity",
  maritalStatus: "Marital Status",
  hasChildren: "Has Children",
  numberOfChildren: "Number of Children",
  wantsChildren: "Wants Children",
  education: "Education",
  occupation: "Occupation",
  sect: "Sect",
  prayerFrequency: "Prayer Frequency",
  religiosityRaw: "Religious Practice",
  bio: "About You",
  lookingForDescription: "Looking For",
};

const MARITAL_STATUS_LABELS: Record<string, string> = {
  never_married: "Never married",
  divorced: "Divorced",
  widowed: "Widowed",
};

const WANTS_CHILDREN_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  open: "Open to it",
};

function formatValue(field: keyof ExtractedData, value: any): string {
  if (value === null || value === undefined) return "Not provided";
  
  if (field === "gender" && typeof value === "string") {
    return value === "male" ? "Brother" : "Sister";
  }
  
  if (field === "maritalStatus" && typeof value === "string") {
    return MARITAL_STATUS_LABELS[value] || value;
  }
  
  if (field === "wantsChildren" && typeof value === "string") {
    return WANTS_CHILDREN_LABELS[value] || value;
  }
  
  if (field === "hasChildren") {
    return value ? "Yes" : "No";
  }
  
  if (field === "age") {
    return `${value} years old`;
  }
  
  return String(value);
}

export function OnboardingReview({ 
  data, 
  onConfirm, 
  onEdit, 
  onStartOver,
  isSubmitting = false 
}: OnboardingReviewProps) {
  const fields = Object.keys(FIELD_LABELS) as (keyof ExtractedData)[];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2 pt-8">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold">Review Your Profile</h1>
          <p className="text-muted-foreground">
            Make sure everything looks right before we save
          </p>
        </div>

        <Card className="divide-y">
          {fields.map((field) => {
            const value = data[field];
            const hasValue = value !== null && value !== undefined;
            
            return (
              <div
                key={field}
                className="flex items-center justify-between p-4 group hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {FIELD_LABELS[field]}
                  </p>
                  <p className={hasValue ? "font-medium" : "text-muted-foreground italic"}>
                    {formatValue(field, value)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onEdit(field)}
                  data-testid={`button-edit-${field}`}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </Card>

        <div className="space-y-3 pt-4">
          <Button
            className="w-full h-12 text-lg"
            onClick={onConfirm}
            disabled={isSubmitting}
            data-testid="button-confirm-profile"
          >
            {isSubmitting ? (
              "Saving..."
            ) : (
              <>
                Looks Good, Save Profile
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onClick={onStartOver}
            disabled={isSubmitting}
            data-testid="button-start-over"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Start Over
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-8">
          You can always update your profile later in Settings
        </p>
      </div>
    </div>
  );
}
