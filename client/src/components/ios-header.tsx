import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface IOSHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backPath?: string;
  rightElement?: React.ReactNode;
  className?: string;
  large?: boolean;
}

export function IOSHeader({ 
  title, 
  subtitle, 
  showBack = false, 
  backPath,
  rightElement,
  className,
  large = true
}: IOSHeaderProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (backPath) {
      setLocation(backPath);
    } else {
      window.history.back();
    }
  };

  return (
    <header 
      className={cn(
        "sticky top-0 z-30 pt-14",
        "bg-background/80 backdrop-blur-xl border-b border-border/50",
        className
      )}
      data-testid="ios-header"
    >
      <div className="px-4 pb-3">
        {showBack && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-primary mb-2 -ml-1 active:scale-95 transition-transform"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-[17px]">Back</span>
          </button>
        )}
        
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 
              className={cn(
                "font-bold text-foreground tracking-tight truncate",
                large ? "text-[34px] leading-tight" : "text-xl"
              )}
              data-testid="text-page-title"
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-muted-foreground text-sm mt-0.5 truncate" data-testid="text-page-subtitle">
                {subtitle}
              </p>
            )}
          </div>
          
          {rightElement && (
            <div className="flex-shrink-0">
              {rightElement}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
