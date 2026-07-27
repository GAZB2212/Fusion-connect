/**
 * Seed demo profiles so Discover and Likes can be tested with real-looking data.
 *
 * Run on the backend (where DATABASE_URL is set):
 *   npx tsx server/scripts/seed-demo.ts
 *
 * - Creates ~12 complete, verified profiles of the OPPOSITE gender to the
 *   target account (default: gazbishton1@me.com — override with SEED_FOR_EMAIL).
 * - Makes ~5 of them "like" the target account so the Likes tab has entries.
 * - Idempotent: every demo account uses an @fusion.test email, so re-running
 *   won't create duplicates.
 *
 * To remove later:  DELETE FROM users WHERE email LIKE '%@fusion.test';
 * (profiles / swipes cascade off the user rows.)
 */
import { db } from "../db";
import { users, profiles, swipes } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const TARGET_EMAIL = process.env.SEED_FOR_EMAIL || "gazbishton1@me.com";

// UK cities with rough coordinates for distance sorting.
const CITIES: { location: string; lat: number; lng: number }[] = [
  { location: "London, United Kingdom", lat: 51.5074, lng: -0.1278 },
  { location: "Manchester, United Kingdom", lat: 53.4808, lng: -2.2426 },
  { location: "Birmingham, United Kingdom", lat: 52.4862, lng: -1.8904 },
  { location: "Liverpool, United Kingdom", lat: 53.4084, lng: -2.9916 },
  { location: "Leeds, United Kingdom", lat: 53.8008, lng: -1.5491 },
  { location: "Bradford, United Kingdom", lat: 53.795, lng: -1.759 },
];

const SECTS = ["Sunni", "Sunni", "Shia", "No preference"];
const PRACTICE = ["Strictly practising", "Actively practising", "Moderately practising"];
const PRAYER = ["Always", "Most of the time", "Sometimes"];

const FEMALE = [
  { name: "Aisha", age: 27, prof: "Pharmacist", bio: "Family-oriented and looking for someone kind, ambitious and God-conscious." },
  { name: "Fatima", age: 25, prof: "Teacher", bio: "Love reading, travel and a good cup of chai. Seeking a serious, halal connection." },
  { name: "Maryam", age: 29, prof: "Doctor", bio: "Busy but balanced. Faith and family come first for me." },
  { name: "Zainab", age: 26, prof: "Solicitor", bio: "Down to earth, love the outdoors. Looking for my other half insha'Allah." },
  { name: "Hafsa", age: 24, prof: "Dentist", bio: "Foodie, big on charity work. Want a partner to grow in deen with." },
  { name: "Khadija", age: 31, prof: "Architect", bio: "Calm, creative and career-driven. Seeking marriage, not games." },
  { name: "Sumaya", age: 28, prof: "Accountant", bio: "Homely and warm. Value honesty and a good sense of humour." },
  { name: "Ayesha", age: 23, prof: "Nurse", bio: "Kind-hearted and easy-going. Ready to settle down with the right person." },
  { name: "Ruqayya", age: 30, prof: "Optometrist", bio: "Love hiking and cooking for family. Practising and family-focused." },
  { name: "Safiya", age: 26, prof: "Teacher", bio: "Gentle soul, love learning. Looking for someone grounded in faith." },
  { name: "Noor", age: 27, prof: "Engineer", bio: "Ambitious and warm. Seeking a serious companion for life." },
  { name: "Amina", age: 25, prof: "Physiotherapist", bio: "Active, positive and family-minded. Deen and character matter most." },
];

