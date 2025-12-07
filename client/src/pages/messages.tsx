import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import SendbirdProvider from "@sendbird/uikit-react/SendbirdProvider";
import GroupChannelList from "@sendbird/uikit-react/GroupChannelList";
import GroupChannel from "@sendbird/uikit-react/GroupChannel";
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
  const [currentChannelUrl, setCurrentChannelUrl] = useState<string | null>(matchId || null);

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
            sessionStorage.setItem('channels_backfilled', 'true');
          })
          .catch(() => {});
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
      setCurrentChannelUrl(matchId);
    }
  }, [matchId]);

  const handleChannelSelect = (channel: any) => {
    if (channel?.url) {
      setCurrentChannelUrl(channel.url);
      setLocation(`/messages/${channel.url}`);
    }
  };

  const handleBackToList = () => {
    setCurrentChannelUrl(null);
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
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SendbirdProvider
        appId={SENDBIRD_APP_ID}
        userId={user.id}
        accessToken={sendbirdToken}
        theme="dark"
      >
        <div className="flex-1 flex overflow-hidden fusion-chat">
          {/* Channel List */}
          <div className={`w-full md:w-80 md:flex-shrink-0 md:border-r border-border h-full bg-background ${currentChannelUrl ? 'hidden md:block' : 'block'}`}>
            <div className="h-full flex flex-col">
              <div className="px-4 py-4 border-b border-border">
                <h1 className="text-xl font-semibold text-foreground">Messages</h1>
              </div>
              <div className="flex-1 overflow-hidden">
                <GroupChannelList
                  onChannelSelect={handleChannelSelect}
                  onChannelCreated={handleChannelSelect}
                  channelListQueryParams={{ includeEmpty: true }}
                />
              </div>
            </div>
          </div>

          {/* Conversation */}
          <div className={`flex-1 h-full flex flex-col bg-background ${currentChannelUrl ? 'block' : 'hidden md:flex'}`}>
            {currentChannelUrl ? (
              <div className="h-full flex flex-col">
                {/* Mobile back button */}
                <div className="md:hidden px-2 py-2 border-b border-border flex items-center gap-2 bg-card">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToList}
                    data-testid="button-back"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <span className="font-medium">Back</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <GroupChannel
                    channelUrl={currentChannelUrl}
                    onBackClick={handleBackToList}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>Select a conversation</p>
              </div>
            )}
          </div>
        </div>
      </SendbirdProvider>

      <style>{`
        .fusion-chat .sendbird-channel-list,
        .fusion-chat .sendbird-group-channel-list {
          width: 100% !important;
          height: 100% !important;
          background: transparent !important;
        }

        .fusion-chat .sendbird-channel-list__header,
        .fusion-chat .sendbird-group-channel-list__header {
          display: none !important;
        }

        .fusion-chat .sendbird-channel-preview {
          background: transparent !important;
          border-radius: 8px !important;
          margin: 4px 8px !important;
        }

        .fusion-chat .sendbird-channel-preview:hover {
          background: hsl(var(--muted)) !important;
        }

        .fusion-chat .sendbird-conversation,
        .fusion-chat .sendbird-group-channel-view {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          background: hsl(var(--background)) !important;
        }

        .fusion-chat .sendbird-conversation__messages,
        .fusion-chat .sendbird-group-channel-view__message-list {
          flex: 1 !important;
          overflow-y: auto !important;
          background: hsl(var(--background)) !important;
        }

        .fusion-chat .sendbird-message-input {
          flex-shrink: 0 !important;
          background: hsl(var(--card)) !important;
          border-top: 1px solid hsl(var(--border)) !important;
          padding: 12px !important;
        }

        .fusion-chat .sendbird-message-input-text-field {
          background: hsl(var(--muted)) !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 20px !important;
          color: hsl(var(--foreground)) !important;
        }

        .fusion-chat .sendbird-text-message-item-body {
          border-radius: 16px !important;
          padding: 8px 12px !important;
        }

        .fusion-chat .sendbird-message-content--outgoing .sendbird-text-message-item-body {
          background: hsl(var(--primary)) !important;
          color: hsl(var(--primary-foreground)) !important;
        }

        .fusion-chat .sendbird-message-content--incoming .sendbird-text-message-item-body {
          background: hsl(var(--muted)) !important;
          color: hsl(var(--foreground)) !important;
        }
      `}</style>
    </div>
  );
}
