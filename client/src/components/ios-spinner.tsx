import { cn } from "@/lib/utils";

interface IOSSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function IOSSpinner({ size = "md", className }: IOSSpinnerProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)} data-testid="ios-spinner">
      <div className="absolute inset-0">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-[8%] h-[24%] bg-current rounded-full left-1/2 top-1/2 origin-[50%_150%]"
            style={{
              transform: `rotate(${i * 30}deg) translateY(-130%)`,
              opacity: 1 - (i * 0.07),
              animation: `ios-spinner 1s linear infinite`,
              animationDelay: `${-i * (1/12)}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function IOSLoadingScreen({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background" data-testid="ios-loading-screen">
      <IOSSpinner size="lg" className="text-primary mb-4" />
      {message && (
        <p className="text-muted-foreground text-sm animate-pulse">{message}</p>
      )}
    </div>
  );
}
