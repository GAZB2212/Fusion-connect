import { db } from "../server/db";
import { users, profiles } from "../shared/schema";
import bcrypt from "bcrypt";

const maleNames = [
  "Ahmed Hassan", "Mohammed Ali", "Omar Khan", "Yusuf Ibrahim", "Bilal Ahmed",
  "Tariq Rahman", "Hamza Malik", "Ibrahim Siddiqui", "Abdullah Hussain", "Zain Abbas",
  "Farhan Shaikh", "Rashid Akhtar", "Samir Patel", "Khalid Nawaz", "Usman Raza"
];

const femaleNames = [
  "Aisha Rahman", "Fatima Khan", "Maryam Ali", "Zainab Hassan", "Safiya Ahmed",
  "Amina Malik", "Nadia Ibrahim", "Hana Siddiqui", "Layla Abbas", "Yasmin Hussain",
  "Salma Shaikh", "Dina Akhtar", "Rania Patel", "Leila Nawaz", "Sara Raza"
];

const locations = [
  "London, UK", "Manchester, UK", "Birmingham, UK", "Leeds, UK", "Glasgow, UK",
  "Bradford, UK", "Edinburgh, UK", "Liverpool, UK", "Bristol, UK", "Leicester, UK"
];

const occupations = [
  "Software Engineer", "Doctor", "Teacher", "Accountant", "Pharmacist",
  "Marketing Manager", "Data Analyst", "Nurse", "Architect", "Business Analyst",
  "Lawyer", "Civil Engineer", "Graphic Designer", "Project Manager", "Dentist"
];

const educations = [
  "Bachelor's Degree", "Master's Degree", "PhD", "Medical Degree",
  "Engineering Degree", "Law Degree", "MBA"
];

const bios = [
  "Practicing Muslim looking for someone who shares my faith and values. Love traveling, reading, and spending time with family.",
  "Family-oriented person seeking a life partner to build a halal future together. Enjoy outdoor activities and good conversations.",
  "Devoted to my faith and career. Looking for someone kind, patient, and understanding.",
  "Passionate about community service and helping others. Seeking a genuine connection based on Islamic principles.",
  "Simple person with big dreams. Love cooking, hiking, and learning about the Deen.",
  "Working professional who values family, faith, and personal growth. Looking for my other half.",
  "Adventurous spirit who loves trying new cuisines and exploring new places. Committed to living a halal lifestyle.",
  "Book lover and coffee enthusiast. Seeking someone with similar interests and strong Islamic values.",
  "Fitness enthusiast who believes in balance. Looking for a partner to share life's journey.",
  "Creative professional passionate about art and design. Seeking meaningful connection."
];

const sects = ["Sunni", "Shia"];
const religiosities = ["Very Religious", "Moderately Religious", "Religious"];
const prayerFrequencies = ["5 times daily", "Regularly", "Sometimes"];
const halalImportances = ["Very Important", "Important"];

async function seedProfiles() {
  console.log("Starting to seed profiles...");

  const existingUsers = await db.select().from(users);
  console.log(`Found ${existingUsers.length} existing users`);

  // Create 30 test profiles (15 male, 15 female)
  let createdCount = 0;
  const profilesToCreate = 30;

  for (let i = 0; i < profilesToCreate; i++) {
    const isMale = i < 15;
    const names = isMale ? maleNames : femaleNames;
    const name = names[i % names.length];
    const email = `test${i + 1000}@fusion.com`;
    const age = 22 + Math.floor(Math.random() * 18); // Age between 22-39

    try {
      // Create user
      const [user] = await db.insert(users).values({
        email,
        password: await bcrypt.hash("Test123!", 10),
      }).returning();

      // Create profile
      await db.insert(profiles).values({
        userId: user.id,
        displayName: name,
        age,
        gender: isMale ? "Male" : "Female",
        location: locations[Math.floor(Math.random() * locations.length)],
        bio: bios[Math.floor(Math.random() * bios.length)],
        occupation: occupations[Math.floor(Math.random() * occupations.length)],
        education: educations[Math.floor(Math.random() * educations.length)],
        lookingFor: "Marriage",
        sect: sects[Math.floor(Math.random() * sects.length)],
        religiosity: religiosities[Math.floor(Math.random() * religiosities.length)],
        prayerFrequency: prayerFrequencies[Math.floor(Math.random() * prayerFrequencies.length)],
        halalImportance: halalImportances[Math.floor(Math.random() * halalImportances.length)],
        isComplete: true,
        isActive: true,
        isVerified: Math.random() > 0.5,
        useNickname: false,
        photoVisibility: Math.random() > 0.7 ? "blurred" : "visible",
      });

      createdCount++;
      console.log(`Created profile ${createdCount}/${profilesToCreate}: ${name}`);
    } catch (error) {
      console.error(`Error creating profile for ${name}:`, error);
    }
  }

  console.log(`\nSuccessfully created ${createdCount} test profiles!`);
  console.log("You can now test the swiping and matching features.");
  process.exit(0);
}

seedProfiles().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
