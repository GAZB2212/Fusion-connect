import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, MessageSquare, Users } from "lucide-react";
import SendbirdProvider from "@sendbird/uikit-react/SendbirdProvider";
import GroupChannelList from "@sendbird/uikit-react/GroupChannelList";
import GroupChannel from "@sendbird/uikit-react/GroupChannel";
import "@sendbird/uikit-react/dist/index.css";
import { getApiUrl } from "@/lib/queryClient";

const SENDBIRD_APP_ID = import.meta.env.VITE_SENDBIRD_APP_ID || "A68E730B-8E56-4655-BCBD-A709F3162376";

interface ChaperoneData {
  id: string;
  name: string;
  relationshipType: string;
  sendbirdUserId: string;
}

interface ChaperoneLoginResponse {
  chaperone: ChaperoneData;
  watchingUser: {
    name: string;
  };
  sendbirdToken: string;
}

export default function ChaperonePortal() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [chaperoneData, setChaperoneData] = useState<ChaperoneLoginResponse | null>(null);
  const [currentChannelUrl, setCurrentChannelUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");
    if (token) {
      setAccessToken(token);
      handleLogin(token);
    }
  }, [search]);

  const handleLogin = async (token?: string) => {
    const tokenToUse = token || accessToken;
    if (!tokenToUse) {
      setError("Please enter your access token");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(getApiUrl("/api/chaperone/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: tokenToUse }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Login failed");
      }

      const data: ChaperoneLoginResponse = await response.json();
      setChaperoneData(data);
    } catch (err: any) {
      setError(err.message || "Failed to login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelSelect = (channel: any) => {
    if (channel?.url) {
      setCurrentChannelUrl(channel.url);
    }
  };

  const handleBackToList = () => {
    setCurrentChannelUrl(null);
  };

  if (!chaperoneData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Chaperone Portal</h1>
            <p className="text-muted-foreground mt-2">
              Enter your access token to view conversations
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="accessToken">Access Token</Label>
              <Input
                id="accessToken"
                type="text"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter your access token"
                data-testid="input-chaperone-token"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" data-testid="text-chaperone-error">
                {error}
              </p>
            )}

            <Button
              className="w-full"
              onClick={() => handleLogin()}
              disabled={isLoading}
              data-testid="button-chaperone-login"
            >
              {isLoading ? "Logging in..." : "Access Conversations"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            This portal allows guardians to view and participate in conversations.
            Your access token was provided when you were added as a chaperone.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-card p-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-semibold">Chaperone Portal</h1>
            <p className="text-sm text-muted-foreground">
              Watching conversations for {chaperoneData.watchingUser.name}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{chaperoneData.chaperone.name}</span>
          <span className="text-xs">({chaperoneData.chaperone.relationshipType})</span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {chaperoneData.sendbirdToken && chaperoneData.chaperone.sendbirdUserId ? (
          <SendbirdProvider
            appId={SENDBIRD_APP_ID}
            userId={chaperoneData.chaperone.sendbirdUserId}
            accessToken={chaperoneData.sendbirdToken}
            theme="light"
          >
            <div className="h-full flex chaperone-chat">
              <div className={`w-full md:w-80 md:flex-shrink-0 md:border-r border-border h-full bg-background ${currentChannelUrl ? 'hidden md:block' : 'block'}`}>
                <GroupChannelList
                  onChannelSelect={handleChannelSelect}
                  onChannelCreated={handleChannelSelect}
                  channelListQueryParams={{ includeEmpty: true }}
                />
              </div>

              <div className={`flex-1 h-full bg-background ${currentChannelUrl ? 'block' : 'hidden md:block'}`}>
                {currentChannelUrl ? (
                  <GroupChannel
                    channelUrl={currentChannelUrl}
                    onBackClick={handleBackToList}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a conversation to view</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SendbirdProvider>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <p>Unable to load chat. Please try again later.</p>
          </div>
        )}
      </div>

      <style>{`
        .chaperone-chat {
          height: 100% !important;
          width: 100% !important;
        }

        .chaperone-chat .sendbird-channel-list,
        .chaperone-chat .sendbird-group-channel-list {
          width: 100% !important;
          height: 100% !important;
          background: hsl(var(--background)) !important;
        }

        .chaperone-chat .sendbird-channel-list__header,
        .chaperone-chat .sendbird-group-channel-list__header,
        .chaperone-chat .sendbird-channel-header,
        .chaperone-chat .sendbird-group-channel-header {
          display: none !important;
        }

        .chaperone-chat .sendbird-ui-header__right,
        .chaperone-chat .sendbird-conversation__header-icon--info {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
