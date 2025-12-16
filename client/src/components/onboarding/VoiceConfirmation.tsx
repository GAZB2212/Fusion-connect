import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Pencil, Mic } from "lucide-react";

interface VoiceConfirmationProps {
  transcript: string;
  onConfirm: () => void;
  onRetry: () => void;
  onType: () => void;
  isProcessing?: boolean;
  language?: string;
}

const translations: Record<string, { heard: string; correct: string; confirm: string; edit: string; retry: string }> = {
  en: {
    heard: "I heard you say:",
    correct: "Is this correct?",
    confirm: "Yes, that's right",
    edit: "No, let me type",
    retry: "Try voice again",
  },
  ur: {
    heard: "میں نے سنا:",
    correct: "کیا یہ صحیح ہے؟",
    confirm: "ہاں، یہ صحیح ہے",
    edit: "نہیں، ٹائپ کرتا ہوں",
    retry: "دوبارہ کوشش کریں",
  },
  ar: {
    heard: "سمعتك تقول:",
    correct: "هل هذا صحيح؟",
    confirm: "نعم، هذا صحيح",
    edit: "لا، دعني أكتب",
    retry: "حاول الصوت مرة أخرى",
  },
  bn: {
    heard: "আমি শুনেছি:",
    correct: "এটা কি সঠিক?",
    confirm: "হ্যাঁ, এটা ঠিক",
    edit: "না, টাইপ করি",
    retry: "আবার ভয়েস চেষ্টা করুন",
  },
};

export function VoiceConfirmation({
  transcript,
  onConfirm,
  onRetry,
  onType,
  isProcessing = false,
  language = "en",
}: VoiceConfirmationProps) {
  const t = translations[language] || translations.en;
  const isRTL = language === "ar" || language === "ur";

  return (
    <Card
      className="p-4 space-y-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t.heard}</p>
        <div className="bg-muted rounded-lg p-3">
          <p className="text-base font-medium">"{transcript}"</p>
        </div>
        <p className="text-sm text-muted-foreground">{t.correct}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={onConfirm}
          disabled={isProcessing}
          className="w-full"
          data-testid="button-confirm-voice"
        >
          <Check className="h-4 w-4 mr-2" />
          {t.confirm}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onType}
            disabled={isProcessing}
            className="flex-1"
            data-testid="button-type-instead"
          >
            <Pencil className="h-4 w-4 mr-2" />
            {t.edit}
          </Button>
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isProcessing}
            className="flex-1"
            data-testid="button-retry-voice"
          >
            <Mic className="h-4 w-4 mr-2" />
            {t.retry}
          </Button>
        </div>
      </div>
    </Card>
  );
}
