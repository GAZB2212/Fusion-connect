import SendbirdPlatformSdk from 'sendbird-platform-sdk';

const appId = process.env.SENDBIRD_APP_ID;
const apiToken = process.env.SENDBIRD_API_TOKEN;

const isConfigured = !!(appId && apiToken);

let userApi: any;
let groupChannelApi: any;

if (isConfigured) {
  userApi = new SendbirdPlatformSdk.UserApi();
  groupChannelApi = new SendbirdPlatformSdk.GroupChannelApi();
  
  // Set base path for API instances
  userApi.apiClient.basePath = `https://api-${appId}.sendbird.com`;
  groupChannelApi.apiClient.basePath = `https://api-${appId}.sendbird.com`;
  
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
      const opts = {
        apiToken,
        createAUserRequest: new SendbirdPlatformSdk.CreateAUserRequest(
          params.userId,
          params.nickname,
          params.profileUrl || ''
        )
      };

      const data = await userApi.createAUser(opts);
      console.log(`[Sendbird] Created user: ${params.userId}`);
      return data;
    } catch (error: any) {
      // User already exists - try updating
      if (error.status === 400 && error.body?.code === 400202) {
        try {
          const updateOpts = {
            apiToken,
            userId: params.userId,
            updateAUserRequest: new SendbirdPlatformSdk.UpdateAUserRequest()
          };
          updateOpts.updateAUserRequest.nickname = params.nickname;
          if (params.profileUrl) {
            updateOpts.updateAUserRequest.profileUrl = params.profileUrl;
          }
          
          const data = await userApi.updateAUser(updateOpts);
          console.log(`[Sendbird] Updated user: ${params.userId}`);
          return data;
        } catch (updateError) {
          console.error('[Sendbird] Error updating user:', updateError);
          throw updateError;
        }
      } else {
        console.error('[Sendbird] Error creating user:', error);
        throw error;
      }
    }
  }

  static async generateSessionToken(userId: string): Promise<string> {
    if (!isConfigured) {
      throw new Error('Sendbird not configured');
    }
    
    try {
      const opts = {
        apiToken,
        userId,
        createAUserTokenRequest: new SendbirdPlatformSdk.CreateAUserTokenRequest()
      };
      
      const data = await userApi.createAUserToken(opts);
      return data.token;
    } catch (error) {
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
      const opts = {
        apiToken,
        createAGroupChannelRequest: new SendbirdPlatformSdk.CreateAGroupChannelRequest(userIds)
      };
      
      // Set channel properties
      opts.createAGroupChannelRequest.isDistinct = true;
      opts.createAGroupChannelRequest.customType = 'fusion_match';
      if (channelUrl) {
        opts.createAGroupChannelRequest.channelUrl = channelUrl;
      }

      const data = await groupChannelApi.createAGroupChannel(opts);
      console.log(`[Sendbird] Created channel for users: ${userIds.join(', ')}`);
      return data;
    } catch (error: any) {
      // Channel might already exist
      if (error.status === 400 && error.body?.code === 400201) {
        try {
          const listOpts = {
            apiToken,
            userIds: userIds.join(','),
            customTypes: 'fusion_match'
          };
          
          const data = await groupChannelApi.listGroupChannels(listOpts);
          if (data.channels && data.channels.length > 0) {
            console.log(`[Sendbird] Found existing channel`);
            return data.channels[0];
          }
        } catch (listError) {
          console.error('[Sendbird] Error finding existing channel:', listError);
        }
      }
      console.error('[Sendbird] Error creating channel:', error);
      throw error;
    }
  }

  static async getChannel(channelUrl: string): Promise<any> {
    if (!isConfigured) {
      throw new Error('Sendbird not configured');
    }
    
    try {
      const opts = {
        apiToken,
        channelUrl
      };
      
      const data = await groupChannelApi.getAGroupChannel(opts);
      return data;
    } catch (error) {
      console.error('[Sendbird] Error getting channel:', error);
      throw error;
    }
  }

  static async deleteUser(userId: string): Promise<void> {
    if (!isConfigured) {
      throw new Error('Sendbird not configured');
    }
    
    try {
      const opts = {
        apiToken,
        userId
      };
      
      await userApi.deleteAUser(opts);
      console.log(`[Sendbird] Deleted user: ${userId}`);
    } catch (error) {
      console.error('[Sendbird] Error deleting user:', error);
      throw error;
    }
  }
}
