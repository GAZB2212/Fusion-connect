import { Heart, Users, MessageSquare, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { isCallActive } = useVideoCall();

  const navItems = [
    { icon: Heart, label: "Discover", path: "/", testId: "nav-discover" },
    { icon: Sparkles, label: "For You", path: "/suggestions", testId: "nav-suggestions" },
    { icon: Users, label: "Matches", path: "/matches", testId: "nav-matches" },
    { icon: MessageSquare, label: "Messages", path: "/messages", testId: "nav-messages" },
    { icon: SettingsIcon, label: "Settings", path: "/settings", testId: "nav-settings" },
  ];

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-background border-t",
        "transition-transform duration-300 ease-in-out",
        isCallActive ? "translate-y-full" : "translate-y-0"
      )}
      data-testid="bottom-nav"
    >
      <div className="container max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path === "/messages" && location.startsWith("/messages/"));
            return (
              <Button
                key={item.path}
                variant="ghost"
                className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
                onClick={() => setLocation(item.path)}
                data-testid={item.testId}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'fill-primary' : ''}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
