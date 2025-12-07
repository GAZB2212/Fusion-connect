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
          .then(() => {
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
      <div className="fixed inset-0 bottom-16 flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Please log in to view messages</p>
      </div>
    );
  }

  if (tokenLoading || !sendbirdToken) {
    return (
      <div className="fixed inset-0 bottom-16 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bottom-16 flex flex-col bg-background overflow-hidden">
      {/* Fixed Header */}
      <header className="flex-shrink-0 h-14 px-4 border-b border-border bg-background flex items-center gap-3 z-10">
        {currentChannelUrl && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToList}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold text-foreground">
          {currentChannelUrl ? "Chat" : "Messages"}
        </h1>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SendbirdProvider
          appId={SENDBIRD_APP_ID}
          userId={user.id}
          accessToken={sendbirdToken}
          theme="dark"
        >
          <div className="h-full flex fusion-chat">
            {/* Channel List */}
            <div className={`w-full md:w-80 md:flex-shrink-0 md:border-r border-border h-full bg-background ${currentChannelUrl ? 'hidden md:block' : 'block'}`}>
              <GroupChannelList
                onChannelSelect={handleChannelSelect}
                onChannelCreated={handleChannelSelect}
                channelListQueryParams={{ includeEmpty: true }}
              />
            </div>

            {/* Conversation */}
            <div className={`flex-1 h-full bg-background ${currentChannelUrl ? 'block' : 'hidden md:block'}`}>
              {currentChannelUrl ? (
                <GroupChannel
                  channelUrl={currentChannelUrl}
                  onBackClick={handleBackToList}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>Select a conversation</p>
                </div>
              )}
            </div>
          </div>
        </SendbirdProvider>
      </div>

      <style>{`
        .fusion-chat {
          height: 100% !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }

        .fusion-chat .sendbird-channel-list,
        .fusion-chat .sendbird-group-channel-list {
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          background: hsl(var(--background)) !important;
          overflow-x: hidden !important;
        }

        .fusion-chat .sendbird-channel-list__header,
        .fusion-chat .sendbird-group-channel-list__header,
        .fusion-chat .sendbird-channel-header,
        .fusion-chat .sendbird-group-channel-header {
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
          max-width: 100% !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          background: hsl(var(--background)) !important;
          overflow: hidden !important;
        }

        .fusion-chat .sendbird-conversation__messages,
        .fusion-chat .sendbird-group-channel-view__message-list {
          flex: 1 !important;
          min-height: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          background: hsl(var(--background)) !important;
        }

        .fusion-chat .sendbird-conversation__messages-padding {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .fusion-chat .sendbird-message-input {
          flex-shrink: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          background: hsl(var(--card)) !important;
          border-top: 1px solid hsl(var(--border)) !important;
          padding: 8px 12px !important;
        }

        .fusion-chat .sendbird-message-input-text-field {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          background: hsl(var(--muted)) !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 20px !important;
          color: hsl(var(--foreground)) !important;
          min-height: 40px !important;
        }

        .fusion-chat .sendbird-text-message-item-body {
          border-radius: 16px !important;
          padding: 8px 12px !important;
        }

        /* Constrain images within chat boundaries */
        .fusion-chat img,
        .fusion-chat .sendbird-thumbnail-message-item-body img,
        .fusion-chat .sendbird-file-message-item-body img,
        .fusion-chat .sendbird-image-renderer img {
          max-width: 100% !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
        }

        .fusion-chat .sendbird-thumbnail-message-item-body,
        .fusion-chat .sendbird-file-message-item-body,
        .fusion-chat .sendbird-image-renderer {
          max-width: 250px !important;
          overflow: hidden !important;
        }

        .fusion-chat .sendbird-message-content {
          max-width: calc(100% - 40px) !important;
          overflow: hidden !important;
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
