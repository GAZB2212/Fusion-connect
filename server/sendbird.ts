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
  
  static async createOrUpdateUser(params: SendbirdUserParams): Promise<any> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping user creation - not configured');
      return null;
    }
    
    try {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': apiToken!
        },
        body: JSON.stringify({
          user_id: params.userId,
          nickname: params.nickname,
          profile_url: params.profileUrl || 'https://via.placeholder.com/150'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // User already exists (400202) - try updating
        if (data.code === 400202) {
          return await this.updateUser(params);
        }
        console.error('[Sendbird] Create user failed:', data);
        throw new Error(data.message || 'Failed to create user');
      }
      
      console.log(`[Sendbird] Created user: ${params.userId}`);
      return data;
    } catch (error) {
      console.error('[Sendbird] Error creating user:', error);
      throw error;
    }
  }

  static async updateUser(params: SendbirdUserParams): Promise<any> {
    const response = await fetch(`${baseUrl}/users/${encodeURIComponent(params.userId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Api-Token': apiToken!
      },
      body: JSON.stringify({
        nickname: params.nickname,
        profile_url: params.profileUrl || 'https://via.placeholder.com/150'
      })
    });
    
    if (!response.ok) {
      const data = await response.json();
      console.error('[Sendbird] Update user failed:', data);
      throw new Error(data.message || 'Failed to update user');
    }
    
    console.log(`[Sendbird] Updated user: ${params.userId}`);
    return await response.json();
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
      return data;
    } catch (error) {
      console.error('[Sendbird] Error creating channel:', error);
      throw error;
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
}
