import { useState, useRef, useCallback } from "react";
import { IOSSpinner } from "@/components/ios-spinner";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
}

export function PullToRefresh({ children, onRefresh, className }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      const resistance = 0.4;
      setPullDistance(Math.min(diff * resistance, THRESHOLD * 1.5));
    }
  }, [isPulling, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(60);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    
    setIsPulling(false);
  }, [isPulling, pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="absolute left-0 right-0 flex justify-center transition-transform duration-200"
        style={{
          transform: `translateY(${pullDistance - 50}px)`,
          opacity: Math.min(pullDistance / THRESHOLD, 1),
        }}
      >
        <div className={cn(
          "bg-background/80 backdrop-blur-sm rounded-full p-2 shadow-lg",
          isRefreshing && "animate-pulse"
        )}>
          <IOSSpinner 
            size="sm" 
            className={cn(
              "text-primary transition-transform",
              pullDistance >= THRESHOLD && "scale-110"
            )} 
          />
        </div>
      </div>
      
      <div
        className="transition-transform duration-200"
        style={{ transform: `translateY(${isRefreshing ? 60 : pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
