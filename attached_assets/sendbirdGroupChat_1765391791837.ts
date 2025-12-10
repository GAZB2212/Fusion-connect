import SendBird from 'sendbird';

// Initialize Sendbird
const APP_ID = process.env.SENDBIRD_APP_ID;
const sb = new SendBird({ appId: APP_ID });

/**
 * Connect user to Sendbird
 */
export async function connectToSendbird(userId: string, accessToken?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (accessToken) {
      // Connect with session token for security
      sb.connect(userId, accessToken, (user, error) => {
        if (error) {
          reject(error);
        } else {
          resolve(user);
        }
      });
    } else {
      // Connect without token (development only)
      sb.connect(userId, (user, error) => {
        if (error) {
          reject(error);
        } else {
          resolve(user);
        }
      });
    }
  });
}

/**
 * Create a group channel with 2 users + optional chaperone(s)
 * 
 * @param user1Id - First user ID
 * @param user2Id - Second user ID  
 * @param chaperone1Id - Optional first chaperone user ID (user1's chaperone)
 * @param chaperone2Id - Optional second chaperone user ID (user2's chaperone)
 * @param channelName - Optional channel name
 * @returns Group channel
 */
export async function createChaperoneChannel(
  user1Id: string,
  user2Id: string,
  chaperone1Id?: string,
  chaperone2Id?: string,
  channelName?: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    // Build user list - always include both users, add chaperones if provided
    const userIds = [user1Id, user2Id];
    const chaperones = [];
    
    if (chaperone1Id) {
      userIds.push(chaperone1Id);
      chaperones.push(chaperone1Id);
    }
    if (chaperone2Id) {
      userIds.push(chaperone2Id);
      chaperones.push(chaperone2Id);
    }

    const params = new sb.GroupChannelParams();
    params.isPublic = false;
    params.isEphemeral = false;
    params.isDistinct = true; // Prevents duplicate channels
    params.addUserIds(userIds);
    
    if (channelName) {
      params.name = channelName;
    }
    
    // Set custom metadata to track chaperone status
    const chaperoneCount = chaperones.length;
    params.customType = chaperoneCount > 0 ? 'chaperoned' : 'direct';
    params.data = JSON.stringify({
      hasChaperone: chaperoneCount > 0,
      chaperoneCount,
      chaperones,
      user1Id,
      user2Id,
      createdAt: new Date().toISOString()
    });

    sb.GroupChannel.createChannel(params, (channel, error) => {
      if (error) {
        reject(error);
      } else {
        resolve(channel);
      }
    });
  });
}

/**
 * Add chaperone to existing channel
 * 
 * @param channelUrl - The channel URL
 * @param chaperoneId - Chaperone user ID to add
 */
export async function addChaperoneToChannel(
  channelUrl: string,
  chaperoneId: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    sb.GroupChannel.getChannel(channelUrl, (channel, error) => {
      if (error) {
        reject(error);
        return;
      }

      // Add chaperone to the channel
      channel.inviteWithUserIds([chaperoneId], (response, error) => {
        if (error) {
          reject(error);
          return;
        }

        // Update channel metadata
        const currentData = channel.data ? JSON.parse(channel.data) : {};
        const currentChaperones = currentData.chaperones || [];
        const updatedChaperones = [...currentChaperones, chaperoneId];

        channel.updateChannel(
          new sb.GroupChannelParams()
            .setCustomType('chaperoned')
            .setData(JSON.stringify({
              ...currentData,
              hasChaperone: true,
              chaperoneCount: updatedChaperones.length,
              chaperones: updatedChaperones,
              lastChaperoneAddedAt: new Date().toISOString()
            })),
          (channel, error) => {
            if (error) {
              reject(error);
            } else {
              resolve(channel);
            }
          }
        );
      });
    });
  });
}

/**
 * Get or create channel between two users with optional chaperone(s)
 * This is the main function you should use
 */
