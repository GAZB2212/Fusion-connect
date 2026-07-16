import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import SendbirdProvider from "@sendbird/uikit-react/SendbirdProvider";
import GroupChannelList from "@sendbird/uikit-react/GroupChannelList";
import GroupChannel from "@sendbird/uikit-react/GroupChannel";
import useSendbirdStateContext from "@sendbird/uikit-react/useSendbirdStateContext";
import { useTranslation } from "react-i18next";
import { useTextSize } from "@/contexts/TextSizeContext";
import "@sendbird/uikit-react/dist/index.css";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Video, MoreVertical, ShieldOff, Flag, Trash2, Phone, Users, Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { MatchWithProfiles, Chaperone } from "@shared/schema";
import type { GroupChannel as GroupChannelType } from "@sendbird/chat/groupChannel";
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
import { getUnreadMessageCount, updateBadgeCount } from "@/lib/unifiedPushNotifications";

const SENDBIRD_APP_ID = import.meta.env.VITE_SENDBIRD_APP_ID || "A68E730B-8E56-4655-BCBD-A709F3162376";

// Custom channel preview component with premium styling
interface CustomChannelPreviewProps {
  channel: GroupChannelType;
  onClick: () => void;
  isSelected: boolean;
  currentUserId: string;
  matches?: MatchWithProfiles[];
}

