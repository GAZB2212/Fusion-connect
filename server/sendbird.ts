import SendbirdPlatformSdk from 'sendbird-platform-sdk';

const appId = process.env.SENDBIRD_APP_ID;
const apiToken = process.env.SENDBIRD_API_TOKEN;

const isConfigured = !!(appId && apiToken);

let sdk: any;
let userApi: any;
let groupChannelApi: any;

if (isConfigured) {
  sdk = SendbirdPlatformSdk.ApiClient.instance;
  sdk.basePath = `https://api-${appId}.sendbird.com`;
  const apiTokenAuth = sdk.authentications['Token'];
  apiTokenAuth.apiKey = apiToken;

  userApi = new SendbirdPlatformSdk.UserApi();
  groupChannelApi = new SendbirdPlatformSdk.GroupChannelApi();
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
      const body = {
        user_id: params.userId,
        nickname: params.nickname,
        profile_url: params.profileUrl || '',
        issue_access_token: true,
      };

      return new Promise((resolve, reject) => {
        userApi.createUser(body, (error: any, data: any) => {
          if (error) {
            if (error.status === 400 && error.body?.code === 400202) {
              userApi.updateUserById(params.userId, { updateUserByIdData: { nickname: params.nickname, profile_url: params.profileUrl || '' } }, (updateError: any, updateData: any) => {
                if (updateError) reject(updateError);
                else resolve(updateData);
              });
            } else {
              reject(error);
            }
          } else {
            resolve(data);
          }
        });
      });
    } catch (error) {
      console.error('Error creating/updating Sendbird user:', error);
      throw error;
    }
  }

  static async generateSessionToken(userId: string): Promise<string> {
    if (!isConfigured) {
      throw new Error('Sendbird not configured');
    }
    
    return new Promise((resolve, reject) => {
      const body = { user_id: userId };
      userApi.issueAccessToken(userId, { issueAccessTokenData: body }, (error: any, data: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(data.token);
        }
      });
    });
  }

  static async createChannel(userIds: string[], channelUrl?: string): Promise<any> {
    if (!isConfigured) {
      console.warn('[Sendbird] Skipping channel creation - not configured');
      return null;
    }
    
    try {
      const body = {
        user_ids: userIds,
        is_distinct: true,
        custom_type: 'fusion_match',
        ...(channelUrl && { channel_url: channelUrl })
      };

      return new Promise((resolve, reject) => {
        groupChannelApi.gcCreateChannel({ gcCreateChannelData: body }, (error: any, data: any) => {
          if (error) {
            if (error.status === 400 && error.body?.code === 400201) {
              groupChannelApi.gcListChannels({ userIds: userIds.join(','), customTypes: ['fusion_match'] }, (listError: any, listData: any) => {
                if (listError) reject(listError);
                else if (listData.channels && listData.channels.length > 0) {
                  resolve(listData.channels[0]);
                } else {
                  reject(new Error('Channel exists but could not be retrieved'));
                }
              });
            } else {
              reject(error);
            }
          } else {
            resolve(data);
          }
        });
      });
    } catch (error) {
      console.error('Error creating Sendbird channel:', error);
      throw error;
    }
  }

  static async getChannel(channelUrl: string): Promise<any> {
    if (!isConfigured) {
      throw new Error('Sendbird not configured');
    }
    
    return new Promise((resolve, reject) => {
      groupChannelApi.gcViewChannelByUrl(channelUrl, (error: any, data: any) => {
        if (error) reject(error);
        else resolve(data);
      });
    });
  }

  static async deleteUser(userId: string): Promise<void> {
    if (!isConfigured) {
      throw new Error('Sendbird not configured');
    }
    
    return new Promise((resolve, reject) => {
      userApi.deleteUserById(userId, (error: any) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}
