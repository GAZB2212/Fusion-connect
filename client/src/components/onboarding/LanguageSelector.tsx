import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { languageOptions, type SupportedLanguage } from "@/lib/i18n/onboarding";
import { Globe } from "lucide-react";

interface LanguageSelectorProps {
  onSelect: (language: SupportedLanguage) => void;
  currentLanguage?: SupportedLanguage;
  showTitle?: boolean;
}

export function LanguageSelector({
  onSelect,
  currentLanguage,
  showTitle = true,
}: LanguageSelectorProps) {
  return (
    <Card className="p-6 max-w-md mx-auto">
      <div className="space-y-6">
        {showTitle && (
          <div className="text-center space-y-2">
            <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Welcome to Fusion</h2>
            <p className="text-sm text-muted-foreground">
              Choose your preferred language
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {languageOptions.map((lang) => (
            <Button
              key={lang.code}
              variant={currentLanguage === lang.code ? "default" : "outline"}
              className="w-full justify-start gap-3 h-14 text-left"
              onClick={() => onSelect(lang.code)}
              data-testid={`button-lang-${lang.code}`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <div className="flex flex-col items-start">
                <span className="font-medium">{lang.nativeName}</span>
                <span className="text-xs text-muted-foreground">
                  {lang.name}
                </span>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}

interface LanguageToggleProps {
  currentLanguage: SupportedLanguage;
  onToggle: () => void;
}

export function LanguageToggle({
  currentLanguage,
  onToggle,
}: LanguageToggleProps) {
  const current = languageOptions.find((l) => l.code === currentLanguage);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="gap-1"
      data-testid="button-change-language"
    >
      <span>{current?.flag}</span>
      <span className="text-xs">{current?.code.toUpperCase()}</span>
    </Button>
  );
}
