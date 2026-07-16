import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { getApp, resetDb, createTestUser } from "./helpers";
import { db } from "../db";
import { matches, swipes, blockedUsers } from "@shared/schema";
import { eq } from "drizzle-orm";

let app: Express;

beforeAll(async () => {
  app = await getApp();
});

beforeEach(async () => {
  await resetDb();
});

describe("registration and login", () => {
  it("registers a new user and returns a token", async () => {
    const res = await request(app).post("/api/register").send({
      email: "newuser@example.com",
      password: "Password123!",
      firstName: "Amina",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("newuser@example.com");
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.token).toBeTruthy();
  });

  it("rejects duplicate registration", async () => {
    const payload = {
      email: "dupe@example.com",
      password: "Password123!",
      firstName: "Amina",
    };
    await request(app).post("/api/register").send(payload);
    const res = await request(app).post("/api/register").send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it("rejects weak passwords", async () => {
    const res = await request(app).post("/api/register").send({
      email: "weak@example.com",
      password: "short",
      firstName: "Amina",
    });

    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials and rejects wrong password", async () => {
    await request(app).post("/api/register").send({
      email: "login@example.com",
      password: "Password123!",
      firstName: "Amina",
    });

    const ok = await request(app)
      .post("/api/login")
      .send({ email: "login@example.com", password: "Password123!" });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const bad = await request(app)
      .post("/api/login")
      .send({ email: "login@example.com", password: "WrongPassword1!" });
    expect(bad.status).toBe(401);
  });

  it("requires auth for /api/auth/user and accepts a Bearer token", async () => {
    const anon = await request(app).get("/api/auth/user");
    expect(anon.status).toBe(401);

    const user = await createTestUser();
    const res = await request(app)
      .get("/api/auth/user")
      .set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.password).toBeUndefined();
  });

  it("rejects a forged Bearer token", async () => {
    const res = await request(app)
      .get("/api/auth/user")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("dev/admin backdoors outside development", () => {
  it.each([
    "/api/dev/activate-premium",
    "/api/dev-verify",
    "/api/dev/reset-matches",
    "/api/dev/backfill-channels",
    "/api/dev/cleanup-welcome-messages",
    "/api/dev/cleanup-orphaned-channels",
    "/api/dev/backfill-sendbird-users",
  ])("%s returns 404", async (path) => {
    const user = await createTestUser();
    const res = await request(app)
      .post(path)
      .set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(404);
  });

  it("rejects the demo seeder when ADMIN_SEED_KEY is unset", async () => {
    const res = await request(app)
      .post("/api/admin/seed-demo-profiles")
      .send({ adminKey: "fusion-seed-2024" });
    expect(res.status).toBe(404);
  });
});

describe("stripe webhook", () => {
  it("rejects requests without a stripe signature", async () => {
    const res = await request(app)
      .post("/api/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "checkout.session.completed" }));
    expect(res.status).toBe(400);
  });

  it("rejects unverifiable events when no webhook secret is configured", async () => {
    const res = await request(app)
      .post("/api/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=forged")
      .send(JSON.stringify({ type: "checkout.session.completed" }));
    expect(res.status).toBe(500);
  });
});

describe("swiping and matching", () => {
  it("requires face verification before swiping", async () => {
    const swiper = await createTestUser({ withProfile: true, faceVerified: false });
    const target = await createTestUser({ withProfile: true, faceVerified: true, gender: "female" });

    const res = await request(app)
      .post("/api/swipe")
      .set("Authorization", `Bearer ${swiper.token}`)
      .send({ swipedId: target.id, direction: "right" });

    expect(res.status).toBe(403);
    expect(res.body.requiresVerification).toBe(true);
  });

  it("validates direction and rejects self-swipes", async () => {
    const swiper = await createTestUser({ withProfile: true, faceVerified: true });

    const badDirection = await request(app)
      .post("/api/swipe")
      .set("Authorization", `Bearer ${swiper.token}`)
      .send({ swipedId: swiper.id, direction: "up" });
    expect(badDirection.status).toBe(400);

    const selfSwipe = await request(app)
      .post("/api/swipe")
      .set("Authorization", `Bearer ${swiper.token}`)
      .send({ swipedId: swiper.id, direction: "right" });
    expect(selfSwipe.status).toBe(400);
  });

  it("does not create a match on mutual likes when neither user subscribes", async () => {
    const a = await createTestUser({ withProfile: true, faceVerified: true });
    const b = await createTestUser({ withProfile: true, faceVerified: true, gender: "female" });

    await request(app)
      .post("/api/swipe")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ swipedId: b.id, direction: "right" });
    const res = await request(app)
      .post("/api/swipe")
      .set("Authorization", `Bearer ${b.token}`)
      .send({ swipedId: a.id, direction: "right" });

    expect(res.status).toBe(200);
    expect(res.body.isMatch).toBe(false);

    const allMatches = await db.select().from(matches);
    expect(allMatches).toHaveLength(0);
  });

  it("creates a match on mutual likes when one user has an active subscription", async () => {
    const a = await createTestUser({
      withProfile: true,
      faceVerified: true,
      subscriptionStatus: "active",
    });
    const b = await createTestUser({ withProfile: true, faceVerified: true, gender: "female" });

    await request(app)
      .post("/api/swipe")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ swipedId: b.id, direction: "right" });
    const res = await request(app)
      .post("/api/swipe")
      .set("Authorization", `Bearer ${b.token}`)
      .send({ swipedId: a.id, direction: "right" });

    expect(res.status).toBe(200);
    expect(res.body.isMatch).toBe(true);
    expect(res.body.matchId).toBeTruthy();

    const allMatches = await db.select().from(matches);
    expect(allMatches).toHaveLength(1);
  });

  it("updates rather than duplicates a repeated swipe on the same person", async () => {
    const a = await createTestUser({ withProfile: true, faceVerified: true });
    const b = await createTestUser({ withProfile: true, faceVerified: true, gender: "female" });

    await request(app)
      .post("/api/swipe")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ swipedId: b.id, direction: "left" });
    await request(app)
      .post("/api/swipe")
      .set("Authorization", `Bearer ${a.token}`)
      .send({ swipedId: b.id, direction: "right" });

    const rows = await db.select().from(swipes).where(eq(swipes.swiperId, a.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].direction).toBe("right");
  });
});

describe("blocking and reporting", () => {
  it("blocks a user and removes any match between them", async () => {
    const a = await createTestUser({ withProfile: true, faceVerified: true });
    const b = await createTestUser({ withProfile: true, faceVerified: true, gender: "female" });
    await db.insert(matches).values({ user1Id: a.id, user2Id: b.id });

    const res = await request(app)
      .post(`/api/users/${b.id}/block`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ reason: "harassment" });

    expect(res.status).toBe(200);
    const blocked = await db.select().from(blockedUsers);
    expect(blocked).toHaveLength(1);
    const remainingMatches = await db.select().from(matches);
    expect(remainingMatches).toHaveLength(0);
  });

  it("rejects blocking yourself", async () => {
    const a = await createTestUser();
    const res = await request(app)
      .post(`/api/users/${a.id}/block`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("submits a report", async () => {
    const a = await createTestUser();
    const b = await createTestUser();

    const res = await request(app)
      .post(`/api/users/${b.id}/report`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ reason: "fake_profile", details: "Photos look like stock images" });

    expect(res.status).toBe(200);
    expect(res.body.report.reporterId).toBe(a.id);
  });
});