function CustomChannelPreview({ channel, onClick, isSelected, currentUserId, matches }: CustomChannelPreviewProps) {
  // Find the other user (not current user, and not a chaperone if we can identify them)
  const members = channel.members || [];
  const otherMembers = members.filter((m: { userId: string }) => m.userId !== currentUserId);
  
  // Get the main match (first non-current user)
  const mainMatch = otherMembers[0];
  
  // Check if the main match is online (Sendbird provides connectionStatus)
  const isOnline = (mainMatch as any)?.connectionStatus === 'online';
  
  // Check if there's a chaperone (more than 2 members total means chaperone is present)
  const hasChaperone = members.length > 2;
  
  // Try to find the actual profile photo from matches data
  // Channel URL format is typically "match_<matchId>" or similar
  const matchIdFromChannel = channel.url?.replace('match_', '');
  const matchData = matches?.find(m => 
    String(m.id) === matchIdFromChannel || 
    channel.url?.includes(String(m.id))
  );
  
  // Get the other user's profile from match data
  const otherUserProfile = matchData?.user1Id === currentUserId 
    ? matchData?.user2Profile 
    : matchData?.user1Profile;
  
  // Use actual profile photo if available, otherwise fall back to Sendbird profile
  const profilePhoto = otherUserProfile?.photos?.[0] || 
                       (mainMatch as { profileUrl?: string; plainProfileUrl?: string })?.profileUrl || 
                       (mainMatch as { plainProfileUrl?: string })?.plainProfileUrl;
  
  const displayName = otherUserProfile?.displayName?.split(' ')[0] || 
                      (mainMatch as { nickname?: string })?.nickname?.split(' ')[0] || 
                      channel.name || 
                      'Chat';

  // Get last message info
  const lastMessage = channel.lastMessage;
  const lastMessageText = lastMessage 
    ? (lastMessage as any).message || (lastMessage as any).name || 'Sent a file'
    : 'Start chatting';
  
  // Format timestamp like WhatsApp
  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
    }
  };
  
  const timestamp = lastMessage?.createdAt ? formatTimestamp(lastMessage.createdAt) : '';
  const unreadCount = channel.unreadMessageCount || 0;

  return (
    <div 
      className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-muted/50 border-b border-border/30 ${
        isSelected ? 'bg-gradient-to-r from-amber-500/10 to-yellow-500/5' : ''
      }`}
      onClick={onClick}
      data-testid={`channel-preview-${channel.url}`}
    >
      {/* Avatar - larger size like WhatsApp */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-14 w-14">
          <AvatarImage 
            src={profilePhoto} 
            alt={displayName} 
            className="object-cover"
          />
          <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-lg">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {/* Online indicator - green dot */}
        {isOnline && (
          <div 
            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full ring-2 ring-background"
            data-testid="online-indicator"
          />
        )}
      </div>
      
      {/* Content - WhatsApp style with message preview */}
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-foreground truncate text-base">
            {displayName}
          </h3>
          <span className={`text-xs flex-shrink-0 ${unreadCount > 0 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}>
            {timestamp}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-sm text-muted-foreground truncate flex-1">
            {lastMessageText}
          </p>
          {unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-5 h-5 rounded-full bg-amber-500 text-background text-xs font-semibold flex items-center justify-center px-1.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface SendbirdTokenResponse {
  token: string;
  userId: string;
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
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();
  const { textSizeClass } = useTextSize();
  // Parse matchId directly from URL - only if there's a path segment after /messages/
  const urlParts = location.split('/');
  const matchId = urlParts[1] === 'messages' && urlParts[2] ? urlParts[2] : undefined;
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
  const { data: matches } = useQuery<MatchWithProfiles[]>({
    queryKey: ["/api/matches"],
    enabled: !!user,
  });

  // Find current match from the list
  const currentMatch = matches?.find(m => m.id === currentChannelUrl);
  
  // Get the other user's profile
  const otherProfile = currentMatch 
    ? (currentMatch.user1Id === user?.id ? currentMatch.user2Profile : currentMatch.user1Profile)
    : null;

  // Track online status for chat header
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);

  // Check if there's an active chaperone for this conversation
  const { data: chaperones } = useQuery<Chaperone[]>({
    queryKey: ["/api/chaperones"],
    enabled: !!user,
  });
  
  const hasActiveChaperone = chaperones?.some(c => 
    c.isActive && c.accessType === 'live'
  ) || false;

  // Get the other user's ID from the match
  const getOtherUserId = () => {
    if (!currentMatch || !user) return null;
    return currentMatch.user1Id === user.id ? currentMatch.user2Id : currentMatch.user1Id;
  };

  // Incoming calls are handled app-wide by the IncomingCallBanner (see App.tsx),
  // which listens for the 'incoming_call' WebSocket event and routes to the
  // shared /call/:callId screen — so calls ring on any screen, not just here.

  // Video call mutation
  // Unified call flow: create the invite, then jump to the shared call screen
  // as the caller. The callee gets an app-wide incoming-call banner (via the
  // 'incoming_call' WebSocket event) and a push notification.
  const startCallMutation = useMutation({
    mutationFn: async () => {
      const receiverId = getOtherUserId();
      if (!receiverId) {
        throw new Error("Cannot start call");
      }
      const res = await apiRequest("POST", "/api/call/invite", {
        calleeUserId: receiverId,
        callType: "video",
      });
      return res.json() as Promise<{ callId: string; callType: string }>;
    },
    onSuccess: (data) => {
      setLocation(`/call/${data.callId}?role=caller&callType=${data.callType}`);
    },
    onError: (error: any) => {
      toast({
        title: "Call failed",
        description: error.message || "Could not start video call",
        variant: "destructive",
      });
    },
  });

  // Handle ending the call - memoized to prevent unnecessary re-renders
  const handleEndCall = useCallback(async (duration: number) => {
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
  }, [activeCall, stopIncomingRing, stopOutgoingRing, setIsCallActive, toast]);
  
  // Memoized callback for when call connects
  const handleCallConnected = useCallback(() => {
    stopIncomingRing();
    stopOutgoingRing();
  }, [stopIncomingRing, stopOutgoingRing]);

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
    // Backfill endpoint only exists in development
    if (user && import.meta.env.DEV) {
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

  // Always sync currentChannelUrl with the URL - depends on location directly
  useEffect(() => {
    // If we're at exactly /messages (no match ID), clear the channel
    if (location === '/messages' || location === '/messages/') {
      setCurrentChannelUrl(null);
    } else if (matchId) {
      // Only set channel if we have a valid matchId
      setCurrentChannelUrl(matchId);
    }
  }, [location, matchId]);

  // Update app badge count when entering/leaving messages page
  useEffect(() => {
    const updateBadge = async () => {
      const unreadCount = await getUnreadMessageCount();
      await updateBadgeCount(unreadCount);
    };
    updateBadge();
    
    // Also update when messages are marked as read (channel is viewed)
    const interval = setInterval(updateBadge, 30000);
    return () => clearInterval(interval);
  }, [currentChannelUrl]);

  const handleChannelSelect = (channel: any) => {
    if (channel?.url) {
      setCurrentChannelUrl(channel.url);
      setLocation(`/messages/${channel.url}`);
      
      // Check online status of other members
      const members = channel.members || [];
      const otherMember = members.find((m: any) => m.userId !== user?.id);
      setIsOtherUserOnline(otherMember?.connectionStatus === 'online');
    }
  };

  const handleBackToList = () => {
    setCurrentChannelUrl(null);
    setIsOtherUserOnline(false);
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
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bottom-16 flex flex-col bg-background overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 3.5rem)' }}>
      {/* Premium Chat Header */}
      {currentChannelUrl ? (
        <header className="flex-shrink-0 h-16 px-3 border-b border-border bg-background/95 backdrop-blur-xl flex items-center gap-3 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToList}
            data-testid="button-back"
            className="active:scale-95 transition-transform -ml-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          {/* Profile Picture with Online/Chaperone Indicators */}
          <div 
            className="relative cursor-pointer group"
            onClick={() => otherProfile && setLocation(`/matches/${currentMatch?.id}/profile`)}
          >
            <Avatar className="h-11 w-11">
              <AvatarImage 
                src={otherProfile?.photos?.[otherProfile?.mainPhotoIndex || 0] || otherProfile?.photos?.[0]} 
                alt={otherProfile?.displayName || 'User'} 
                className="object-cover"
              />
              <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-lg">
                {otherProfile?.displayName?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            {/* Wali Badge - takes priority over online indicator */}
            {hasActiveChaperone ? (
              <div 
                className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 flex items-center gap-0.5 ring-2 ring-background"
                title="Wali is present"
              >
                <Users className="h-2.5 w-2.5 text-black" />
                <span className="text-[8px] font-bold text-black tracking-wide uppercase">Wali</span>
              </div>
            ) : isOtherUserOnline && (
              /* Online indicator - green dot */
              <div 
                className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-background"
                data-testid="header-online-indicator"
              />
            )}
          </div>
          
          {/* Name and Status */}
          <div 
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => otherProfile && setLocation(`/matches/${currentMatch?.id}/profile`)}
          >
            <h1 className="text-base font-semibold text-foreground truncate">
              {otherProfile?.displayName?.split(' ')[0] || 'Chat'}
            </h1>
            {hasActiveChaperone && (
              <p className="text-xs font-semibold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
                Wali is present
              </p>
            )}
          </div>
          
          {currentMatch && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => startCallMutation.mutate()}
                disabled={startCallMutation.isPending}
                data-testid="button-video-call"
                className="active:scale-95 transition-transform h-10 w-10 [&_svg]:size-7"
              >
                <Video className="text-amber-500" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-chat-menu" className="active:scale-95 transition-transform h-9 w-9">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setShowReportDialog(true)}
                    data-testid="button-report-user"
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    {t('report.title', 'Report')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    data-testid="button-leave-chat"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('messages.leaveChat', 'Leave chat')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowBlockDialog(true)}
                    className="text-destructive focus:text-destructive"
                    data-testid="button-block-user"
                  >
                    <ShieldOff className="w-4 h-4 mr-2" />
                    {t('messages.block', 'Block')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </header>
      ) : (
        <header className="flex-shrink-0 px-4 pt-2 pb-4 bg-background/80 backdrop-blur-xl border-b border-border z-10">
          <h1 className="text-3xl font-bold text-foreground">{t('messages.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('messages.yourConversations')}</p>
        </header>
      )}

      {/* Leave Chat Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('messages.leaveChatTitle', 'Leave this chat?')}</DialogTitle>
            <DialogDescription>
              {t('messages.leaveChatDesc', 'This will remove the conversation and unmatch you from this person. You can match with them again in the future.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteChatMutation.mutate()}
              disabled={deleteChatMutation.isPending}
              data-testid="button-confirm-leave"
            >
              {deleteChatMutation.isPending ? t('messages.leaving', 'Leaving...') : t('messages.leave', 'Leave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Confirmation Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('messages.blockTitle', 'Block this person?')}</DialogTitle>
            <DialogDescription>
              {t('messages.blockDesc', "They won't be able to message you anymore, and you won't see them in your matches. This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
              data-testid="button-confirm-block"
            >
              {blockMutation.isPending ? t('messages.blocking', 'Blocking...') : t('messages.block', 'Block')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('report.title', 'Report inappropriate behavior')}</DialogTitle>
            <DialogDescription>
              {t('report.description', 'Help us keep the community safe. Your report will be reviewed by our team.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">{t('report.reason')}</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger id="report-reason" data-testid="select-report-reason">
                  <SelectValue placeholder={t('report.selectReason', 'Select a reason')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="harassment">{t('report.harassment')}</SelectItem>
                  <SelectItem value="inappropriate_content">{t('report.inappropriate')}</SelectItem>
                  <SelectItem value="fake_profile">{t('report.fake')}</SelectItem>
                  <SelectItem value="spam">{t('report.spam')}</SelectItem>
                  <SelectItem value="other">{t('report.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-details">{t('report.additionalDetails', 'Additional details (optional)')}</Label>
              <Textarea
                id="report-details"
                placeholder={t('report.describePlaceholder', 'Describe what happened...')}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                data-testid="input-report-details"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending || !reportReason}
              data-testid="button-submit-report"
            >
              {reportMutation.isPending ? t('report.submitting', 'Submitting...') : t('report.submit')}
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
          uikitOptions={{
            groupChannel: {
              enableVoiceMessage: true,
              enableTypingIndicator: true,
            },
          }}
          stringSet={{
            MESSAGE_INPUT__PLACE_HOLDER: t('sendbird.placeholder'),
            MESSAGE_INPUT__PLACE_HOLDER__DISABLED: t('sendbird.placeholderDisabled'),
            MESSAGE_INPUT__PLACE_HOLDER__MUTED: t('sendbird.placeholderMuted'),
            PLACE_HOLDER__NO_CHANNEL: t('sendbird.noChannel'),
          }}
        >
          <div className={`h-full flex fusion-chat ${textSizeClass}`}>
            {/* Channel List */}
            <div className={`w-full md:w-80 md:flex-shrink-0 md:border-r border-border h-full bg-background ${currentChannelUrl ? 'hidden md:block' : 'block'}`}>
              <GroupChannelList
                disableAutoSelect
                onChannelSelect={handleChannelSelect}
                onChannelCreated={handleChannelSelect}
                channelListQueryParams={{ includeEmpty: true }}
                renderChannelPreview={(props) => (
                  <CustomChannelPreview
                    channel={props.channel}
                    onClick={() => handleChannelSelect(props.channel)}
                    isSelected={props.channel.url === currentChannelUrl}
                    currentUserId={user?.id || ''}
                    matches={matches}
                  />
                )}
              />
            </div>

            {/* Conversation */}
            <div className={`flex-1 h-full bg-background relative ${currentChannelUrl ? 'block' : 'hidden md:block'}`}>
              {currentChannelUrl ? (
                <GroupChannel
                  key={currentChannelUrl}
                  channelUrl={currentChannelUrl}
                  onBackClick={handleBackToList}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>{t('messages.selectConversation')}</p>
                </div>
              )}
            </div>
          </div>
        </SendbirdProvider>
      </div>

      <style>{`
        /* ===== SIMPLIFIED SENDBIRD STYLING ===== */
        
        /* Base container */
        .fusion-chat {
          height: 100% !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow: hidden !important;
          background: hsl(var(--background)) !important;
        }

        /* Hide Sendbird headers - we use our own */
        .fusion-chat .sendbird-channel-list__header,
        .fusion-chat .sendbird-group-channel-list__header,
        .fusion-chat .sendbird-conversation__header,
        .fusion-chat .sendbird-ui-header {
          display: none !important;
        }

        /* Channel list - full width */
        .fusion-chat .sendbird-channel-list,
        .fusion-chat .sendbird-group-channel-list {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 100% !important;
          height: 100% !important;
          background: hsl(var(--background)) !important;
        }

        .fusion-chat .sendbird-channel-list__body,
        .fusion-chat .sendbird-group-channel-list__body {
          width: 100% !important;
          padding: 0 8px !important;
        }

        .fusion-chat .sendbird-channel-preview {
          width: calc(100% - 16px) !important;
          margin: 4px 8px !important;
          padding: 12px !important;
          border-radius: 12px !important;
          background: transparent !important;
        }

        .fusion-chat .sendbird-channel-preview:hover {
          background: hsl(var(--muted)) !important;
        }

        .fusion-chat .sendbird-channel-preview--active {
          background: hsl(var(--muted)) !important;
        }

        /* Conversation area */
        .fusion-chat .sendbird-conversation,
        .fusion-chat .sendbird-group-channel-view {
          background: hsl(var(--background)) !important;
        }

        /* ===== MESSAGE WIDTH FIX ===== */
        .fusion-chat .sendbird-conversation__messages-padding {
          width: 100% !important;
          max-width: 100% !important;
          padding: 8px !important;
          box-sizing: border-box !important;
        }

        .fusion-chat .sendbird-message-hoc {
          max-width: 100% !important;
        }

        .fusion-chat .sendbird-message-content {
          max-width: calc(100vw - 32px) !important;
        }

        .fusion-chat .sendbird-message-content__middle {
          max-width: 70% !important;
          min-width: 0 !important;
        }

        /* Text messages - force word wrap */
        .fusion-chat .sendbird-text-message-item-body {
          max-width: 100% !important;
          word-wrap: break-word !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
          white-space: pre-wrap !important;
          border-radius: 16px !important;
          padding: 10px 14px !important;
        }

        /* ===== SIMPLE COLORS ===== */
        
        /* Incoming messages - dark muted */
        .fusion-chat .sendbird-message-content--incoming .sendbird-text-message-item-body {
          background: hsl(var(--muted)) !important;
          color: hsl(var(--foreground)) !important;
        }

        /* Outgoing messages - simple gold */
        .fusion-chat .sendbird-message-content--outgoing .sendbird-text-message-item-body {
          background: #f59e0b !important;
          color: #000 !important;
        }

        /* ===== HIDE IMAGE/FILE UPLOAD (Not supported in React) ===== */
        .fusion-chat .sendbird-message-input--attach,
        .fusion-chat .sendbird-iconbutton--attach,
        .fusion-chat [class*="message-input--attach"] {
          display: none !important;
        }

        /* ===== INPUT AREA ===== */
        .fusion-chat .sendbird-conversation__footer,
        .fusion-chat .sendbird-message-input-wrapper {
          position: fixed !important;
          bottom: calc(64px + env(safe-area-inset-bottom, 0px)) !important;
          left: 0 !important;
          right: 0 !important;
          padding: 8px 12px !important;
          background: hsl(var(--background)) !important;
          z-index: 50 !important;
        }

        .fusion-chat .sendbird-message-input-text-field {
          background: hsl(var(--muted)) !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 20px !important;
          color: hsl(var(--foreground)) !important;
        }

        /* Messages padding for fixed input */
        .fusion-chat .sendbird-conversation__messages {
          padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px)) !important;
        }

        /* ===== YELLOW ACCENTS ===== */
        
        /* Attachment button */
        .fusion-chat .sendbird-message-input--attach {
          color: #f59e0b !important;
        }

        /* Voice message button */
        .fusion-chat .sendbird-message-input--voice {
          color: #f59e0b !important;
        }

        /* Voice message player */
        .fusion-chat .sendbird-voice-message-item-body {
          background: hsl(var(--background)) !important;
          border: 2px solid #f59e0b !important;
          border-radius: 16px !important;
        }

        .fusion-chat .sendbird-voice-message-item-body__progress-bar {
          background: #f59e0b !important;
        }

        /* ===== HIDE UNNECESSARY ELEMENTS ===== */
        .fusion-chat .sendbird-emoji-reactions,
        .fusion-chat .sendbird-emoji-reaction-add-button,
        .fusion-chat .sendbird-message-input--emoji-button {
          display: none !important;
        }

        /* ===== TYPING INDICATOR ===== */
        .fusion-chat .sendbird-typing-indicator {
          color: hsl(var(--muted-foreground)) !important;
        }

        /* ===== MESSAGE STATUS / READ RECEIPTS (TICKS) ===== */
        /* Ensure message status container is visible */
        .fusion-chat .sendbird-message-status,
        .fusion-chat [class*="message-status"],
        .fusion-chat [class*="MessageStatus"],
        .fusion-chat .sendbird-message-content__middle__body-container__created-at,
        .fusion-chat [class*="outgoing"] [class*="status"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          align-items: center !important;
          gap: 4px !important;
        }

        /* Message content menu state (where read receipts appear) */
        .fusion-chat .sendbird-message-content-menu__outgoing-menu__state,
        .fusion-chat [class*="outgoing-menu__state"],
        .fusion-chat [class*="message-content"] [class*="state"],
        .fusion-chat .sendbird-message-content__right [class*="status"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        /* All message status icons - base styling */
        .fusion-chat .sendbird-message-status__icon,
        .fusion-chat [class*="message-status"] svg,
        .fusion-chat [class*="MessageStatus"] svg,
        .fusion-chat .sendbird-icon-done,
        .fusion-chat .sendbird-icon-done-all,
        .fusion-chat .sendbird-icon-read,
        .fusion-chat .sendbird-icon-delivered,
        .fusion-chat .sendbird-icon-sent {
          display: inline-flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: 16px !important;
          height: 16px !important;
        }

        /* SENT status - single gray tick (one checkmark) */
        .fusion-chat .sendbird-message-status--sent .sendbird-message-status__icon,
        .fusion-chat .sendbird-message-status__icon--sent,
        .fusion-chat [class*="message-status--sent"] svg,
        .fusion-chat [class*="MessageStatus"][class*="sent"] svg,
        .fusion-chat .sendbird-icon-done:not(.sendbird-icon-done-all) {
          color: hsl(var(--muted-foreground)) !important;
          fill: hsl(var(--muted-foreground)) !important;
        }
        .fusion-chat .sendbird-message-status--sent svg path,
        .fusion-chat [class*="message-status--sent"] svg path {
          fill: hsl(var(--muted-foreground)) !important;
        }

        /* DELIVERED status - double gray ticks (two checkmarks) */
        .fusion-chat .sendbird-message-status--delivered .sendbird-message-status__icon,
        .fusion-chat .sendbird-message-status__icon--delivered,
        .fusion-chat [class*="message-status--delivered"] svg,
        .fusion-chat [class*="MessageStatus"][class*="delivered"] svg {
          color: hsl(var(--muted-foreground)) !important;
          fill: hsl(var(--muted-foreground)) !important;
        }
        .fusion-chat .sendbird-message-status--delivered svg path,
        .fusion-chat [class*="message-status--delivered"] svg path {
          fill: hsl(var(--muted-foreground)) !important;
        }

        /* READ status - double GREEN ticks */
        .fusion-chat .sendbird-message-status--read .sendbird-message-status__icon,
        .fusion-chat .sendbird-message-status__icon--read,
        .fusion-chat [class*="message-status--read"] svg,
        .fusion-chat [class*="MessageStatus"][class*="read"] svg,
        .fusion-chat .sendbird-icon-done-all,
        .fusion-chat .sendbird-icon-read {
          color: #22c55e !important;
          fill: #22c55e !important;
        }

        /* Target SVG paths inside icons for read state */
        .fusion-chat .sendbird-message-status--read svg path,
        .fusion-chat [class*="message-status--read"] svg path,
        .fusion-chat .sendbird-icon-done-all path,
        .fusion-chat .sendbird-icon-read path {
          fill: #22c55e !important;
        }

        /* Pending/Sending status - gray clock or single tick */
        .fusion-chat .sendbird-message-status--pending .sendbird-message-status__icon,
        .fusion-chat [class*="message-status--pending"] svg,
        .fusion-chat .sendbird-icon-spinner {
          color: hsl(var(--muted-foreground)) !important;
          fill: hsl(var(--muted-foreground)) !important;
          opacity: 0.6 !important;
        }

        /* ===== VOICE MESSAGE - SHOW BACK/CANCEL BUTTON ===== */
        .fusion-chat .sendbird-voice-message-input__cancel,
        .fusion-chat .sendbird-voice-message-input-wrapper__cancel,
        .fusion-chat [class*="voice-message-input__cancel"],
        .fusion-chat [class*="voice-message"] button[class*="cancel"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          color: hsl(var(--muted-foreground)) !important;
        }

        .fusion-chat .sendbird-voice-message-input__cancel:hover {
          color: hsl(var(--foreground)) !important;
        }

      `}</style>

      {/* Video Call Overlay */}
      {isCallActive && activeCall && callToken && (
        <VideoCallComponent
          key={`call-${activeCall.id}`}
          callId={activeCall.id}
          channelName={activeCall.channelName}
          token={callToken}
          onEndCall={handleEndCall}
          isInitiator={activeCall.callerId === user?.id}
          onConnected={handleCallConnected}
        />
      )}
    </div>
  );
}
