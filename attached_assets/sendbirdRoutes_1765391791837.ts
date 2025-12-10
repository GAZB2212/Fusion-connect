import express from 'express';
import axios from 'axios';

const router = express.Router();

const SENDBIRD_APP_ID = process.env.SENDBIRD_APP_ID;
const SENDBIRD_API_TOKEN = process.env.SENDBIRD_API_TOKEN;

/**
 * Generate Sendbird session token for a user
 * This fixes the "Failed to generate Sendbird token" error
 */
async function generateSessionToken(userId: string): Promise<string> {
  try {
    const response = await axios.post(
      `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3/users/${userId}/token`,
      {},
      {
        headers: {
          'Api-Token': SENDBIRD_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.token;
  } catch (error: any) {
    console.error('Error generating Sendbird token:', error.response?.data || error.message);
    throw new Error('Failed to generate Sendbird session token');
  }
}

/**
 * Create or update Sendbird user
 */
async function createOrUpdateUser(
  userId: string,
  nickname: string,
  profileUrl?: string
): Promise<any> {
  try {
    const response = await axios.put(
      `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3/users/${userId}`,
      {
        user_id: userId,
        nickname: nickname,
        profile_url: profileUrl || '',
        issue_access_token: true,
      },
      {
        headers: {
          'Api-Token': SENDBIRD_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error creating/updating user:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * POST /api/sendbird/init
 * Initialize user and get session token
 */
router.post('/init', async (req, res) => {
  try {
    const { userId, nickname, profileUrl } = req.body;

    if (!userId || !nickname) {
      return res.status(400).json({ error: 'userId and nickname are required' });
    }

    // Create/update user
    const user = await createOrUpdateUser(userId, nickname, profileUrl);

    // Generate session token
    const sessionToken = await generateSessionToken(userId);

    res.json({
      success: true,
      userId: user.user_id,
      nickname: user.nickname,
      accessToken: sessionToken,
      appId: SENDBIRD_APP_ID,
    });
  } catch (error: any) {
    console.error('Error in /init:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize Sendbird',
    });
  }
});

/**
 * POST /api/sendbird/channel/create
 * Create group channel with 2 users + optional chaperone(s)
 */
router.post('/channel/create', async (req, res) => {
  try {
    const { user1Id, user2Id, chaperone1Id, chaperone2Id, channelName } = req.body;

    if (!user1Id || !user2Id) {
      return res.status(400).json({ error: 'user1Id and user2Id are required' });
    }

    // Build user list - always include both users
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

    const chaperoneCount = chaperones.length;

    // Create channel via Sendbird API
    const response = await axios.post(
      `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3/group_channels`,
      {
        user_ids: userIds,
        is_distinct: true, // Reuse existing channel if same members
        name: channelName || `Chat: ${user1Id} & ${user2Id}${chaperoneCount > 0 ? ' (Chaperoned)' : ''}`,
        custom_type: chaperoneCount > 0 ? 'chaperoned' : 'direct',
        data: JSON.stringify({
          hasChaperone: chaperoneCount > 0,
          chaperoneCount,
          chaperones,
          user1Id,
          user2Id,
          createdAt: new Date().toISOString(),
        }),
      },
      {
        headers: {
          'Api-Token': SENDBIRD_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      channel: response.data,
      channelUrl: response.data.channel_url,
      memberCount: userIds.length,
      chaperoneCount,
    });
  } catch (error: any) {
    console.error('Error creating channel:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create channel',
    });
  }
});

/**
 * POST /api/sendbird/channel/add-chaperone
 * Add chaperone to existing channel (supports adding multiple chaperones)
 */
router.post('/channel/add-chaperone', async (req, res) => {
  try {
    const { channelUrl, chaperoneId } = req.body;

    if (!channelUrl || !chaperoneId) {
      return res.status(400).json({ error: 'channelUrl and chaperoneId are required' });
    }

    // Get current channel data
    const channelResponse = await axios.get(
      `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3/group_channels/${encodeURIComponent(channelUrl)}`,
      {
        headers: {
          'Api-Token': SENDBIRD_API_TOKEN,
        },
      }
    );

    const currentData = channelResponse.data.data ? JSON.parse(channelResponse.data.data) : {};
    const currentChaperones = currentData.chaperones || [];

    // Check if chaperone already in channel
    if (currentChaperones.includes(chaperoneId)) {
      return res.json({
        success: true,
        message: 'Chaperone already in channel',
        alreadyAdded: true,
      });
    }

    // Invite chaperone to channel
    await axios.post(
      `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3/group_channels/${encodeURIComponent(channelUrl)}/invite`,
      {
        user_ids: [chaperoneId],
      },
      {
        headers: {
          'Api-Token': SENDBIRD_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    // Update channel metadata with new chaperone list
    const updatedChaperones = [...currentChaperones, chaperoneId];
    await axios.put(
      `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3/group_channels/${encodeURIComponent(channelUrl)}`,
      {
        custom_type: 'chaperoned',
        data: JSON.stringify({
          ...currentData,
          hasChaperone: true,
          chaperoneCount: updatedChaperones.length,
          chaperones: updatedChaperones,
          lastChaperoneAddedAt: new Date().toISOString(),
        }),
      },
      {
        headers: {
          'Api-Token': SENDBIRD_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      message: 'Chaperone added successfully',
      chaperoneCount: updatedChaperones.length,
      chaperones: updatedChaperones,
    });
  } catch (error: any) {
    console.error('Error adding chaperone:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add chaperone',
    });
  }
});

/**
 * GET /api/sendbird/channel/:channelUrl
 * Get channel details
 */
router.get('/channel/:channelUrl', async (req, res) => {
  try {
    const { channelUrl } = req.params;

    const response = await axios.get(
      `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3/group_channels/${encodeURIComponent(channelUrl)}`,
      {
        headers: {
          'Api-Token': SENDBIRD_API_TOKEN,
        },
      }
    );

    res.json({
      success: true,
      channel: response.data,
    });
  } catch (error: any) {
    console.error('Error getting channel:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get channel',
    });
  }
});

export default router;
