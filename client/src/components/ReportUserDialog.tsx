import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertTriangle } from "lucide-react";

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function ReportUserDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: ReportUserDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>("harassment");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast({
        title: "Reason required",
        description: "Please select a reason for reporting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest(`/api/users/${userId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason, details }),
      });

      toast({
        title: "Report submitted",
        description: "Thank you for helping keep Fusion safe. We'll review this report.",
      });

      onOpenChange(false);
      setReason("harassment");
      setDetails("");
    } catch (error: any) {
      toast({
        title: "Failed to submit report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-report-user">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Report {userName}</DialogTitle>
              <DialogDescription className="mt-1">
                Help us understand what's wrong
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason for reporting
            </Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="harassment" id="harassment" data-testid="radio-harassment" />
                <Label htmlFor="harassment" className="font-normal cursor-pointer">
                  Harassment or bullying
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="inappropriate_content"
                  id="inappropriate_content"
                  data-testid="radio-inappropriate"
                />
                <Label htmlFor="inappropriate_content" className="font-normal cursor-pointer">
                  Inappropriate content
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fake_profile" id="fake_profile" data-testid="radio-fake" />
                <Label htmlFor="fake_profile" className="font-normal cursor-pointer">
                  Fake or misleading profile
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="spam" id="spam" data-testid="radio-spam" />
                <Label htmlFor="spam" className="font-normal cursor-pointer">
                  Spam or scam
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="other" data-testid="radio-other" />
                <Label htmlFor="other" className="font-normal cursor-pointer">
                  Other
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details" className="text-sm font-medium">
              Additional details (optional)
            </Label>
            <Textarea
              id="details"
              placeholder="Provide any additional information that might help us..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              maxLength={500}
              className="resize-none"
              data-testid="textarea-details"
            />
            <p className="text-xs text-muted-foreground text-right">
              {details.length}/500
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            data-testid="button-cancel-report"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-testid="button-submit-report"
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
