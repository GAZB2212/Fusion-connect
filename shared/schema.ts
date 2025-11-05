import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password"), // Nullable for now to handle migration
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Stripe subscription fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status"), // active, canceled, past_due, etc.
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Extended profile information
export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  
  // Basic Info
  displayName: varchar("display_name", { length: 100 }).notNull(),
  age: integer("age").notNull(),
  gender: varchar("gender", { length: 20 }).notNull(), // male, female
  location: varchar("location", { length: 200 }).notNull(),
  bio: text("bio"),
  height: integer("height"), // in cm
  heightUnit: varchar("height_unit", { length: 10 }).default('cm'), // cm or ft
  
  // Photos
  photos: text("photos").array().notNull().default(sql`ARRAY[]::text[]`),
  mainPhotoIndex: integer("main_photo_index").default(0), // Which photo is the main one
  photoVisibility: varchar("photo_visibility", { length: 20 }).default('visible'), // visible, blurred, hidden
  photoVerified: boolean("photo_verified").default(false), // Photo verification status
  
  // Islamic Preferences
  bornMuslim: boolean("born_muslim"), // Were you born a Muslim?
  sect: varchar("sect", { length: 50 }), // No preference, Sunni, Sunni (Hanafi), Sunni (Maliki), Sunni (Shafi), Sunni (Hanbali), Shia, Shia (Twelver), Shia (Ismaili), Shia (Zaydi), Sufi, Other
  prayerFrequency: varchar("prayer_frequency", { length: 30 }), // Always, Sometimes, Rarely, Prefer not to say
  halalImportance: varchar("halal_importance", { length: 30 }), // Very important, Somewhat important, Not important
  religiosity: varchar("religiosity", { length: 30 }), // Very religious, Moderately religious, Not very religious
  religiousPractice: varchar("religious_practice", { length: 50 }), // Strictly practising, Actively practising, Occasionally practising, Not practising at all
  
  // Intentions & Preferences
  lookingFor: varchar("looking_for", { length: 50 }).notNull(), // Marriage, Friendship, Networking
  maritalStatus: varchar("marital_status", { length: 30 }), // Never married, Separated, Divorced, Annulled, Widowed, Married
  hasChildren: boolean("has_children").default(false),
  wantsChildren: varchar("wants_children", { length: 30 }), // Yes, No, Maybe, Prefer not to say
  
  // Additional Details
  education: varchar("education", { length: 100 }),
  occupation: varchar("occupation", { length: 100 }),
  profession: varchar("profession", { length: 100 }), // Detailed profession from list
  languages: text("languages").array().default(sql`ARRAY[]::text[]`),
  interests: text("interests").array().default(sql`ARRAY[]::text[]`), // Array of interests
  personalityTraits: text("personality_traits").array().default(sql`ARRAY[]::text[]`), // Up to 5 traits
  ethnicities: text("ethnicities").array().default(sql`ARRAY[]::text[]`), // Multi-select ethnicities
  
  // Partner Preferences
  partnerPreferences: jsonb("partner_preferences"), // { ageMin, ageMax, sects, ethnicities, religiousPractice }
  
  // Privacy & Verification
  isVerified: boolean("is_verified").default(false),
  verificationPhoto: varchar("verification_photo"),
  useNickname: boolean("use_nickname").default(false),
  phoneNumber: varchar("phone_number"),
  phoneVerified: boolean("phone_verified").default(false),
  faceVerified: boolean("face_verified").default(false),
  
  // Profile Status
  isComplete: boolean("is_complete").default(false),
  isActive: boolean("is_active").default(true),
  lastActive: timestamp("last_active").defaultNow(), // For "Active today" badge
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Swipes - track user swipe actions
export const swipes = pgTable("swipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  swiperId: varchar("swiper_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  swipedId: varchar("swiped_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  direction: varchar("direction", { length: 10 }).notNull(), // right (like), left (pass)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("swiper_idx").on(table.swiperId),
  index("swiped_idx").on(table.swipedId),
]);

// Matches - mutual likes
export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user1Id: varchar("user1_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  user2Id: varchar("user2_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user1_idx").on(table.user1Id),
  index("user2_idx").on(table.user2Id),
]);

// Messages - chat between matched users
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => matches.id, { onDelete: 'cascade' }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  messageType: varchar("message_type", { length: 20 }).default('text'), // text, call_record
  callDuration: integer("call_duration"), // Duration in seconds for call records
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("match_idx").on(table.matchId),
  index("sender_idx").on(table.senderId),
]);

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("token_idx").on(table.token),
  index("user_reset_idx").on(table.userId),
]);

