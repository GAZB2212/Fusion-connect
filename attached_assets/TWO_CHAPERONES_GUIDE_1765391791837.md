# Sendbird with 2 Chaperones - Complete Guide

## 🎯 Overview

Your app now supports **4-person group chats**: User 1 + User 2 + Chaperone 1 + Chaperone 2

### Scenarios:

1. **No chaperones:** 2-person chat (User1 + User2)
2. **One chaperone:** 3-person chat (User1 + User2 + Chaperone1)
3. **Two chaperones:** 4-person chat (User1 + User2 + Chaperone1 + Chaperone2)

---

## 📋 How It Works

### User 1 has a chaperone, User 2 has a chaperone
```
Channel Members: [User1, User2, Chaperone1, Chaperone2]
Total: 4 people
All 4 can see all messages
```

### User 1 has a chaperone, User 2 doesn't
```
Channel Members: [User1, User2, Chaperone1]
Total: 3 people
All 3 can see all messages
```

### Neither user has a chaperone
```
Channel Members: [User1, User2]
Total: 2 people
Direct private chat
```

---

## 🚀 Implementation

### 1. Backend API Call

```typescript
// Create channel with both chaperones
const response = await fetch('/api/sendbird/channel/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user1Id: 'user_123',
    user2Id: 'user_456',
    chaperone1Id: 'chaperone_789',  // User 1's chaperone
    chaperone2Id: 'chaperone_012',  // User 2's chaperone
    channelName: 'Ahmed & Fatima'
  })
});

const { channelUrl, memberCount, chaperoneCount } = await response.json();
// memberCount: 4
// chaperoneCount: 2
```

### 2. With Only One Chaperone

```typescript
// User 1 has chaperone, User 2 doesn't
const response = await fetch('/api/sendbird/channel/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user1Id: 'user_123',
    user2Id: 'user_456',
    chaperone1Id: 'chaperone_789',  // Only User 1's chaperone
    chaperone2Id: null,              // User 2 has no chaperone
  })
});

// Creates 3-person channel
```

### 3. React Component Usage

```tsx
<ChaperoneChat
  currentUserId="user1"
  currentUserName="Ahmed"
  otherUserId="user2"
  otherUserName="Fatima"
  chaperone1Id="chaperone1"      // Ahmed's chaperone
  chaperone1Name="Ahmed's Dad"
  chaperone2Id="chaperone2"      // Fatima's chaperone
  chaperone2Name="Fatima's Mom"
/>
```

### 4. Dynamic Chaperone Assignment

```typescript
// In your matching logic
function createChatChannel(user1, user2) {
  return fetch('/api/sendbird/channel/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user1Id: user1.id,
      user2Id: user2.id,
      // Only include chaperone if user has one
      chaperone1Id: user1.chaperoneId || null,
      chaperone2Id: user2.chaperoneId || null,
    })
  });
}
```

---

## 🔧 Adding Chaperones Later

You can add chaperones to an existing channel:

```typescript
// User 2 later adds a chaperone
await fetch('/api/sendbird/channel/add-chaperone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channelUrl: 'existing_channel_url',
    chaperoneId: 'new_chaperone_id'
  })
});

// Channel automatically updates from 3 people to 4 people
```

---

## 📊 Channel Metadata

The channel stores metadata about chaperones:

```json
{
  "hasChaperone": true,
  "chaperoneCount": 2,
  "chaperones": ["chaperone1_id", "chaperone2_id"],
  "user1Id": "user_123",
  "user2Id": "user_456",
  "createdAt": "2025-12-10T18:00:00Z"
}
```

You can check this in your app:

```typescript
const channel = await getChannel(channelUrl);
const data = JSON.parse(channel.data);

console.log(`Has ${data.chaperoneCount} chaperone(s)`);
console.log(`Chaperones: ${data.chaperones.join(', ')}`);
```

---

## 🎨 UI Examples

### Chat Header with 2 Chaperones

```tsx
<div className="chat-header">
  <h3>Chat with Fatima</h3>
  <div className="chaperone-badges">
    <span className="chaperone-badge">
      👁️ Ahmed's Dad
    </span>
    <span className="chaperone-badge">
      👁️ Fatima's Mom
    </span>
  </div>
</div>
```

### Member List Display

```tsx
<div className="channel-members">
  <div className="member">Ahmed (You)</div>
  <div className="member">Fatima</div>
  <div className="member chaperone">👁️ Ahmed's Dad</div>
  <div className="member chaperone">👁️ Fatima's Mom</div>
</div>
```

---

## ⚡ Performance Considerations

### Sendbird Limits
- **Max members per group channel:** 100
- **Your setup:** 2-4 members (well within limits)
- **Message history:** Unlimited
- **Concurrent users:** Unlimited on paid plans

### Best Practices

1. **Create channel once:** Use `is_distinct: true` to reuse existing channels
2. **Add chaperones at creation:** Better than adding later
3. **Cache channel URLs:** Don't recreate channels unnecessarily
4. **Index by member IDs:** Find existing channels quickly

---

## 🔐 Privacy & Security

### Message Visibility

✅ **All members see all messages:**
- User 1 sees everything
- User 2 sees everything
- Chaperone 1 sees everything
- Chaperone 2 sees everything

### Chaperone Permissions

