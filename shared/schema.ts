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

// User storage table - Required for Replit Auth, extended for app needs
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
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
  
  // Photos
  photos: text("photos").array().notNull().default(sql`ARRAY[]::text[]`),
  photoVisibility: varchar("photo_visibility", { length: 20 }).default('visible'), // visible, blurred, hidden
  
  // Islamic Preferences
  sect: varchar("sect", { length: 50 }), // Sunni, Shia, Just Muslim, etc.
  prayerFrequency: varchar("prayer_frequency", { length: 30 }), // Always, Sometimes, Rarely, Prefer not to say
  halalImportance: varchar("halal_importance", { length: 30 }), // Very important, Somewhat important, Not important
  religiosity: varchar("religiosity", { length: 30 }), // Very religious, Moderately religious, Not very religious
  
  // Intentions & Preferences
  lookingFor: varchar("looking_for", { length: 50 }).notNull(), // Marriage, Friendship, Networking
  maritalStatus: varchar("marital_status", { length: 30 }), // Never married, Divorced, Widowed
  hasChildren: boolean("has_children").default(false),
  wantsChildren: varchar("wants_children", { length: 30 }), // Yes, No, Maybe, Prefer not to say
  
  // Additional Details
  education: varchar("education", { length: 100 }),
  occupation: varchar("occupation", { length: 100 }),
  languages: text("languages").array().default(sql`ARRAY[]::text[]`),
  
  // Privacy & Verification
  isVerified: boolean("is_verified").default(false),
  verificationPhoto: varchar("verification_photo"),
  useNickname: boolean("use_nickname").default(false),
  
  // Profile Status
  isComplete: boolean("is_complete").default(false),
  isActive: boolean("is_active").default(true),
  
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
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("match_idx").on(table.matchId),
  index("sender_idx").on(table.senderId),
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

// Zod Schemas for validation
export const insertProfileSchema = createInsertSchema(profiles, {
  displayName: z.string().min(2, "Name must be at least 2 characters").max(100),
  age: z.number().min(18, "Must be 18 or older").max(100),
  gender: z.enum(["male", "female"]),
  location: z.string().min(2, "Location is required"),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  photos: z.array(z.string()).min(1, "At least one photo is required").max(6, "Maximum 6 photos"),
  lookingFor: z.enum(["Marriage", "Friendship", "Networking"]),
  sect: z.string().optional(),
  prayerFrequency: z.string().optional(),
  halalImportance: z.string().optional(),
  religiosity: z.string().optional(),
}).omit({ id: true, userId: true, createdAt: true, updatedAt: true });

export const insertMessageSchema = createInsertSchema(messages, {
  content: z.string().min(1, "Message cannot be empty").max(1000, "Message too long"),
}).omit({ id: true, createdAt: true, isRead: true });

export const insertChaperoneSchema = createInsertSchema(chaperones, {
  chaperoneName: z.string().min(2, "Name is required"),
  chaperoneEmail: z.string().email("Valid email is required"),
  relationshipType: z.string().optional(),
}).omit({ id: true, createdAt: true });

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Swipe = typeof swipes.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Chaperone = typeof chaperones.$inferSelect;
export type InsertChaperone = z.infer<typeof insertChaperoneSchema>;

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
