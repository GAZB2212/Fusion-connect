import express, { type Express } from "express";
import { vi } from "vitest";

// External services are not exercised in API tests
vi.mock("../sendbird", () => ({
  SendbirdService: {
    createOrUpdateUser: vi.fn().mockResolvedValue({}),
    createChannel: vi.fn().mockResolvedValue({}),
    inviteToChannel: vi.fn().mockResolvedValue({}),
    sendSystemMessage: vi.fn().mockResolvedValue({}),
    generateSessionToken: vi.fn().mockResolvedValue("fake-session-token"),
    deleteUser: vi.fn().mockResolvedValue({}),
    listUserChannels: vi.fn().mockResolvedValue([]),
    deleteChannel: vi.fn().mockResolvedValue({}),
  },
}));

import { db } from "../db";
import { generateToken } from "../auth";
import {
  users,
  profiles,
  swipes,
  matches,
  blockedUsers,
  userReports,
} from "@shared/schema";
import bcrypt from "bcrypt";

let appPromise: Promise<Express> | null = null;

/** Build the full API app once and reuse it across tests in a file. */
export function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = (async () => {
      const { registerRoutes } = await import("../routes");
      const app = express();
      // Mirror the raw-body mounting from server/index.ts so webhook
      // signature handling behaves like production
      app.use("/api/webhook", express.raw({ type: "application/json" }));
      app.use(express.json({ limit: "50mb" }));
      await registerRoutes(app);
      return app;
    })();
  }
  return appPromise;
}

/** Remove all rows the API tests create, in FK-safe order. */
export async function resetDb() {
  await db.delete(userReports);
  await db.delete(blockedUsers);
  await db.delete(matches);
  await db.delete(swipes);
  await db.delete(profiles);
  await db.delete(users);
}

let userCounter = 0;

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

/** Insert a user (and optionally a profile) directly, returning a JWT. */
export async function createTestUser(opts: {
  withProfile?: boolean;
  faceVerified?: boolean;
  gender?: string;
  subscriptionStatus?: string;
} = {}): Promise<TestUser> {
  userCounter += 1;
  const email = `testuser${userCounter}-${Date.now()}@example.com`;
  const password = await bcrypt.hash("Password123!", 4);

  const [user] = await db
    .insert(users)
    .values({
      email,
      password,
      firstName: `Test${userCounter}`,
      subscriptionStatus: opts.subscriptionStatus ?? null,
    })
    .returning();

  if (opts.withProfile) {
    await db.insert(profiles).values({
      userId: user.id,
      displayName: `Test${userCounter}`,
      age: 28,
      gender: opts.gender ?? "male",
      location: "London, UK",
      lookingFor: "Marriage",
      faceVerified: opts.faceVerified ?? false,
    });
  }

  return { id: user.id, email, token: generateToken(user.id) };
}