// Chaperones - Wali/Guardian access to conversations
export const chaperones = pgTable("chaperones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  chaperoneName: varchar("chaperone_name", { length: 100 }).notNull(),
  chaperoneEmail: varchar("chaperone_email", { length: 255 }).notNull(),
  relationshipType: varchar("relationship_type", { length: 50 }), // Father, Mother, Brother, Sister, Guardian
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_chaperone_idx").on(table.userId),
]);

// Video Calls - track video call sessions
export const videoCalls = pgTable("video_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => matches.id, { onDelete: 'cascade' }),
  callerId: varchar("caller_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  channelName: varchar("channel_name", { length: 255 }).notNull(), // Agora channel name
  status: varchar("status", { length: 20 }).notNull().default('initiated'), // initiated, ringing, active, ended, missed, declined
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"), // Duration in seconds
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("match_call_idx").on(table.matchId),
  index("caller_call_idx").on(table.callerId),
  index("receiver_call_idx").on(table.receiverId),
]);

// Push Subscriptions - Store web push notification subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text("endpoint").notNull(),
  auth: text("auth").notNull(),
  p256dh: text("p256dh").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_push_idx").on(table.userId),
]);

// Early signups - waitlist for pre-launch
export const earlySignups = pgTable("early_signups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  firstName: varchar("first_name"),
  promoCode: varchar("promo_code").notNull().unique(),
  position: integer("position").notNull(),
  used: boolean("used").default(false),
  usedBy: varchar("used_by").references(() => users.id, { onDelete: 'set null' }),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Blocked Users - Track user blocks (App Store requirement)
export const blockedUsers = pgTable("blocked_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: varchar("blocked_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text("reason"), // Optional reason for blocking
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("blocker_idx").on(table.blockerId),
  index("blocked_idx").on(table.blockedId),
]);

