const appId = process.env.SENDBIRD_APP_ID;
const apiToken = process.env.SENDBIRD_API_TOKEN;

const isConfigured = !!(appId && apiToken);
const baseUrl = `https://api-${appId}.sendbird.com/v3`;

// Get the site URL for converting relative URLs to absolute
// Production uses the custom domain, otherwise use Replit URL
const getSiteBaseUrl = (): string => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://www.fusioncouples.com';
  }
  // In development, use the Replit URL if available
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  // Fallback to localhost
  return 'http://localhost:5000';
};

if (isConfigured) {
  console.log('[Sendbird] Successfully configured');
} else {
  console.warn('[Sendbird] Not configured - SENDBIRD_APP_ID and SENDBIRD_API_TOKEN not set');
}

export interface SendbirdUserParams {
  userId: string;
  nickname: string;
  profileUrl?: string;
}

export class SendbirdService {
  
  // Validate and sanitize profile URL - use empty string if invalid (Sendbird accepts empty string)
  // Sendbird has a 2048 character limit on profile_url
  static getValidProfileUrl(url?: string): string {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return '';
    }
    
    // Skip base64 data URLs - they're too long for Sendbird
    if (url.startsWith('data:')) {
      console.warn('[Sendbird] Skipping data URL (base64 not supported for profile photos)');
      return '';
    }
    
    // Handle relative URLs (like /api/images/...) by converting to absolute
    if (url.startsWith('/')) {
      const siteBaseUrl = getSiteBaseUrl();
      const absoluteUrl = `${siteBaseUrl}${url}`;
      console.log('[Sendbird] Converted relative URL to absolute:', absoluteUrl);
      
      if (absoluteUrl.length > 2000) {
        console.warn('[Sendbird] Profile URL too long, using empty string. Length:', absoluteUrl.length);
        return '';
      }
      
      return absoluteUrl;
    }
    