By default, chaperones have the same permissions as regular members. If you want to restrict chaperones:

```typescript
// Option 1: Use custom_type to identify chaperones
channel.customType = 'chaperoned';

// Option 2: Store role in metadata
const memberData = {
  userId: 'chaperone1',
  role: 'chaperone',
  canSend: false,  // Read-only chaperone
};

// Option 3: Implement in your UI
if (isChaperone(userId)) {
  // Hide send button
  // Show "viewing only" badge
}
```

---

## 🧪 Testing Scenarios

### Test 1: Create 4-Person Channel
```bash
curl -X POST http://localhost:3000/api/sendbird/channel/create \
  -H "Content-Type: application/json" \
  -d '{
    "user1Id": "test_user1",
    "user2Id": "test_user2",
    "chaperone1Id": "chaperone1",
    "chaperone2Id": "chaperone2"
  }'

# Expected: { success: true, memberCount: 4, chaperoneCount: 2 }
```

### Test 2: Create 3-Person Channel (One Chaperone)
```bash
curl -X POST http://localhost:3000/api/sendbird/channel/create \
  -H "Content-Type: application/json" \
  -d '{
    "user1Id": "test_user1",
    "user2Id": "test_user2",
    "chaperone1Id": "chaperone1"
  }'

# Expected: { success: true, memberCount: 3, chaperoneCount: 1 }
```

### Test 3: Add Second Chaperone Later
```bash
curl -X POST http://localhost:3000/api/sendbird/channel/add-chaperone \
  -H "Content-Type: application/json" \
  -d '{
    "channelUrl": "sendbird_group_channel_...",
    "chaperoneId": "chaperone2"
  }'

# Expected: { success: true, chaperoneCount: 2 }
```

---

## 🐛 Troubleshooting

### Problem: Chaperone can't see messages

**Solution:** Check that:
1. Chaperone has valid session token
2. Chaperone is in `user_ids` array when creating channel
3. Channel was created successfully (no 500 errors)

```typescript
// Debug: Check channel members
const channel = await getChannel(channelUrl);
const memberIds = channel.members.map(m => m.userId);
console.log('Members:', memberIds);
// Should include both users + both chaperones
```

### Problem: Can't add second chaperone

**Solution:** Ensure first chaperone was added properly:

```typescript
// Check channel data
const channel = await getChannel(channelUrl);
const data = JSON.parse(channel.data);
console.log('Current chaperones:', data.chaperones);
// Should show array of chaperone IDs
```

### Problem: Duplicate channels created

**Solution:** Use `is_distinct: true`:

```typescript
// This prevents duplicates
{
  user_ids: [user1, user2, chap1, chap2],
  is_distinct: true  // ← Important!
}
```

---

## 📱 Real-World Example

```typescript
// Complete flow: User matching with chaperones
async function handleMatchAccepted(user1, user2) {
  // 1. Check if users have chaperones
  const user1Chaperone = await getChaperone(user1.id);
  const user2Chaperone = await getChaperone(user2.id);
  
  // 2. Initialize both users
  const [token1, token2] = await Promise.all([
    fetch('/api/sendbird/init', {
      method: 'POST',
      body: JSON.stringify({ 
        userId: user1.id, 
        nickname: user1.name 
      })
    }),
    fetch('/api/sendbird/init', {
      method: 'POST',
      body: JSON.stringify({ 
        userId: user2.id, 
        nickname: user2.name 
      })
    })
  ]);
  
  // 3. Initialize chaperones if they exist
  if (user1Chaperone) {
    await fetch('/api/sendbird/init', {
      method: 'POST',
      body: JSON.stringify({ 
        userId: user1Chaperone.id, 
        nickname: user1Chaperone.name 
      })
    });
  }
  
  if (user2Chaperone) {
    await fetch('/api/sendbird/init', {
      method: 'POST',
      body: JSON.stringify({ 
        userId: user2Chaperone.id, 
        nickname: user2Chaperone.name 
      })
    });
  }
  
  // 4. Create channel with all members
  const channel = await fetch('/api/sendbird/channel/create', {
    method: 'POST',
    body: JSON.stringify({
      user1Id: user1.id,
      user2Id: user2.id,
      chaperone1Id: user1Chaperone?.id || null,
      chaperone2Id: user2Chaperone?.id || null,
      channelName: `${user1.name} & ${user2.name}`
    })
  });
  
  // 5. Save channel URL to database
  await saveChannelToDatabase({
    user1Id: user1.id,
    user2Id: user2.id,
    channelUrl: channel.channelUrl,
    hasChaperones: !!(user1Chaperone || user2Chaperone)
  });
  
  // 6. Send notifications
  await sendMatchNotification(user1.email, user2.name);
  await sendMatchNotification(user2.email, user1.name);
  
  return channel.channelUrl;
}
```

---

## ✅ Summary

Your Sendbird setup now fully supports:
- ✅ 2-person chats (no chaperones)
- ✅ 3-person chats (one chaperone)
- ✅ 4-person chats (two chaperones)
- ✅ Adding chaperones later
- ✅ Proper token generation
- ✅ All members see all messages
- ✅ Metadata tracking chaperone status

The code handles all scenarios automatically. Just pass the chaperone IDs when creating the channel, and everything works!
