import React, { useEffect, useState } from 'react';
import SendBird from 'sendbird';

interface ChatProps {
  currentUserId: string;
  currentUserName: string;
  otherUserId: string;
  otherUserName: string;
  chaperone1Id?: string; // User 1's chaperone
  chaperone1Name?: string;
  chaperone2Id?: string; // User 2's chaperone
  chaperone2Name?: string;
}

export const ChaperoneChat: React.FC<ChatProps> = ({
  currentUserId,
  currentUserName,
  otherUserId,
  otherUserName,
  chaperone1Id,
  chaperone1Name,
  chaperone2Id,
  chaperone2Name,
}) => {
  const [sb, setSb] = useState<SendBird.SendBirdInstance | null>(null);
  const [channel, setChannel] = useState<SendBird.GroupChannel | null>(null);
  const [messages, setMessages] = useState<SendBird.UserMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Sendbird
  useEffect(() => {
    initializeSendbird();
  }, [currentUserId]);

  const initializeSendbird = async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Initialize user and get session token from your backend
      const initResponse = await fetch('/api/sendbird/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          nickname: currentUserName,
        }),
      });

      const initData = await initResponse.json();
      
      if (!initData.success) {
        throw new Error(initData.error || 'Failed to initialize');
      }

      // Step 2: Connect to Sendbird with session token
      const sbInstance = new SendBird({ appId: initData.appId });
      
      await new Promise((resolve, reject) => {
        sbInstance.connect(currentUserId, initData.accessToken, (user, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(user);
          }
        });
      });

      setSb(sbInstance);

      // Step 3: Create or get channel
      await createOrGetChannel(sbInstance);

      setLoading(false);
    } catch (err: any) {
      console.error('Error initializing Sendbird:', err);
      setError(err.message || 'Failed to initialize chat');
      setLoading(false);
    }
  };

  const createOrGetChannel = async (sbInstance: SendBird.SendBirdInstance) => {
    try {
      // Create channel via backend API (handles chaperone logic)
      const response = await fetch('/api/sendbird/channel/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1Id: currentUserId,
          user2Id: otherUserId,
          chaperone1Id: chaperone1Id,
          chaperone2Id: chaperone2Id,
          channelName: `${currentUserName} & ${otherUserName}`,
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create channel');
      }

      // Get the channel object
      sbInstance.GroupChannel.getChannel(data.channelUrl, (channel, error) => {
        if (error) {
          setError('Failed to load channel');
          return;
        }

        setChannel(channel);
        loadMessages(channel);
        setupChannelHandlers(sbInstance, channel);
      });
    } catch (err: any) {
      console.error('Error creating channel:', err);
      setError(err.message);
    }
  };

  const loadMessages = (channel: SendBird.GroupChannel) => {
    const listQuery = channel.createPreviousMessageListQuery();
    listQuery.limit = 50;
    listQuery.reverse = true;

    listQuery.load((messages, error) => {
      if (error) {
        console.error('Error loading messages:', error);
        return;
      }
      setMessages(messages as SendBird.UserMessage[]);
    });
  };

  const setupChannelHandlers = (
    sbInstance: SendBird.SendBirdInstance,
    channel: SendBird.GroupChannel
  ) => {
    const channelHandler = new sbInstance.ChannelHandler();

    channelHandler.onMessageReceived = (targetChannel, message) => {
      if (targetChannel.url === channel.url) {
        setMessages((prev) => [...prev, message as SendBird.UserMessage]);
      }
    };

    sbInstance.addChannelHandler('CHAT_HANDLER', channelHandler);
  };

  const sendMessage = () => {
    if (!channel || !messageInput.trim()) return;

    const params = new sb!.UserMessageParams();
    params.message = messageInput.trim();

    channel.sendUserMessage(params, (message, error) => {
      if (error) {
        console.error('Error sending message:', error);
        setError('Failed to send message');
        return;
      }

      setMessages((prev) => [...prev, message]);
      setMessageInput('');
    });
  };

  if (loading) {
    return <div className="chat-loading">Loading chat...</div>;
  }

  if (error) {
    return (
      <div className="chat-error">
        <p>Error: {error}</p>
        <button onClick={initializeSendbird}>Retry</button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat with {otherUserName}</h3>
        {(chaperone1Id || chaperone2Id) && (
          <div className="chaperone-badges">
            {chaperone1Id && (
              <span className="chaperone-badge">
                👁️ {chaperone1Name || 'Chaperone 1'}
              </span>
            )}
            {chaperone2Id && (
              <span className="chaperone-badge">
                👁️ {chaperone2Name || 'Chaperone 2'}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="messages-container">
        {messages.map((msg) => (
          <div
            key={msg.messageId}
            className={`message ${
              msg.sender.userId === currentUserId ? 'sent' : 'received'
            }`}
          >
            <div className="message-sender">{msg.sender.nickname}</div>
            <div className="message-content">{msg.message}</div>
            <div className="message-time">
              {new Date(msg.createdAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      <div className="message-input-container">
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default ChaperoneChat;
