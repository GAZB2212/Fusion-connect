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
      const createUserRequest = new SendbirdPlatformSdk.CreateUserData(
        params.userId,
        params.nickname,
        params.profileUrl || ''
      );
      
      const data = await userApi.createUser(apiToken, {
        createUserData: createUserRequest
      });
      console.log(`[Sendbird] Created user: ${params.userId}`);
      return data;
    } catch (error: any) {
      // User already exists - try updating
      if (error.status === 400 && error.body?.code === 400202) {
        try {
          const updateUserRequest = new SendbirdPlatformSdk.UpdateUserByIdData();
          updateUserRequest.nickname = params.nickname;
          updateUserRequest.profileUrl = params.profileUrl || '';
          
          const data = await userApi.updateUserById(apiToken, params.userId, {
            updateUserByIdData: updateUserRequest
          });
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
      const response = await userApi.createUserToken(apiToken, userId, {});
      console.log('[Sendbird] Token response:', JSON.stringify(response));
      
      // The response might be the token directly or have a token property
      const token = typeof response === 'string' ? response : response.token || response.data?.token;
      
      if (!token) {
        throw new Error('No token in response');
      }
      
      return token;
    } catch (error: any) {
      console.error('[Sendbird] Error generating session token:', error);
      console.error('[Sendbird] Error details:', {
        status: error.status,
        body: error.body,
        message: error.message
      });
      throw error;
    }
  }

  static async createChannel(userIds: string[], channelUrl?: string): Promise<any> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping channel creation - not configured');
      return null;
    }
    
    try {
      const createChannelRequest = new SendbirdPlatformSdk.GcCreateChannelData(
        userIds
      );
      createChannelRequest.isDistinct = true;
      createChannelRequest.customType = 'fusion_match';
      if (channelUrl) {
        createChannelRequest.channelUrl = channelUrl;
      }
      
      const data = await groupChannelApi.gcCreateChannel(apiToken, {
        gcCreateChannelData: createChannelRequest
      });
      console.log(`[Sendbird] Created channel for users: ${userIds.join(', ')}`);
      return data;
    } catch (error: any) {
      // Channel might already exist
      if (error.status === 400 && error.body?.code === 400201) {
        try {
          const data = await groupChannelApi.gcListChannels(apiToken, {
            userIds: userIds.join(','),
            customTypes: 'fusion_match'
          });
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
      const data = await groupChannelApi.gcViewChannelByUrl(apiToken, channelUrl);
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
      await userApi.deleteUserById(apiToken, userId);
      console.log(`[Sendbird] Deleted user: ${userId}`);
    } catch (error) {
      console.error('[Sendbird] Error deleting user:', error);
      throw error;
    }
  }
}
