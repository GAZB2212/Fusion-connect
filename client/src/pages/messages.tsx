import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import SendbirdProvider from "@sendbird/uikit-react/SendbirdProvider";
import ChannelList from "@sendbird/uikit-react/ChannelList";
import Channel from "@sendbird/uikit-react/Channel";
import "@sendbird/uikit-react/dist/index.css";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const SENDBIRD_APP_ID = import.meta.env.VITE_SENDBIRD_APP_ID || "A68E730B-8E56-4655-BCBD-A709F3162376";

interface SendbirdTokenResponse {
  token: string;
  userId: string;
}

export default function Messages() {
  const { user } = useAuth();
  const [, params] = useRoute("/messages/:matchId");
  const [, setLocation] = useLocation();
  const matchId = params?.matchId;

  const [sendbirdToken, setSendbirdToken] = useState<string | null>(null);
  const [selectedChannelUrl, setSelectedChannelUrl] = useState<string | null>(matchId || null);

  const { data: tokenData, isLoading: tokenLoading } = useQuery<SendbirdTokenResponse>({
    queryKey: ["/api/sendbird/token"],
    enabled: !!user,
  });

  useEffect(() => {
    if (user) {
      const hasBackfilled = sessionStorage.getItem('channels_backfilled');
      if (!hasBackfilled) {
        fetch('/api/dev/backfill-channels', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
          .then(r => r.json())
          .then(result => {
            console.log('[Messages] Channel backfill complete:', result);
            sessionStorage.setItem('channels_backfilled', 'true');
          })
          .catch(err => {
            console.error('[Messages] Channel backfill failed:', err);
          });
      }
    }
  }, [user]);

  useEffect(() => {
    if (tokenData?.token) {
      setSendbirdToken(tokenData.token);
    }
  }, [tokenData]);

  useEffect(() => {
    if (matchId) {
      setSelectedChannelUrl(matchId);
    }
  }, [matchId]);

  const handleChannelSelect = (channel: any) => {
    if (channel?.url) {
      setSelectedChannelUrl(channel.url);
      setLocation(`/messages/${channel.url}`);
    }
  };

  const handleBackToList = () => {
    setSelectedChannelUrl(null);
    setLocation("/messages");
  };

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
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <SendbirdProvider
        appId={SENDBIRD_APP_ID}
        userId={user.id}
        accessToken={sendbirdToken}
        theme="dark"
      >
        <div className="flex-1 flex overflow-hidden sendbird-fusion-theme">
          {/* Channel List - hidden on mobile when conversation is open */}
          <div className={`w-full md:w-80 md:flex-shrink-0 md:border-r ${selectedChannelUrl ? 'hidden md:block' : 'block'}`}>
            <div className="h-full flex flex-col">
              <div className="border-b px-4 py-3">
                <h1 className="text-xl font-semibold">Messages</h1>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChannelList
                  onChannelSelect={handleChannelSelect}
                />
              </div>
            </div>
          </div>

          {/* Conversation - full width on mobile, shown when channel selected */}
          <div className={`flex-1 flex flex-col ${selectedChannelUrl ? 'block' : 'hidden md:flex'}`}>
            {selectedChannelUrl ? (
              <>
                <div className="border-b px-4 py-3 flex items-center gap-3 md:hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToList}
                    data-testid="button-back"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <span className="font-medium">Back to messages</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Channel channelUrl={selectedChannelUrl} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation to start messaging
              </div>
            )}
          </div>
        </div>
      </SendbirdProvider>

      <style>{`
        .sendbird-fusion-theme {
          --sendbird-dark-primary-500: hsl(var(--primary));
          --sendbird-dark-primary-400: hsl(var(--primary));
          --sendbird-dark-primary-300: hsl(var(--primary) / 0.8);
          --sendbird-dark-background-700: hsl(var(--background));
          --sendbird-dark-background-600: hsl(var(--card));
          --sendbird-dark-background-500: hsl(var(--muted));
          --sendbird-dark-ondark-01: hsl(var(--foreground));
          --sendbird-dark-ondark-02: hsl(var(--muted-foreground));
          --sendbird-dark-ondark-03: hsl(var(--muted-foreground) / 0.7);
        }

        .sendbird-channel-list {
          width: 100% !important;
          height: 100% !important;
          background-color: hsl(var(--background)) !important;
        }

        .sendbird-channel-list__header {
          display: none !important;
        }

        .sendbird-channel-preview {
          border-radius: 0.5rem;
          margin: 0.25rem 0.5rem;
          border: 1px solid hsl(var(--border));
        }

        .sendbird-channel-preview:hover {
          background-color: hsl(var(--muted)) !important;
        }

        .sendbird-conversation {
          width: 100% !important;
          height: 100% !important;
        }

        .sendbird-conversation__messages {
          background-color: hsl(var(--background)) !important;
        }

        .sendbird-message-input {
          background-color: hsl(var(--background)) !important;
          border-top: 1px solid hsl(var(--border)) !important;
          padding: 12px !important;
        }

        .sendbird-message-input-text-field {
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 1.5rem !important;
          background-color: hsl(var(--muted)) !important;
        }

        .sendbird-message-content__middle__body-container {
          border-radius: 1rem;
        }

        .sendbird-channel-header {
          background-color: hsl(var(--background)) !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
        }
      `}</style>
    </div>
  );
}
