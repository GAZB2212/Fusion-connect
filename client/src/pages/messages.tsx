import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import SendbirdProvider from "@sendbird/uikit-react/SendbirdProvider";
import GroupChannelList from "@sendbird/uikit-react/GroupChannelList";
import GroupChannel from "@sendbird/uikit-react/GroupChannel";
import "@sendbird/uikit-react/dist/index.css";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Video, MoreVertical, ShieldOff, Flag, Trash2, Phone } from "lucide-react";
import VideoCallComponent from "@/components/VideoCall";
import { useVideoCall } from "@/contexts/VideoCallContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient, getApiUrl, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRingtone } from "@/hooks/use-ringtone";

const SENDBIRD_APP_ID = import.meta.env.VITE_SENDBIRD_APP_ID || "A68E730B-8E56-4655-BCBD-A709F3162376";

interface SendbirdTokenResponse {
  token: string;
  userId: string;
}

interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  matchedAt: string;
}

interface VideoCall {
  id: string;
  matchId: string;
  callerId: string;
  receiverId: string;
  channelName: string;
  status: string;
  duration?: number;
}

export default function Messages() {
  const { user } = useAuth();
  const [, params] = useRoute("/messages/:matchId");
  const [, setLocation] = useLocation();
  const matchId = params?.matchId;
  const { toast } = useToast();

  const [sendbirdToken, setSendbirdToken] = useState<string | null>(null);
  // Don't initialize with matchId - wait for SDK to validate channel exists
  const [currentChannelUrl, setCurrentChannelUrl] = useState<string | null>(null);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportDetails, setReportDetails] = useState("");
  const [selectedUserIdForAction, setSelectedUserIdForAction] = useState<string | null>(null);
  
  // Video call state
  const [activeCall, setActiveCall] = useState<VideoCall | null>(null);
  const [callToken, setCallToken] = useState<string | null>(null);
  const [endedCallId, setEndedCallId] = useState<string | null>(null);
  const { isCallActive, setIsCallActive } = useVideoCall();
  
  // Ringtone for incoming and outgoing calls
  const { startRinging: startIncomingRing, stopRinging: stopIncomingRing } = useRingtone({ 
    frequency: 440, 
    duration: 400, 
    interval: 200 
  });
  const { startRinging: startOutgoingRing, stopRinging: stopOutgoingRing } = useRingtone({ 
    frequency: 350, 
    duration: 300, 
    interval: 400 
  });

  const { data: tokenData, isLoading: tokenLoading, isError: tokenError, error: tokenErrorDetails, refetch: refetchToken } = useQuery<SendbirdTokenResponse>({
    queryKey: ["/api/sendbird/token"],
    enabled: !!user,
    retry: 2,
    retryDelay: 1000,
    staleTime: 0, // Always refetch token
  });

  // Handle auth errors - if token request fails with 401, invalidate auth cache
  useEffect(() => {
    if (tokenError && tokenErrorDetails) {
      const errorMsg = String(tokenErrorDetails);
      console.log('[Messages] Token error:', errorMsg);
      if (errorMsg.includes('401')) {
        console.log('[Messages] Session expired, invalidating auth cache');
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    }
  }, [tokenError, tokenErrorDetails]);

  // Fetch all matches to find the current one
  const { data: matches } = useQuery<Match[]>({
    queryKey: ["/api/matches"],
    enabled: !!user,
  });

  // Find current match from the list
  const currentMatch = matches?.find(m => m.id === currentChannelUrl);

  // Get the other user's ID from the match
  const getOtherUserId = () => {
    if (!currentMatch || !user) return null;
    return currentMatch.user1Id === user.id ? currentMatch.user2Id : currentMatch.user1Id;
  };

  // Check for incoming calls
  const { data: incomingCall } = useQuery<VideoCall | null>({
    queryKey: ["/api/video-call/incoming", currentChannelUrl],
    queryFn: async () => {
      if (!currentChannelUrl) return null;
      const token = getAuthToken();
      const res = await fetch(getApiUrl(`/api/video-call/incoming/${currentChannelUrl}`), {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!currentChannelUrl && !activeCall,
    refetchInterval: 3000,
  });

  // Handle incoming call
  useEffect(() => {
    // Don't restart a call we just ended
    if (incomingCall && incomingCall.id === endedCallId) {
      return;
    }
    if (incomingCall && !activeCall && (incomingCall.status === 'initiated' || incomingCall.status === 'active')) {
      // Start ringing for incoming call
      startIncomingRing();
      
      setActiveCall(incomingCall);
      // Fetch token for the call
      const token = getAuthToken();
      fetch(getApiUrl(`/api/video-call/token/${incomingCall.id}`), { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
        .then(res => res.json())
        .then(data => {
          if (data.token) {
            setCallToken(data.token);
            setIsCallActive(true);
          }
        })
        .catch(err => console.error('Failed to get call token:', err));
    }
  }, [incomingCall, activeCall, endedCallId, setIsCallActive, startIncomingRing]);

  // Video call mutation
  const startCallMutation = useMutation({
    mutationFn: async () => {
      console.log('[VideoCall] Starting call mutation...');
      const receiverId = getOtherUserId();
      console.log('[VideoCall] receiverId:', receiverId, 'currentChannelUrl:', currentChannelUrl);
      if (!receiverId || !currentChannelUrl) {
        throw new Error("Cannot start call");
      }
      console.log('[VideoCall] Making API request to initiate call');
      const res = await apiRequest("POST", "/api/video-call/initiate", {
        matchId: currentChannelUrl,
        receiverId,
      });
      console.log('[VideoCall] API response received, status:', res.status);
      const call = await res.json();
      console.log('[VideoCall] Parsed call data:', call);
      return call as VideoCall;
    },
    onSuccess: async (call) => {
      console.log('[VideoCall] Call initiated successfully:', call);
      
      // Fetch token for the call FIRST before setting any state
      try {
        console.log('[VideoCall] Fetching token for call:', call.id);
        const callToken = getAuthToken();
        const tokenRes = await fetch(getApiUrl(`/api/video-call/token/${call.id}`), { 
          credentials: 'include',
          headers: callToken ? { 'Authorization': `Bearer ${callToken}` } : {},
        });
        console.log('[VideoCall] Token response status:', tokenRes.status);
        
        if (!tokenRes.ok) {
          throw new Error(`Token request failed: ${tokenRes.status}`);
        }
        
        const tokenData = await tokenRes.json();
        console.log('[VideoCall] Token data:', tokenData);
        
        if (tokenData.token) {
          console.log('[VideoCall] Setting all call states together');
          // Start outgoing ring sound
          startOutgoingRing();
          
          // Set all states together to avoid race conditions
          setActiveCall(call);
          setCallToken(tokenData.token);
          setIsCallActive(true);
          
          toast({
            title: "Calling...",
            description: "Starting video call",
          });
        } else {
          console.error('[VideoCall] No token in response:', tokenData);
          toast({
            title: "Call failed",
            description: "Could not get video token",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error('[VideoCall] Failed to get call token:', err);
        toast({
          title: "Call failed",
          description: "Could not connect to video service",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Call failed",
        description: error.message || "Could not start video call",
        variant: "destructive",
      });
    },
  });

  // Handle ending the call
  const handleEndCall = async (duration: number) => {
    if (!activeCall) return;
    
    // Stop all ringing sounds
    stopIncomingRing();
    stopOutgoingRing();
    
    // Track ended call to prevent it from restarting
    const callId = activeCall.id;
    setEndedCallId(callId);
    
    try {
      await apiRequest("PATCH", `/api/video-call/${callId}/status`, {
        status: 'ended',
        duration,
      });
    } catch (err) {
      console.error('Failed to update call status:', err);
    }
    
    setActiveCall(null);
    setCallToken(null);
    setIsCallActive(false);
    
    // Clear the ended call ID after a delay to allow new calls
    setTimeout(() => {
      setEndedCallId(null);
    }, 5000);
    
    toast({
      title: "Call ended",
      description: `Duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`,
    });
  };

  const blockMutation = useMutation({
    mutationFn: async () => {
      const blockedId = selectedUserIdForAction || getOtherUserId();
      if (!blockedId) throw new Error("Cannot block user");
      return apiRequest("POST", `/api/users/${blockedId}/block`);
    },
    onSuccess: () => {
      toast({
        title: "User blocked",
        description: "You won't see messages from this person anymore",
      });
      setShowBlockDialog(false);
      setSelectedUserIdForAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      if (currentChannelUrl) handleBackToList();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to block",
        description: error.message || "Could not block user",
        variant: "destructive",
      });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      const reportedId = selectedUserIdForAction || getOtherUserId();
      if (!reportedId || !reportReason) throw new Error("Cannot report user");
      return apiRequest("POST", `/api/users/${reportedId}/report`, {
        reason: reportReason,
        details: reportDetails || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Thank you for helping keep our community safe",
      });
      setShowReportDialog(false);
      setReportReason("");
      setReportDetails("");
      setSelectedUserIdForAction(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to report",
        description: error.message || "Could not submit report",
        variant: "destructive",
      });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async () => {
      if (!currentChannelUrl) throw new Error("No chat selected");
      return apiRequest("DELETE", `/api/matches/${currentChannelUrl}`);
    },
    onSuccess: () => {
      toast({
        title: "Left chat",
        description: "The conversation has been removed",
      });
      setShowDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      handleBackToList();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete",
        description: error.message || "Could not delete chat",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (user) {
      const hasBackfilled = sessionStorage.getItem('channels_backfilled');
      if (!hasBackfilled) {
        const token = getAuthToken();
        fetch(getApiUrl('/api/dev/backfill-channels'), { 
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          credentials: 'include'
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

  // Always sync currentChannelUrl with the URL matchId parameter
  useEffect(() => {
    // matchId can be undefined (list view) or a string (chat view)
    setCurrentChannelUrl(matchId || null);
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

  if (tokenError) {
    return (
      <div className="fixed inset-0 bottom-16 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <p className="text-destructive">Failed to connect to messaging</p>
          <p className="text-sm text-muted-foreground">Please try again or refresh the page</p>
          <Button onClick={() => refetchToken()} data-testid="button-retry-connect">
            Try Again
          </Button>
        </div>
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
    <div className="fixed inset-0 bottom-16 pt-14 flex flex-col bg-background overflow-hidden">
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
        <h1 className="text-lg font-semibold text-foreground flex-1">
          {currentChannelUrl ? "Chat" : "Messages"}
        </h1>
        {currentChannelUrl && currentMatch && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => startCallMutation.mutate()}
              disabled={startCallMutation.isPending}
              data-testid="button-video-call"
            >
              <Video className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-chat-menu">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => setShowReportDialog(true)}
                  data-testid="button-report-user"
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Report
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid="button-leave-chat"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Leave chat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowBlockDialog(true)}
                  className="text-destructive focus:text-destructive"
                  data-testid="button-block-user"
                >
                  <ShieldOff className="w-4 h-4 mr-2" />
                  Block
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </header>

      {/* Leave Chat Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this chat?</DialogTitle>
            <DialogDescription>
              This will remove the conversation and unmatch you from this person. You can match with them again in the future.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteChatMutation.mutate()}
              disabled={deleteChatMutation.isPending}
              data-testid="button-confirm-leave"
            >
              {deleteChatMutation.isPending ? "Leaving..." : "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Confirmation Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block this person?</DialogTitle>
            <DialogDescription>
              They won't be able to message you anymore, and you won't see them in your matches. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
              data-testid="button-confirm-block"
            >
              {blockMutation.isPending ? "Blocking..." : "Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report inappropriate behavior</DialogTitle>
            <DialogDescription>
              Help us keep the community safe. Your report will be reviewed by our team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger id="report-reason" data-testid="select-report-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="inappropriate_content">Inappropriate content</SelectItem>
                  <SelectItem value="fake_profile">Fake profile</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-details">Additional details (optional)</Label>
              <Textarea
                id="report-details"
                placeholder="Describe what happened..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                data-testid="input-report-details"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending || !reportReason}
              data-testid="button-submit-report"
            >
              {reportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SendbirdProvider
          appId={SENDBIRD_APP_ID}
          userId={user.id}
          accessToken={sendbirdToken}
          theme="dark"
          stringSet={{
            MESSAGE_INPUT__PLACE_HOLDER: "",
            MESSAGE_INPUT__PLACE_HOLDER__DISABLED: "",
            MESSAGE_INPUT__PLACE_HOLDER__MUTED: "",
            PLACE_HOLDER__NO_CHANNEL: "No Chats Available",
          }}
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
          min-width: 100% !important;
          height: 100% !important;
          background: hsl(var(--background)) !important;
          overflow-x: hidden !important;
        }

        .fusion-chat .sendbird-channel-list__body,
        .fusion-chat .sendbird-group-channel-list__body {
          width: 100% !important;
          max-width: 100% !important;
        }

        .fusion-chat .sendbird-channel-list__header,
        .fusion-chat .sendbird-group-channel-list__header,
        .fusion-chat .sendbird-channel-header,
        .fusion-chat .sendbird-group-channel-header {
          display: none !important;
        }

        /* Hide the info button in conversation header */
        .fusion-chat .sendbird-ui-header__right,
        .fusion-chat .sendbird-conversation__header-icon--info,
        .fusion-chat .sendbird-iconbutton--info,
        .fusion-chat [class*="header-icon--info"],
        .fusion-chat .sendbird-chat-header__right {
          display: none !important;
        }

        /* Hide the upload/attachment button */
        .fusion-chat .sendbird-message-input--attach,
        .fusion-chat .sendbird-iconbutton--attach,
        .fusion-chat [class*="message-input--attach"],
        .fusion-chat .sendbird-message-input-wrapper__tools {
          display: none !important;
        }

        /* Hide the leave channel and other default menu options */
        .fusion-chat .sendbird-channel-preview__action,
        .fusion-chat .sendbird-channel-preview-action,
        .fusion-chat [class*="channel-preview__action"],
        .fusion-chat [class*="leave-channel"],
        .fusion-chat .sendbird-icon-leave {
          display: none !important;
        }

        .fusion-chat .sendbird-channel-preview {
          width: calc(100% - 16px) !important;
          max-width: calc(100% - 16px) !important;
          background: transparent !important;
          border-radius: 8px !important;
          margin: 4px 8px !important;
        }

        .fusion-chat .sendbird-channel-preview:hover {
          background: hsl(var(--muted)) !important;
        }

        /* Ensure avatars display properly */
        .fusion-chat .sendbird-avatar,
        .fusion-chat .sendbird-channel-preview__avatar {
          width: 40px !important;
          height: 40px !important;
          min-width: 40px !important;
          min-height: 40px !important;
          border-radius: 50% !important;
          overflow: hidden !important;
        }

        .fusion-chat .sendbird-avatar-img,
        .fusion-chat .sendbird-channel-preview__avatar img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 50% !important;
        }

        /* Message avatars */
        .fusion-chat .sendbird-message-content__left__avatar .sendbird-avatar {
          width: 28px !important;
          height: 28px !important;
          min-width: 28px !important;
          min-height: 28px !important;
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
          background: transparent !important;
          border: none !important;
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
          max-height: 120px !important;
          font-size: 15px !important;
          padding: 10px 16px !important;
          word-wrap: break-word !important;
          word-break: break-word !important;
          white-space: pre-wrap !important;
          overflow-wrap: break-word !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }

        .fusion-chat .sendbird-message-input-wrapper {
          width: 100% !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }

        .fusion-chat .sendbird-message-input-text-field::placeholder,
        .fusion-chat .sendbird-message-input-text-field::-webkit-input-placeholder {
          color: hsl(var(--muted-foreground)) !important;
          opacity: 0.6 !important;
          font-size: 15px !important;
        }

        .fusion-chat .sendbird-text-message-item-body {
          border-radius: 16px !important;
          padding: 8px 12px !important;
        }

        /* Constrain images within chat boundaries */
        .fusion-chat img:not(.sendbird-avatar-img):not(.sendbird-user-profile__avatar) {
          max-width: 180px !important;
          max-height: 240px !important;
          width: auto !important;
          height: auto !important;
          object-fit: cover !important;
          border-radius: 12px !important;
        }

        .fusion-chat .sendbird-thumbnail-message-item-body {
          max-width: 180px !important;
          max-height: 240px !important;
          overflow: hidden !important;
          border-radius: 12px !important;
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

      {/* Video Call Overlay - Debug log */}
      {(() => { console.log('[VideoCall Render] State check:', { isCallActive, hasActiveCall: !!activeCall, hasCallToken: !!callToken, activeCall, callToken }); return null; })()}
      {isCallActive && activeCall && callToken && (
        <VideoCallComponent
          callId={activeCall.id}
          channelName={activeCall.channelName}
          token={callToken}
          onEndCall={handleEndCall}
          isInitiator={activeCall.callerId === user?.id}
          onConnected={() => { stopIncomingRing(); stopOutgoingRing(); }}
        />
      )}
    </div>
  );
}
