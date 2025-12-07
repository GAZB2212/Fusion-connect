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
      <div className="flex items-center justify-center h-full bg-[#0b141a]">
        <p className="text-gray-400">Please log in to view messages</p>
      </div>
    );
  }

  if (tokenLoading || !sendbirdToken) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0b141a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0b141a] overflow-hidden whatsapp-theme">
      <SendbirdProvider
        appId={SENDBIRD_APP_ID}
        userId={user.id}
        accessToken={sendbirdToken}
        theme="dark"
      >
        <div className="flex-1 flex overflow-hidden">
          {/* Channel List - WhatsApp style */}
          <div className={`w-full md:w-96 md:flex-shrink-0 md:border-r border-[#222d34] h-full ${currentChannelUrl ? 'hidden md:block' : 'block'}`}>
            <div className="h-full flex flex-col bg-[#111b21]">
              <div className="bg-[#202c33] px-4 py-3 flex items-center">
                <h1 className="text-xl font-medium text-[#e9edef]">Chats</h1>
              </div>
              <div className="flex-1 overflow-hidden">
                <GroupChannelList
                  onChannelSelect={handleChannelSelect}
                  onChannelCreated={handleChannelSelect}
                  channelListQueryParams={{
                    includeEmpty: true,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Conversation - WhatsApp style */}
          <div className={`flex-1 h-full flex flex-col ${currentChannelUrl ? 'block' : 'hidden md:flex'}`}>
            {currentChannelUrl ? (
              <div className="h-full flex flex-col bg-[#0b141a]">
                {/* Chat header */}
                <div className="bg-[#202c33] px-2 py-2 flex items-center gap-3 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToList}
                    className="text-[#aebac1] hover:bg-[#374248] md:hidden"
                    data-testid="button-back"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden chat-container">
                  <GroupChannel
                    channelUrl={currentChannelUrl}
                    onBackClick={handleBackToList}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35] text-center p-8">
                <div className="w-64 h-64 mb-6 opacity-20">
                  <svg viewBox="0 0 303 172" fill="currentColor" className="text-[#8696a0]">
                    <path d="M229.565 160.229c32.47-25.963 53.321-65.616 53.321-110.126C282.886 22.405 260.501 0 232.803 0c-19.48 0-36.418 10.676-45.251 26.472-8.833-15.796-25.771-26.472-45.25-26.472-27.699 0-50.084 22.405-50.084 50.103 0 44.51 20.851 84.163 53.321 110.126l41.013 32.771 41.013-32.771z"/>
                  </svg>
                </div>
                <h2 className="text-[#e9edef] text-3xl font-light mb-3">Fusion Match</h2>
                <p className="text-[#8696a0] text-sm max-w-md">
                  Select a conversation to start messaging your matches
                </p>
              </div>
            )}
          </div>
        </div>
      </SendbirdProvider>

      <style>{`
        /* WhatsApp Dark Theme */
        .whatsapp-theme {
          --wa-bg-default: #0b141a;
          --wa-bg-panel: #111b21;
          --wa-bg-header: #202c33;
          --wa-bg-input: #2a3942;
          --wa-bg-outgoing: #005c4b;
          --wa-bg-incoming: #202c33;
          --wa-text-primary: #e9edef;
          --wa-text-secondary: #8696a0;
          --wa-border: #222d34;
          --wa-green: #00a884;
        }

        /* Channel List Styling */
        .sendbird-channel-list,
        .sendbird-group-channel-list {
          width: 100% !important;
          height: 100% !important;
          background-color: var(--wa-bg-panel) !important;
        }

        .sendbird-channel-list__header,
        .sendbird-group-channel-list__header {
          display: none !important;
        }

        .sendbird-channel-preview {
          background-color: transparent !important;
          border: none !important;
          border-bottom: 1px solid var(--wa-border) !important;
          border-radius: 0 !important;
          margin: 0 !important;
          padding: 10px 16px !important;
        }

        .sendbird-channel-preview:hover {
          background-color: var(--wa-bg-header) !important;
        }

        .sendbird-channel-preview__content__upper__header__channel-name {
          color: var(--wa-text-primary) !important;
          font-weight: 400 !important;
        }

        .sendbird-channel-preview__content__lower__last-message {
          color: var(--wa-text-secondary) !important;
        }

        /* Conversation Container */
        .chat-container .sendbird-conversation,
        .chat-container .sendbird-group-channel-view {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          background-color: var(--wa-bg-default) !important;
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") !important;
        }

        /* Hide default header - we have our own */
        .sendbird-channel-header,
        .sendbird-group-channel-header {
          background-color: var(--wa-bg-header) !important;
          border-bottom: none !important;
          padding: 10px 16px !important;
        }

        .sendbird-channel-header__title {
          color: var(--wa-text-primary) !important;
        }

        /* Message Area */
        .sendbird-conversation__messages,
        .sendbird-group-channel-view__message-list {
          flex: 1 !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          background: transparent !important;
        }

        .sendbird-conversation__messages-padding {
          padding: 8px 16px 8px 60px !important;
        }

        /* Message Bubbles - WhatsApp Style */
        .sendbird-message-content {
          max-width: 65% !important;
        }

        .sendbird-text-message-item-body {
          padding: 6px 12px 8px !important;
          border-radius: 8px !important;
          position: relative !important;
        }

        /* Outgoing messages (right side, green) */
        .sendbird-message-content.outgoing .sendbird-text-message-item-body,
        .sendbird-message-content--outgoing .sendbird-text-message-item-body {
          background-color: var(--wa-bg-outgoing) !important;
          border-top-right-radius: 0 !important;
        }

        /* Incoming messages (left side, gray) */
        .sendbird-message-content.incoming .sendbird-text-message-item-body,
        .sendbird-message-content--incoming .sendbird-text-message-item-body {
          background-color: var(--wa-bg-incoming) !important;
          border-top-left-radius: 0 !important;
        }

        .sendbird-text-message-item-body__message {
          color: var(--wa-text-primary) !important;
          font-size: 14.2px !important;
          line-height: 19px !important;
        }

        /* Timestamps */
        .sendbird-message-content__middle__body-container__created-at,
        .sendbird-label--caption-3 {
          color: var(--wa-text-secondary) !important;
          font-size: 11px !important;
        }

        /* Input Area - WhatsApp Style */
        .sendbird-message-input,
        .sendbird-message-input-wrapper {
          flex-shrink: 0 !important;
          background-color: var(--wa-bg-header) !important;
          border-top: none !important;
          padding: 10px 16px !important;
        }

        .sendbird-message-input-text-field {
          background-color: var(--wa-bg-input) !important;
          border: none !important;
          border-radius: 8px !important;
          color: var(--wa-text-primary) !important;
          padding: 9px 12px !important;
          font-size: 15px !important;
        }

        .sendbird-message-input-text-field::placeholder {
          color: var(--wa-text-secondary) !important;
        }

        /* Send button */
        .sendbird-message-input--send {
          background-color: var(--wa-green) !important;
          border-radius: 50% !important;
        }

        /* Avatar styling */
        .sendbird-avatar {
          border-radius: 50% !important;
        }

        /* Scrollbar styling */
        .sendbird-conversation__messages::-webkit-scrollbar,
        .sendbird-group-channel-view__message-list::-webkit-scrollbar {
          width: 6px !important;
        }

        .sendbird-conversation__messages::-webkit-scrollbar-track,
        .sendbird-group-channel-view__message-list::-webkit-scrollbar-track {
          background: transparent !important;
        }

        .sendbird-conversation__messages::-webkit-scrollbar-thumb,
        .sendbird-group-channel-view__message-list::-webkit-scrollbar-thumb {
          background-color: rgba(134, 150, 160, 0.3) !important;
          border-radius: 3px !important;
        }

        /* Date separators */
        .sendbird-separator {
          margin: 12px 0 !important;
        }

        .sendbird-separator__text {
          background-color: #182229 !important;
          color: var(--wa-text-secondary) !important;
          padding: 5px 12px !important;
          border-radius: 8px !important;
          font-size: 12px !important;
        }

        /* Read receipts */
        .sendbird-message-status__icon {
          color: #53bdeb !important;
        }

        /* Admin messages */
        .sendbird-admin-message {
          background-color: #182229 !important;
          color: var(--wa-text-secondary) !important;
          padding: 5px 12px !important;
          border-radius: 8px !important;
          font-size: 12px !important;
          text-align: center !important;
          margin: 8px auto !important;
          max-width: 80% !important;
        }
      `}</style>
    </div>
  );
}
