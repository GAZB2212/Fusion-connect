import { Heart, Users, MessageSquare, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { isCallActive } = useVideoCall();
  const { t } = useTranslation();

  const navItems = [
    { icon: Heart, label: t('nav.discover'), path: "/", testId: "nav-discover" },
    { icon: Sparkles, label: t('nav.forYou', 'For You'), path: "/suggestions", testId: "nav-suggestions" },
    { icon: Users, label: t('nav.matches'), path: "/matches", testId: "nav-matches" },
    { icon: MessageSquare, label: t('nav.messages'), path: "/messages", testId: "nav-messages" },
    { icon: SettingsIcon, label: t('nav.settings', 'Settings'), path: "/settings", testId: "nav-settings" },
  ];

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "bg-background/80 backdrop-blur-xl border-t border-border/50",
        "transition-transform duration-300 ease-in-out",
        isCallActive ? "translate-y-full" : "translate-y-0"
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="bottom-nav"
    >
      <div className="container max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path === "/messages" && location.startsWith("/messages/"));
            return (
              <button
                key={item.path}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 px-4 rounded-lg",
                  "transition-all duration-150 active:scale-95",
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                onClick={() => setLocation(item.path)}
                data-testid={item.testId}
              >
                <item.icon className={cn("h-6 w-6", isActive && 'fill-primary')} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
