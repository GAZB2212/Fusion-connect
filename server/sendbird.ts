const appId = process.env.SENDBIRD_APP_ID;
const apiToken = process.env.SENDBIRD_API_TOKEN;

const isConfigured = !!(appId && apiToken);
const baseUrl = `https://api-${appId}.sendbird.com/v3`;

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
    // Check if it's a valid URL and strip query parameters
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

  static async createChannel(userIds: string[], channelUrl?: string): Promise<any> {
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
      
      // Send a welcome message so the channel appears in users' channel lists
      await this.sendSystemMessage(data.channel_url, "It's a match! Say salaam and start your conversation.");
      
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
}
