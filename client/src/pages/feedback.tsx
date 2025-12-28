import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, MessageSquare, Bug, Lightbulb, HelpCircle, Star, Send, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import type { UserFeedback } from "@shared/schema";

const feedbackSchema = z.object({
  category: z.enum(["bug", "feature", "general", "other"]),
  rating: z.number().min(1).max(5).optional(),
  message: z.string().min(10, "Please provide at least 10 characters").max(2000),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

const categoryIcons = {
  bug: Bug,
  feature: Lightbulb,
  general: MessageSquare,
  other: HelpCircle,
};

const categoryLabels = {
  bug: "Report a Bug",
  feature: "Feature Request",
  general: "General Feedback",
  other: "Other",
};

export default function Feedback() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedRating, setSelectedRating] = useState<number | undefined>();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      category: "general",
      message: "",
    },
  });

  const { data: feedbackHistory = [], isLoading: historyLoading } = useQuery<UserFeedback[]>({
    queryKey: ["/api/feedback"],
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      return apiRequest("POST", "/api/feedback", data);
    },
    onSuccess: () => {
      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted successfully.",
      });
      setSubmitted(true);
      form.reset();
      setSelectedRating(undefined);
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      setTimeout(() => setSubmitted(false), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FeedbackFormData) => {
    submitFeedbackMutation.mutate({
      ...data,
      rating: selectedRating,
    });
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 pt-14">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/settings")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Share Your Feedback</h1>
            <p className="text-muted-foreground">Help us improve your experience</p>
          </div>
        </div>

        {submitted ? (
          <Card className="border-green-500/50 bg-green-500/10">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <h2 className="text-xl font-semibold">Thank You!</h2>
              <p className="text-muted-foreground text-center">
                Your feedback helps us make the app better for everyone.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Submit Feedback
              </CardTitle>
              <CardDescription>
                We value your input. Let us know what you think!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(categoryLabels).map(([value, label]) => {
                              const Icon = categoryIcons[value as keyof typeof categoryIcons];
                              return (
                                <SelectItem key={value} value={value} data-testid={`option-category-${value}`}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    {label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label>Rating (Optional)</Label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSelectedRating(star === selectedRating ? undefined : star)}
                          className="p-1 hover-elevate rounded-md transition-colors"
                          data-testid={`button-rating-${star}`}
                        >
                          <Star
                            className={`h-8 w-8 ${
                              selectedRating && star <= selectedRating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedRating ? `${selectedRating} star${selectedRating > 1 ? "s" : ""}` : "Tap to rate"}
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Feedback</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us what's on your mind..."
                            className="min-h-[150px] resize-none"
                            data-testid="input-feedback-message"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-sm text-muted-foreground text-right">
                          {field.value.length}/2000
                        </p>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={submitFeedbackMutation.isPending}
                    data-testid="button-submit-feedback"
                  >
                    {submitFeedbackMutation.isPending ? (
                      "Submitting..."
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit Feedback
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {feedbackHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Previous Feedback</CardTitle>
              <CardDescription>
                Thank you for helping us improve!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedbackHistory.map((feedback) => {
                const Icon = categoryIcons[feedback.category as keyof typeof categoryIcons] || MessageSquare;
                return (
                  <div
                    key={feedback.id}
                    className="p-4 border rounded-lg space-y-2"
                    data-testid={`feedback-item-${feedback.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium capitalize">{feedback.category}</span>
                        {feedback.rating && (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: feedback.rating }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {feedback.createdAt && formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{feedback.message}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        feedback.status === "resolved" 
                          ? "bg-green-500/10 text-green-500" 
                          : feedback.status === "reviewed"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {feedback.status === "resolved" ? "Resolved" : feedback.status === "reviewed" ? "Under Review" : "Submitted"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
