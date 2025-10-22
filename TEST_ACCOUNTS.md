# Test Accounts - Fusion Matchmaking

## Quick Access - New Test Accounts

**All new test accounts use the password:** `Test123!`

### Male Test Accounts (15 new profiles)
- test1000@fusion.com - Ahmed Hassan
- test1001@fusion.com - Mohammed Ali
- test1002@fusion.com - Omar Khan
- test1003@fusion.com - Yusuf Ibrahim
- test1004@fusion.com - Bilal Ahmed
- test1005@fusion.com - Tariq Rahman
- test1006@fusion.com - Hamza Malik
- test1007@fusion.com - Ibrahim Siddiqui
- test1008@fusion.com - Abdullah Hussain
- test1009@fusion.com - Zain Abbas
- test1010@fusion.com - Farhan Shaikh
- test1011@fusion.com - Rashid Akhtar
- test1012@fusion.com - Samir Patel
- test1013@fusion.com - Khalid Nawaz
- test1014@fusion.com - Usman Raza

### Female Test Accounts (15 new profiles)
- test1015@fusion.com - Aisha Rahman
- test1016@fusion.com - Fatima Khan
- test1017@fusion.com - Maryam Ali
- test1018@fusion.com - Zainab Hassan
- test1019@fusion.com - Safiya Ahmed
- test1020@fusion.com - Amina Malik
- test1021@fusion.com - Nadia Ibrahim
- test1022@fusion.com - Hana Siddiqui
- test1023@fusion.com - Layla Abbas
- test1024@fusion.com - Yasmin Hussain
- test1025@fusion.com - Salma Shaikh
- test1026@fusion.com - Dina Akhtar
- test1027@fusion.com - Rania Patel
- test1028@fusion.com - Leila Nawaz
- test1029@fusion.com - Sara Raza

---

## Testing the Subscription System

### 1. Test Free Tier Experience
1. Login as **test1000@fusion.com** (Password: Test123!)
2. Browse profiles and swipe
3. **Swipe right** on a profile you like
4. ✨ **You'll see a dialog: "Upgrade to See Your Matches"**
5. Click "Continue with Free" to keep swiping

### 2. Test Premium Subscription
1. Login as any test account
2. Swipe right on someone
3. Click **"Upgrade to Premium"** in the dialog
4. Enter Stripe test card: **4242 4242 4242 4242**
5. Use any future date (12/25), any CVC (123), any postal code
6. After payment, go to **Matches** to see your matches

### 3. Test Matching Rules

**Free + Free = No Match Created**
- Login as test1000@fusion.com (free user)
- Swipe right on test1015@fusion.com
- Login as test1015@fusion.com (free user)
- Swipe right on test1000@fusion.com
- ❌ No match is created (both are free)

**Premium + Free = Match Created!**
- Subscribe with test1000@fusion.com
- Swipe right on test1015@fusion.com (free user)
- Login as test1015@fusion.com (free)
- Swipe right on test1000@fusion.com (premium)
- ✅ Match is created (one has premium)
- test1000 can see the match
- test1015 sees paywall when trying to view matches

---

## Stripe Test Cards

Use these when testing payments:

- **Successful payment:** 4242 4242 4242 4242
- **Declined payment:** 4000 0000 0000 0002
- **Authentication required:** 4000 0025 0000 3155

Expiry: Any future date (e.g., 12/25)  
CVC: Any 3 digits (e.g., 123)  
Postal: Any code (e.g., 12345)

---

## Database Stats

**Total Complete Profiles:** 54
- 15 Male profiles (from new seed)
- 15 Female profiles (from new seed)
- 24 Original profiles (from earlier testing)

**Profile Features:**
- Ages: 22-39 years old
- Locations: UK cities (London, Manchester, Birmingham, Leeds, etc.)
- Occupations: Software Engineer, Doctor, Teacher, Accountant, etc.
- Education: Bachelor's to PhD
- Religious practices: Very Religious to Moderately Religious
- Sects: Sunni and Shia
- Prayer frequencies: 5 times daily, Regularly, Sometimes
- Some verified ✓, some unverified
- Mix of visible and blurred photos for privacy testing

---

## Original Test Accounts (Password: test123)

### Female Profiles (10 accounts)

1. **Aisha Khan** - aisha.khan@test.com - London, UK - Healthcare Professional
2. **Fatima Ali** - fatima.ali@test.com - Toronto, Canada - Software Engineer
3. **Mariam Hassan** - mariam.hassan@test.com - New York, USA - Teacher
4. **Zainab Ahmed** - zainab.ahmed@test.com - Dubai, UAE - Marketing Manager
5. **Khadija Malik** - khadija.malik@test.com - Manchester, UK - Registered Nurse
6. **Sara Ibrahim** - sara.ibrahim@test.com - Chicago, USA - Graphic Designer
7. **Layla Hussain** - layla.hussain@test.com - Sydney, Australia - Software Developer
8. **Noor Rahman** - noor.rahman@test.com - Birmingham, UK - Pharmacist
9. **Amina Shah** - amina.shah@test.com - Los Angeles, USA - Journalist
10. **Yasmin Siddiqui** - yasmin.siddiqui@test.com - Kuala Lumpur, Malaysia - Entrepreneur

### Male Profiles (10 accounts)

11. **Omar Abdullah** - omar.abdullah@test.com - London, UK - Software Engineer
12. **Ahmed Mohamed** - ahmed.mohamed@test.com - Toronto, Canada - Medical Doctor
13. **Yusuf Ali** - yusuf.ali@test.com - New York, USA - Business Analyst
14. **Ibrahim Khan** - ibrahim.khan@test.com - Dubai, UAE - Architect
15. **Hassan Ahmed** - hassan.ahmed@test.com - Manchester, UK - Teacher
16. **Ali Hassan** - ali.hassan@test.com - Chicago, USA - Financial Analyst
17. **Bilal Malik** - bilal.malik@test.com - Sydney, Australia - Civil Engineer
18. **Hamza Ibrahim** - hamza.ibrahim@test.com - Birmingham, UK - Physiotherapist
19. **Tariq Hussain** - tariq.hussain@test.com - Los Angeles, USA - Accountant
20. **Mustafa Rahman** - mustafa.rahman@test.com - Seattle, USA - IT Consultant

---

## Key Features to Test

✅ **Profile Discovery** - Browse potential matches based on gender preference  
✅ **Swipe System** - Like (heart) or Pass (X) on profiles  
✅ **Free Tier** - Swipe and browse without subscription  
✅ **Upgrade Prompt** - Dialog appears when free users swipe right  
✅ **Subscription** - £9.99/month Stripe payment  
✅ **Match Creation** - Only works if at least one user is premium  
✅ **Matches Page** - Paywall for free users, access for premium  
✅ **Messaging** - Chat with your matches (premium only)  
✅ **Profile Privacy** - Blurred photos, nickname usage  
✅ **Verification Badges** - See verified profiles  

---

## Support

If you need to reset or add more test data, run:
```bash
npx tsx scripts/seed-profiles.ts
```

This will add 30 more diverse profiles to test with.