// User Reports - Track reported users (App Store requirement)
export const userReports = pgTable("user_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportedId: varchar("reported_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: varchar("reason", { length: 50 }).notNull(), // harassment, inappropriate_content, fake_profile, spam, other
  details: text("details"), // Additional details from reporter
  status: varchar("status", { length: 20 }).default('pending'), // pending, reviewed, action_taken, dismissed
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("reporter_idx").on(table.reporterId),
  index("reported_idx").on(table.reportedId),
  index("status_idx").on(table.status),
]);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  sentSwipes: many(swipes, { relationName: "swiper" }),
  receivedSwipes: many(swipes, { relationName: "swiped" }),
  matches1: many(matches, { relationName: "user1" }),
  matches2: many(matches, { relationName: "user2" }),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
  chaperones: many(chaperones),
  initiatedCalls: many(videoCalls, { relationName: "caller" }),
  receivedCalls: many(videoCalls, { relationName: "receiver" }),
  pushSubscriptions: many(pushSubscriptions),
  blocksInitiated: many(blockedUsers, { relationName: "blocker" }),
  blocksReceived: many(blockedUsers, { relationName: "blocked" }),
  reportsInitiated: many(userReports, { relationName: "reporter" }),
  reportsReceived: many(userReports, { relationName: "reported" }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const swipesRelations = relations(swipes, ({ one }) => ({
  swiper: one(users, {
    fields: [swipes.swiperId],
    references: [users.id],
    relationName: "swiper",
  }),
  swiped: one(users, {
    fields: [swipes.swipedId],
    references: [users.id],
    relationName: "swiped",
  }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  user1: one(users, {
    fields: [matches.user1Id],
    references: [users.id],
    relationName: "user1",
  }),
  user2: one(users, {
    fields: [matches.user2Id],
    references: [users.id],
    relationName: "user2",
  }),
  messages: many(messages),
  videoCalls: many(videoCalls),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  match: one(matches, {
    fields: [messages.matchId],
    references: [matches.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const chaperonesRelations = relations(chaperones, ({ one }) => ({
  user: one(users, {
    fields: [chaperones.userId],
    references: [users.id],
  }),
}));

export const videoCallsRelations = relations(videoCalls, ({ one }) => ({
  match: one(matches, {
    fields: [videoCalls.matchId],
    references: [matches.id],
  }),
  caller: one(users, {
    fields: [videoCalls.callerId],
    references: [users.id],
    relationName: "caller",
  }),
  receiver: one(users, {
    fields: [videoCalls.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export const blockedUsersRelations = relations(blockedUsers, ({ one }) => ({
  blocker: one(users, {
    fields: [blockedUsers.blockerId],
    references: [users.id],
    relationName: "blocker",
  }),
  blocked: one(users, {
    fields: [blockedUsers.blockedId],
    references: [users.id],
    relationName: "blocked",
  }),
}));

export const userReportsRelations = relations(userReports, ({ one }) => ({
  reporter: one(users, {
    fields: [userReports.reporterId],
    references: [users.id],
    relationName: "reporter",
  }),
  reported: one(users, {
    fields: [userReports.reportedId],
    references: [users.id],
    relationName: "reported",
  }),
}));

// Zod Schemas for validation
export const insertProfileSchema = createInsertSchema(profiles, {
  displayName: z.string().min(2, "Name must be at least 2 characters").max(100),
  age: z.number().min(18, "Must be 18 or older").max(100),
  gender: z.enum(["male", "female"]),
  location: z.string().min(2, "Location is required"),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  photos: z.array(z.string()).min(3, "Minimum 3 photos required").max(6, "Maximum 6 photos"),
  lookingFor: z.enum(["Marriage", "Friendship", "Networking"]),
  sect: z.string().optional(),
  prayerFrequency: z.string().optional(),
  halalImportance: z.string().optional(),
  religiosity: z.string().optional(),
  personalityTraits: z.array(z.string()).max(5, "Maximum 5 personality traits").optional(),
  ethnicities: z.array(z.string()).optional(),
  partnerPreferences: z.object({
    ageMin: z.number().min(18).max(100).optional(),
    ageMax: z.number().min(18).max(100).optional(),
    sects: z.array(z.string()).optional(),
    ethnicities: z.array(z.string()).optional(),
    religiousPractice: z.array(z.string()).optional(),
  }).optional(),
}).omit({ id: true, userId: true, createdAt: true, updatedAt: true });

export const insertMessageSchema = createInsertSchema(messages, {
  content: z.string().min(1, "Message cannot be empty").max(1000, "Message too long"),
}).omit({ id: true, createdAt: true, isRead: true, senderId: true });

export const insertChaperoneSchema = createInsertSchema(chaperones, {
  chaperoneName: z.string().min(2, "Name is required"),
  chaperoneEmail: z.string().email("Valid email is required"),
  relationshipType: z.string().optional(),
}).omit({ id: true, createdAt: true });

export const insertVideoCallSchema = createInsertSchema(videoCalls, {
  channelName: z.string().min(1, "Channel name is required"),
  status: z.enum(["initiated", "ringing", "active", "ended", "missed", "declined"]),
}).omit({ id: true, createdAt: true, startedAt: true, endedAt: true, duration: true });

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions, {
  endpoint: z.string().url("Valid endpoint URL is required"),
  auth: z.string().min(1, "Auth key is required"),
  p256dh: z.string().min(1, "P256dh key is required"),
}).omit({ id: true, createdAt: true });

export const insertBlockedUserSchema = createInsertSchema(blockedUsers, {
  reason: z.string().optional(),
}).omit({ id: true, createdAt: true, blockerId: true });

export const insertUserReportSchema = createInsertSchema(userReports, {
  reason: z.enum(["harassment", "inappropriate_content", "fake_profile", "spam", "other"]),
  details: z.string().max(500, "Details too long").optional(),
}).omit({ id: true, createdAt: true, reporterId: true, status: true });

export const registerUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = Omit<typeof users.$inferSelect, 'password'>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Swipe = typeof swipes.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Chaperone = typeof chaperones.$inferSelect;
export type InsertChaperone = z.infer<typeof insertChaperoneSchema>;
export type VideoCall = typeof videoCalls.$inferSelect;
export type InsertVideoCall = z.infer<typeof insertVideoCallSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type BlockedUser = typeof blockedUsers.$inferSelect;
export type InsertBlockedUser = z.infer<typeof insertBlockedUserSchema>;
export type UserReport = typeof userReports.$inferSelect;
export type InsertUserReport = z.infer<typeof insertUserReportSchema>;

// Early Signup schemas
export const insertEarlySignupSchema = createInsertSchema(earlySignups).omit({ 
  id: true, 
  promoCode: true, 
  position: true, 
  createdAt: true 
});
export type EarlySignup = typeof earlySignups.$inferSelect;
export type InsertEarlySignup = z.infer<typeof insertEarlySignupSchema>;

// Extended types for API responses
export type ProfileWithUser = Profile & {
  user: User;
};

export type MatchWithProfiles = Match & {
  user1Profile: ProfileWithUser;
  user2Profile: ProfileWithUser;
};

export type MessageWithSender = Message & {
  senderProfile: ProfileWithUser;
};