    // Check if it's a valid absolute URL
    try {
      const parsedUrl = new URL(url);
      const cleanUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
      
      // Sendbird has a 2048 character limit on profile_url
      if (cleanUrl.length > 2000) {
        console.warn('[Sendbird] Profile URL too long, using empty string. Length:', cleanUrl.length);
        return '';
      }
      
      return cleanUrl;
    } catch {
      console.warn('[Sendbird] Invalid profile URL, using empty string:', url);
      return '';
    }
  }
  
  // Create or update user - tries POST first, falls back to PUT if user exists
  static async createOrUpdateUser(params: SendbirdUserParams): Promise<any> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping user creation - not configured');
      return null;
    }
    
    const profileUrl = this.getValidProfileUrl(params.profileUrl);
    
    try {
      // First, try to create with POST
      const createResponse = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify({
          user_id: params.userId,
          nickname: params.nickname,
          profile_url: profileUrl,
          issue_access_token: true
        })
      });
      
      const createData = await createResponse.json();
      
      // If POST succeeds, return the created user
      if (createResponse.ok) {
        console.log(`[Sendbird] Created new user: ${params.userId}`);
        return createData;
      }
      
      // If user already exists (400102 or 400202 unique constraint), try to update with PUT
      if (createData.code === 400102 || createData.code === 400202 || createData.message?.includes('already exists') || createData.message?.includes('unique constraint')) {
        console.log(`[Sendbird] User ${params.userId} already exists, updating...`);
        
        const updateResponse = await fetch(`${baseUrl}/users/${encodeURIComponent(params.userId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Api-Token': apiToken!
          },
          body: JSON.stringify({
            nickname: params.nickname,
            profile_url: profileUrl,
            issue_access_token: true
          })
        });
        
        const updateData = await updateResponse.json();
        
        if (!updateResponse.ok) {
          console.error('[Sendbird] Update user failed:', updateData);
          throw new Error(updateData.message || 'Failed to update user');
        }
        
        console.log(`[Sendbird] Updated user: ${params.userId}`);
        return updateData;
      }
      
      // Other error
      console.error('[Sendbird] Create user failed:', createData);
      throw new Error(createData.message || 'Failed to create user');
    } catch (error) {
      console.error('[Sendbird] Error creating/updating user:', error);
      throw error;
    }
  }

  static async updateUser(params: SendbirdUserParams): Promise<any> {
    // Now just calls createOrUpdateUser since we use PUT for upsert
    return this.createOrUpdateUser(params);
  }

  static async generateSessionToken(userId: string): Promise<string> {
    if (!isConfigured) {
      throw new Error('Sendbird not configured');
    }
    
    try {
      const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Sendbird] Token API error:', data);
        throw new Error(data.message || 'Failed to generate token');
      }
      
      console.log('[Sendbird] Generated session token for:', userId);
      return data.token;
    } catch (error: any) {
      console.error('[Sendbird] Error generating session token:', error);
      throw error;
    }
  }

  static async createChannel(userIds: string[], channelUrl?: string, sendWelcomeMessage: boolean = true): Promise<any> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping channel creation - not configured');
      return null;
    }
    
    try {
      const body: any = {
        user_ids: userIds,
        is_distinct: true,
        custom_type: 'fusion_match'
      };
      
      if (channelUrl) {
        body.channel_url = channelUrl;
      }
      
      const response = await fetch(`${baseUrl}/group_channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create channel');
      }
      
      console.log(`[Sendbird] Created channel for users: ${userIds.join(', ')}`);
      
      // Only send welcome message if explicitly requested AND this is a brand new channel
      // Check both last_message and message_count to ensure channel truly has no messages
      const hasNoMessages = data.last_message === null && (!data.message_count || data.message_count === 0);
      
      if (sendWelcomeMessage && hasNoMessages) {
        console.log(`[Sendbird] Sending welcome message to new channel ${data.channel_url}`);
        await this.sendSystemMessage(data.channel_url, "It's a match! Say salaam and start your conversation.");
      } else if (sendWelcomeMessage) {
        console.log(`[Sendbird] Skipping welcome message - channel already has messages (last_message: ${data.last_message ? 'yes' : 'no'}, message_count: ${data.message_count})`);
      }
      
      return data;
    } catch (error) {
      console.error('[Sendbird] Error creating channel:', error);
      throw error;
    }
  }

  static async sendSystemMessage(channelUrl: string, message: string): Promise<any> {
    if (!isConfigured) {
      return null;
    }
    
    try {
      const response = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(channelUrl)}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify({
          message_type: 'ADMM',
          message: message
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Sendbird] Failed to send system message:', data);
        return null;
      }
      
      console.log(`[Sendbird] Sent system message to channel: ${channelUrl}`);
      return data;
    } catch (error) {
      console.error('[Sendbird] Error sending system message:', error);
      return null;
    }
  }

  /**
   * Deliver a real-time call signal (incoming_call, call_accepted, …) over the
   * match's Sendbird channel. Sendbird's realtime delivery is proven reliable
   * (it powers chat), so this is the primary transport for call signaling — our
   * own /ws WebSocket is a best-effort secondary path that some production
   * proxies drop.
   *
   * Sent as a SILENT admin message: it does NOT bump unread counts, alter the
   * channel's last message, or fire a push. Online members still receive it
   * instantly via the SDK's onMessageReceived, which is all we need. The client
   * filters these out of the visible chat by custom_type.
   */
  static async sendCallSignal(
    channelUrl: string,
    signal: string,
    to: string,
    payload: Record<string, any> = {}
  ): Promise<void> {
    if (!isConfigured) return;
    try {
      const response = await fetch(
        `${baseUrl}/group_channels/${encodeURIComponent(channelUrl)}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Token': apiToken!,
          },
          body: JSON.stringify({
            message_type: 'ADMM',
            message: ' ',
            custom_type: 'call_signal',
            data: JSON.stringify({ signal, to, ...payload }),
            is_silent: true,
          }),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error(`[Sendbird] call signal '${signal}' failed:`, data);
      } else {
        console.log(`[Sendbird] Sent call signal '${signal}' to ${to} on ${channelUrl}`);
      }
    } catch (error) {
      console.error('[Sendbird] Error sending call signal:', error);
    }
  }

  /**
   * Ring a callee who may have the app closed. Sends a REAL user message
   * (MESG) to the match channel — the same message type that already delivers
   * reliable APNs pushes for chat — so an offline/closed phone gets a
   * home-screen "Incoming call" notification. Online members receive it
   * instantly in-app via onMessageReceived (and the client de-dupes by callId).
   *
   * custom_type 'call_signal' means the client hides it from the visible chat
   * and routes it into the call handler. The push_message_template gives the
   * notification its "X is calling you" wording.
   */
  static async sendCallRing(
    channelUrl: string,
    callerUserId: string,
    to: string,
    payload: Record<string, any>,
    pushBody: string
  ): Promise<void> {
    if (!isConfigured) return;
    try {
      const response = await fetch(
        `${baseUrl}/group_channels/${encodeURIComponent(channelUrl)}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Token': apiToken!,
          },
          body: JSON.stringify({
            message_type: 'MESG',
            user_id: callerUserId,
            message: pushBody,
            custom_type: 'call_signal',
            data: JSON.stringify({ signal: 'incoming_call', to, ...payload }),
          }),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('[Sendbird] call ring failed:', data);
      } else {
        console.log(`[Sendbird] Sent call ring to ${to} on ${channelUrl}`);
      }
    } catch (error) {
      console.error('[Sendbird] Error sending call ring:', error);
    }
  }

  static async getChannel(channelUrl: string): Promise<any> {
    if (!isConfigured) {
      throw new Error('Sendbird not configured');
    }
    
    const response = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(channelUrl)}`, {
      method: 'GET',
      headers: {
        'Api-Token': apiToken!
      }
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to get channel');
    }
    
    return await response.json();
  }

  static async cleanupDuplicateWelcomeMessages(channelUrl: string): Promise<number> {
    if (!isConfigured) {
      return 0;
    }
    
    try {
      // Get ALL messages from the channel (no message_type filter)
      const response = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(channelUrl)}/messages?limit=100`, {
        method: 'GET',
        headers: {
          'Api-Token': apiToken!
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Sendbird] Failed to get messages for cleanup:', response.status, errorText);
        return 0;
      }
      
      const data = await response.json();
      const messages = data.messages || [];
      console.log(`[Sendbird] Channel ${channelUrl}: Found ${messages.length} total messages`);
      
      // Find all "It's a match!" messages (check both message and message text)
      const welcomeMessages = messages.filter((m: any) => {
        const text = m.message || '';
        return text.includes("It's a match!");
      });
      
      console.log(`[Sendbird] Channel ${channelUrl}: Found ${welcomeMessages.length} welcome messages`);
      
      // Keep only the first one (oldest), delete the rest
      if (welcomeMessages.length <= 1) {
        return 0;
      }
      
      let deleted = 0;
      for (let i = 1; i < welcomeMessages.length; i++) {
        const msg = welcomeMessages[i];
        const delResponse = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(channelUrl)}/messages/${msg.message_id}`, {
          method: 'DELETE',
          headers: {
            'Api-Token': apiToken!
          }
        });
        
        if (delResponse.ok) {
          deleted++;
        }
      }
      
      console.log(`[Sendbird] Cleaned up ${deleted} duplicate welcome messages from ${channelUrl}`);
      return deleted;
    } catch (error) {
      console.error('[Sendbird] Error cleaning up messages:', error);
      return 0;
    }
  }

  static async deleteUser(userId: string): Promise<void> {
    if (!isConfigured) {
      throw new Error('Sendbird not configured');
    }
    
    const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        'Api-Token': apiToken!
      }
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to delete user');
    }
    
    console.log(`[Sendbird] Deleted user: ${userId}`);
  }

  static async deleteChannel(channelUrl: string): Promise<void> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping channel deletion - not configured');
      return;
    }
    
    const response = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(channelUrl)}`, {
      method: 'DELETE',
      headers: {
        'Api-Token': apiToken!
      }
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to delete channel');
    }
    
    console.log(`[Sendbird] Deleted channel: ${channelUrl}`);
  }

  static async inviteToChannel(channelUrl: string, userIds: string[]): Promise<any> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping channel invite - not configured');
      return null;
    }
    
    try {
      const response = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(channelUrl)}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify({
          user_ids: userIds
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Sendbird] Invite to channel failed:', data);
        throw new Error(data.message || 'Failed to invite users to channel');
      }
      
      console.log(`[Sendbird] Invited users ${userIds.join(', ')} to channel: ${channelUrl}`);
      return data;
    } catch (error) {
      console.error('[Sendbird] Error inviting to channel:', error);
      throw error;
    }
  }

  static async removeFromChannel(channelUrl: string, userIds: string[]): Promise<any> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping channel removal - not configured');
      return null;
    }
    
    try {
      const response = await fetch(`${baseUrl}/group_channels/${encodeURIComponent(channelUrl)}/leave`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify({
          user_ids: userIds
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Sendbird] Remove from channel failed:', data);
        throw new Error(data.message || 'Failed to remove users from channel');
      }
      
      console.log(`[Sendbird] Removed users ${userIds.join(', ')} from channel: ${channelUrl}`);
      return data;
    } catch (error) {
      console.error('[Sendbird] Error removing from channel:', error);
      throw error;
    }
  }

  static async getUserChannels(userId: string): Promise<any[]> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping get channels - not configured');
      return [];
    }
    
    try {
      const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}/my_group_channels?custom_types=fusion_match`, {
        method: 'GET',
        headers: {
          'Api-Token': apiToken!
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Sendbird] Get user channels failed:', data);
        return [];
      }
      
      return data.channels || [];
    } catch (error) {
      console.error('[Sendbird] Error getting user channels:', error);
      return [];
    }
  }

  // Get all channels (for cleanup purposes)
  static async getAllChannels(): Promise<any[]> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping get all channels - not configured');
      return [];
    }
    
    try {
      const allChannels: any[] = [];
      let nextToken: string | null = null;
      
      do {
        let fetchUrl: string;
        if (nextToken) {
          fetchUrl = `${baseUrl}/group_channels?custom_types=fusion_match&limit=100&token=${nextToken}`;
        } else {
          fetchUrl = `${baseUrl}/group_channels?custom_types=fusion_match&limit=100`;
        }
          
        const resp: Response = await fetch(fetchUrl, {
          method: 'GET',
          headers: {
            'Api-Token': apiToken!
          }
        });
        
        const respData: any = await resp.json();
        
        if (!resp.ok) {
          console.error('[Sendbird] Get all channels failed:', respData);
          break;
        }
        
        allChannels.push(...(respData.channels || []));
        nextToken = respData.next || null;
      } while (nextToken);
      
      console.log(`[Sendbird] Retrieved ${allChannels.length} total channels`);
      return allChannels;
    } catch (error) {
      console.error('[Sendbird] Error getting all channels:', error);
      return [];
    }
  }

  // Register APNs push token for iOS
  static async registerApnsPushToken(userId: string, deviceToken: string): Promise<any> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping APNs token registration - not configured');
      return null;
    }
    
    try {
      const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}/push/apns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify({
          apns_device_token: deviceToken,
          push_sound: 'default'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Sendbird] APNs token registration failed:', data);
        throw new Error(data.message || 'Failed to register APNs token');
      }
      
      console.log(`[Sendbird] Registered APNs token for user: ${userId}`);
      return data;
    } catch (error) {
      console.error('[Sendbird] Error registering APNs token:', error);
      throw error;
    }
  }

  // Register FCM push token for Android
  static async registerFcmPushToken(userId: string, registrationToken: string): Promise<any> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping FCM token registration - not configured');
      return null;
    }
    
    try {
      const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}/push/gcm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify({
          gcm_reg_token: registrationToken,
          push_sound: 'default'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Sendbird] FCM token registration failed:', data);
        throw new Error(data.message || 'Failed to register FCM token');
      }
      
      console.log(`[Sendbird] Registered FCM token for user: ${userId}`);
      return data;
    } catch (error) {
      console.error('[Sendbird] Error registering FCM token:', error);
      throw error;
    }
  }

  // Unregister APNs push token
  static async unregisterApnsPushToken(userId: string, deviceToken: string): Promise<void> {
    if (!isConfigured) return;
    
    try {
      const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}/push/apns/${encodeURIComponent(deviceToken)}`, {
        method: 'DELETE',
        headers: {
          'Api-Token': apiToken!
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error('[Sendbird] APNs token unregistration failed:', data);
      } else {
        console.log(`[Sendbird] Unregistered APNs token for user: ${userId}`);
      }
    } catch (error) {
      console.error('[Sendbird] Error unregistering APNs token:', error);
    }
  }

  // Unregister FCM push token
  static async unregisterFcmPushToken(userId: string, registrationToken: string): Promise<void> {
    if (!isConfigured) return;
    
    try {
      const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}/push/gcm/${encodeURIComponent(registrationToken)}`, {
        method: 'DELETE',
        headers: {
          'Api-Token': apiToken!
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error('[Sendbird] FCM token unregistration failed:', data);
      } else {
        console.log(`[Sendbird] Unregistered FCM token for user: ${userId}`);
      }
    } catch (error) {
      console.error('[Sendbird] Error unregistering FCM token:', error);
    }
  }

  // Get total unread message count for a user
  static async getUnreadMessageCount(userId: string): Promise<number> {
    if (!isConfigured) return 0;
    
    try {
      const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}/unread_message_count`, {
        method: 'GET',
        headers: {
          'Api-Token': apiToken!
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Sendbird] Get unread count failed:', data);
        return 0;
      }
      
      return data.unread_count || 0;
    } catch (error) {
      console.error('[Sendbird] Error getting unread count:', error);
      return 0;
    }
  }

  // Update user push preferences
  static async updatePushPreferences(userId: string, enabled: boolean): Promise<void> {
    if (!isConfigured) return;
    
    try {
      const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}/push_preference`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify({
          push_trigger_option: enabled ? 'all' : 'off'
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error('[Sendbird] Update push preferences failed:', data);
      } else {
        console.log(`[Sendbird] Updated push preferences for user ${userId}: ${enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('[Sendbird] Error updating push preferences:', error);
    }
  }

  // Send a push notification to a specific user via Sendbird's Push API
  // This uses Sendbird's "send_push" endpoint to deliver custom push notifications
  static async sendPushToUser(
    userId: string, 
    title: string, 
    body: string, 
    data?: Record<string, any>
  ): Promise<boolean> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping push send - not configured');
      return false;
    }
    
    try {
      // Sendbird uses the "send_push" endpoint to send push messages to a user
      // This requires the Platform API to be enabled for push
      const response = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify({
          message: {
            type: 'MESG',
            message: body,
            data: data ? JSON.stringify(data) : undefined,
            custom_type: 'call_notification',
          },
          push_option: 'force', // Send push even if user is online
          apns_bundle_id: process.env.APNS_BUNDLE_ID || 'com.gajocreative.fusion',
          sound: 'default',
          push_template: 'default',
          // Custom notification fields
          notification: {
            title,
            body,
            data: data || {},
          }
        })
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('[Sendbird] Send push to user failed:', responseData);
        
        // Fallback: Try sending via admin message to a system channel or direct messaging
        // For now, just log the failure
        return false;
      }
      
      console.log(`[Sendbird] Push notification sent to user ${userId}`);
      return true;
    } catch (error) {
      console.error('[Sendbird] Error sending push to user:', error);
      return false;
    }
  }
}
