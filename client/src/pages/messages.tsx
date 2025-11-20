import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { App as SendBirdApp } from "@sendbird/uikit-react";
import "@sendbird/uikit-react/dist/index.css";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const SENDBIRD_APP_ID = import.meta.env.VITE_SENDBIRD_APP_ID || "A68E730B-8E56-4655-BCBD-A709F3162376";

interface SendbirdTokenResponse {
  token: string;
  userId: string;
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, params] = useRoute("/messages/:matchId");
  const [, setLocation] = useLocation();
  const matchId = params?.matchId;

  const [sendbirdToken, setSendbirdToken] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(matchId || null);

  // Fetch Sendbird session token
  const { data: tokenData, isLoading: tokenLoading } = useQuery<SendbirdTokenResponse>({
    queryKey: ["/api/sendbird/token"],
    enabled: !!user,
  });

  useEffect(() => {
    if (tokenData?.token) {
      setSendbirdToken(tokenData.token);
    }
  }, [tokenData]);

  useEffect(() => {
    if (matchId) {
      setSelectedChannel(matchId);
    }
  }, [matchId]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please log in to view messages</p>
      </div>
    );
  }

  if (tokenLoading || !sendbirdToken) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Connecting to messaging...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3">
        {selectedChannel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedChannel(null);
              setLocation("/messages");
            }}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-xl font-semibold">Messages</h1>
      </div>

      {/* Sendbird Chat Interface */}
      <div className="flex-1 overflow-hidden sendbird-fusion-theme">
        <SendBirdApp
          appId={SENDBIRD_APP_ID}
          userId={user.id}
          accessToken={sendbirdToken}
          theme="dark"
          config={{
            logLevel: "error",
          }}
        />
      </div>

      {/* Custom Fusion Styling for Sendbird */}
      <style>{`
        .sendbird-fusion-theme {
          --sendbird-light-primary-500: hsl(var(--primary));
          --sendbird-light-primary-400: hsl(var(--primary));
          --sendbird-light-primary-300: hsl(var(--primary) / 0.8);
          --sendbird-dark-primary-500: hsl(var(--primary));
          --sendbird-dark-primary-400: hsl(var(--primary));
          --sendbird-dark-primary-300: hsl(var(--primary) / 0.8);
          
          --sendbird-light-background-50: hsl(var(--background));
          --sendbird-light-background-100: hsl(var(--card));
          --sendbird-light-background-200: hsl(var(--muted));
          --sendbird-dark-background-700: hsl(var(--background));
          --sendbird-dark-background-600: hsl(var(--card));
          --sendbird-dark-background-500: hsl(var(--muted));
          
          --sendbird-light-onlight-01: hsl(var(--foreground));
          --sendbird-light-onlight-02: hsl(var(--muted-foreground));
          --sendbird-light-onlight-03: hsl(var(--muted-foreground) / 0.7);
          --sendbird-dark-ondark-01: hsl(var(--foreground));
          --sendbird-dark-ondark-02: hsl(var(--muted-foreground));
          --sendbird-dark-ondark-03: hsl(var(--muted-foreground) / 0.7);
        }

        /* Hide default Sendbird header since we have our own */
        .sendbird-channel-header {
          display: none !important;
        }

        /* Style channel list items */
        .sendbird-channel-preview {
          border-radius: 0.5rem;
          margin: 0.25rem 0.5rem;
          border: 1px solid hsl(var(--border));
        }

        .sendbird-channel-preview:hover {
          background-color: hsl(var(--muted)) !important;
        }

        /* Style message bubbles */
        .sendbird-message-content__middle__body-container {
          border-radius: 1rem;
        }

        /* Style input area */
        .sendbird-message-input {
          border-top: 1px solid hsl(var(--border));
          background-color: hsl(var(--background));
        }

        .sendbird-message-input-text-field {
          border: 1px solid hsl(var(--border));
          border-radius: 1.5rem;
          background-color: hsl(var(--muted));
        }

        /* Match Fusion's luxury aesthetic */
        .sendbird-conversation__messages {
          font-family: inherit;
        }

        .sendbird-channel-list {
          background-color: hsl(var(--background));
        }
      `}</style>
    </div>
  );
}