const MALE = [
  { name: "Yusuf", age: 29, prof: "Engineer", bio: "Family-oriented, ambitious and practising. Looking for a serious partner." },
  { name: "Ibrahim", age: 31, prof: "Doctor", bio: "Calm and driven. Faith and family come first for me." },
  { name: "Bilal", age: 28, prof: "Accountant", bio: "Easy-going, love sport and travel. Seeking marriage insha'Allah." },
  { name: "Hamza", age: 27, prof: "Solicitor", bio: "Honest and grounded. Want to grow in deen with the right person." },
  { name: "Omar", age: 30, prof: "Architect", bio: "Creative and family-focused. Looking for my other half." },
  { name: "Idris", age: 26, prof: "Pharmacist", bio: "Warm and down to earth. Value kindness and good character." },
  { name: "Musa", age: 32, prof: "Business owner", bio: "Hard-working and homely. Ready to settle down." },
  { name: "Zaid", age: 25, prof: "Teacher", bio: "Patient and caring. Seeking a practising, family-minded partner." },
  { name: "Ismail", age: 29, prof: "Dentist", bio: "Love the outdoors and charity work. Faith comes first." },
  { name: "Tariq", age: 28, prof: "Engineer", bio: "Ambitious, kind and sincere. Looking for marriage, not games." },
  { name: "Adam", age: 27, prof: "Physiotherapist", bio: "Positive and active. Deen and character matter most to me." },
  { name: "Kareem", age: 30, prof: "Optometrist", bio: "Grounded and warm. Seeking a serious companion for life." },
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function main() {
  const [target] = await db.select().from(users).where(eq(users.email, TARGET_EMAIL)).limit(1);
  if (!target) {
    console.error(`Target account not found for email ${TARGET_EMAIL}. Set SEED_FOR_EMAIL.`);
    process.exit(1);
  }

  const [targetProfile] = await db.select().from(profiles).where(eq(profiles.userId, target.id)).limit(1);
  const targetGender = targetProfile?.gender || "male";
  const seedGender = targetGender === "male" ? "female" : "male";
  const people = seedGender === "female" ? FEMALE : MALE;
  const photoPath = seedGender === "female" ? "women" : "men";

  console.log(`Seeding ${people.length} ${seedGender} demo profiles for ${TARGET_EMAIL} (${targetGender})...`);

  let created = 0;
  const createdUserIds: string[] = [];

  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const email = `demo.${p.name.toLowerCase()}${i}@fusion.test`;

    // Skip if this demo user already exists (idempotent re-runs).
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      const [u] = await db
        .insert(users)
        .values({ email, firstName: p.name, subscriptionStatus: "active" })
        .returning();
      userId = u.id;
      created++;
    }
    createdUserIds.push(userId);

    const city = pick(CITIES, i);
    // Jitter coords slightly so distances differ.
    const lat = city.lat + (i % 3) * 0.02;
    const lng = city.lng + (i % 4) * 0.02;

    const [existingProfile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    const profileValues = {
      userId,
      displayName: p.name,
      age: p.age,
      gender: seedGender,
      location: city.location,
      latitude: lat,
      longitude: lng,
      bio: p.bio,
      profession: p.prof,
      occupation: p.prof,
      lookingFor: "Marriage",
      sect: pick(SECTS, i),
      religiousPractice: pick(PRACTICE, i),
      prayerFrequency: pick(PRAYER, i),
      photos: [`https://randomuser.me/api/portraits/${photoPath}/${(i % 90) + 1}.jpg`],
      isComplete: true,
      isActive: true,
      faceVerified: true,
      isVerified: true,
    };

    if (existingProfile) {
      await db.update(profiles).set(profileValues).where(eq(profiles.userId, userId));
    } else {
      await db.insert(profiles).values(profileValues);
    }
  }

  // Have the first 5 demo accounts "like" the target so the Likes tab fills up.
  const likers = createdUserIds.slice(0, 5);
  let likesCreated = 0;
  for (const likerId of likers) {
    const [existing] = await db
      .select()
      .from(swipes)
      .where(and(eq(swipes.swiperId, likerId), eq(swipes.swipedId, target.id)))
      .limit(1);
    if (!existing) {
      await db.insert(swipes).values({ swiperId: likerId, swipedId: target.id, direction: "right" });
      likesCreated++;
    }
  }

  console.log(`✅ Done. ${created} new users, ${people.length} profiles ready, ${likesCreated} likes on ${TARGET_EMAIL}.`);
  console.log(`Open the app → Discover should show profiles, Likes should show ${likers.length}.`);
  console.log(`To remove later: DELETE FROM users WHERE email LIKE '%@fusion.test';`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