export async function getOrCreateChaperoneChannel(
  currentUserId: string,
  otherUserId: string,
  currentUserChaperoneId?: string,
  otherUserChaperoneId?: string,
  currentUserAccessToken?: string
): Promise<any> {
  try {
    // Connect current user first
    await connectToSendbird(currentUserId, currentUserAccessToken);

    // Try to find existing channel first
    const existingChannel = await findExistingChannel(currentUserId, otherUserId);
    
    if (existingChannel) {
      // Check if we need to add chaperone(s) to existing channel
      const channelData = existingChannel.data ? JSON.parse(existingChannel.data) : {};
      const existingChaperones = channelData.chaperones || [];
      
      // Add any missing chaperones
      const chaperonesToAdd = [];
      if (currentUserChaperoneId && !existingChaperones.includes(currentUserChaperoneId)) {
        chaperonesToAdd.push(currentUserChaperoneId);
      }
      if (otherUserChaperoneId && !existingChaperones.includes(otherUserChaperoneId)) {
        chaperonesToAdd.push(otherUserChaperoneId);
      }
      
      if (chaperonesToAdd.length > 0) {
        // Add missing chaperones to existing channel
        for (const chaperoneId of chaperonesToAdd) {
          await addChaperoneToChannel(existingChannel.url, chaperoneId);
        }
      }
      
      return existingChannel;
    }

    // Create new channel with both chaperones if needed
    return await createChaperoneChannel(
      currentUserId,
      otherUserId,
      currentUserChaperoneId,
      otherUserChaperoneId,
      `Chat between ${currentUserId} and ${otherUserId}`
    );
  } catch (error) {
    console.error('Error in getOrCreateChaperoneChannel:', error);
    throw error;
  }
}

/**
 * Find existing channel between two users
 */
async function findExistingChannel(user1Id: string, user2Id: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const listQuery = sb.GroupChannel.createMyGroupChannelListQuery();
    listQuery.includeEmpty = true;
    listQuery.memberStateFilter = 'joined_only';
    listQuery.order = 'latest_last_message';
    listQuery.limit = 100;

    listQuery.next((channels, error) => {
      if (error) {
        reject(error);
        return;
      }

      // Find channel with both users
      const channel = channels.find(ch => {
        const memberIds = ch.members.map((m: any) => m.userId);
        return memberIds.includes(user1Id) && memberIds.includes(user2Id);
      });

      resolve(channel || null);
    });
  });
}

/**
 * Send a message in a channel
 */
export async function sendMessage(
  channelUrl: string,
  message: string,
  userId: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    sb.GroupChannel.getChannel(channelUrl, (channel, error) => {
      if (error) {
        reject(error);
        return;
      }

      const params = new sb.UserMessageParams();
      params.message = message;

      channel.sendUserMessage(params, (message, error) => {
        if (error) {
          reject(error);
        } else {
          resolve(message);
        }
      });
    });
  });
}

/**
 * Get channel messages
 */
export async function getMessages(
  channelUrl: string,
  limit: number = 50
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    sb.GroupChannel.getChannel(channelUrl, (channel, error) => {
      if (error) {
        reject(error);
        return;
      }

      const listQuery = channel.createPreviousMessageListQuery();
      listQuery.limit = limit;
      listQuery.reverse = true;

      listQuery.load((messages, error) => {
        if (error) {
          reject(error);
        } else {
          resolve(messages);
        }
      });
    });
  });
}

/**
 * Check if user is in channel
 */
export async function isUserInChannel(
  channelUrl: string,
  userId: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    sb.GroupChannel.getChannel(channelUrl, (channel, error) => {
      if (error) {
        reject(error);
        return;
      }

      const isMember = channel.members.some((member: any) => member.userId === userId);
      resolve(isMember);
    });
  });
}

export default {
  connectToSendbird,
  createChaperoneChannel,
  addChaperoneToChannel,
  getOrCreateChaperoneChannel,
  sendMessage,
  getMessages,
  isUserInChannel,
};
