# Fusion - Luxury Muslim Matchmaking Platform

## Overview
Fusion is a premium Muslim matchmaking platform designed to help Muslim singles find meaningful connections in a halal, respectful way. It emphasizes Islamic values, privacy, and safety, while offering modern features like profile discovery, matching, and messaging. The platform aims to provide a luxury experience for users seeking serious relationships and is prepared for iOS App Store submission, including comprehensive compliance features.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a luxury aesthetic with a deep navy primary color, gold accents, and emerald green for success states. Design incorporates a golden crescent moon logo, subtle Islamic geometric patterns, elegant typography (Handel Gothic for headers, Inter for body text), and is mobile-optimized. An AI-powered face verification system is integrated for profile authenticity.

### Technical Implementations
**Frontend:** React 18, TypeScript, Wouter, TanStack Query, Vite, shadcn/ui, Tailwind CSS.
**Backend:** Node.js, Express.js, TypeScript, Drizzle ORM (PostgreSQL), Passport.js (local strategy).
**Authentication:** Dual system: Cookie-based sessions for web; JWT for mobile (Capacitor).
**AI Face Verification:** OpenAI Vision API (GPT-4o) compares profile photos with live selfies, logging all attempts.
**Photo Storage:** Cloudflare R2 for profile photos, utilizing AWS SDK v3 for S3-compatible uploads.
**Content Moderation:** Multi-layered system including OpenAI Moderation API, custom scam pattern detection, explicit content filtering, bot behavior detection, and tiered rate limiting.
**Profile System:** Detailed 5-step setup covering basic info, Islamic values, profession, interests, and bio, with a comprehensive badge system.
**Subscription System:** Stripe Checkout Sessions API for premium subscriptions (£9.99/month), featuring automatic customer management, embedded payment forms, and webhook handlers. Free users can browse, but matches and messaging require a subscription.
**Matching Algorithm:** A match is created if both users swipe right AND at least one user has an active subscription.
**Likes You Feature:** Shows users who have swiped right on you. Premium subscribers see clear photos and can view full profiles; free users see blurred photos with an upgrade prompt.
**Video Calling:** Agora RTC SDK for real-time video calls between matched users, with camera/mic controls and call history. Includes push notification-based call invites via APNs (iOS) and FCM (Android) with in-app incoming call banners and dedicated incoming call page for notification tap handling. Call sessions are tracked in the database with status (ringing/accepted/declined/ended), and rate limiting (5 calls/minute) is enforced.
**Chaperone Support (Wali):** Real-time guardian access to conversations with "Live Access" (participation) or "Report Only" (email summaries) options. Chaperones access via a secure portal with token-based authentication.
**Anti-Fraud System:** Combines enhanced photo verification (AI detects stock photos, etc.), mandatory face verification before matching, real-time message content moderation, bot detection, and tiered rate limiting.
**Guidance Hub:** Emotional support center with articles on navigating relationships.
**Multi-Language Support (i18n):** Full internationalization for English, Arabic, and Urdu, including RTL layout support and react-i18next.
**Accessibility - Text Size Toggle:** User-adjustable text size (small/medium/large) in Settings that affects the entire app for better readability, including headings, body text, and chat messages.
**Haptic Feedback:** Native haptic feedback for interactive elements on iOS/Android via @capacitor/haptics.
**App Store Compliance:** Features like user reporting, blocking, privacy policy, terms of service, age verification, and account deletion.

### System Design Choices
- **Full-stack TypeScript:** Type safety across the application.
- **RESTful API:** Clearly defined endpoints.
- **WebSocket Infrastructure:** Real-time messaging and call notifications with `ws` package, supporting 1000+ concurrent users.
- **PostgreSQL Database:** Primary data persistence, utilizing Neon for serverless scalability.
- **Session-based Authentication:** Secure, HTTP-only cookies for web sessions.
- **Capacitor Mobile App Deployment:** Designed for wrapping with Capacitor for iOS and Android, leveraging unified push notifications (Web Push, APNs, FCM with Sendbird integration) and platform detection.

## External Dependencies

*   **Cloudflare R2:** Object storage for profile photos.
*   **Agora RTC SDK:** Real-time video calling.
*   **OpenAI Vision API (GPT-4o):** AI facial recognition and identity verification.
*   **Stripe:** Payment and subscription management.
*   **PostgreSQL (Neon Serverless):** Database.
*   **Passport.js:** Authentication.
*   **Connect-pg-simple:** PostgreSQL session storage.
*   **React 18:** Frontend library.
*   **Wouter:** Client-side routing.
*   **TanStack Query:** Server state management.
*   **Vite:** Build tool.
*   **shadcn/ui & Radix UI:** UI components.
*   **Tailwind CSS:** Styling.
*   **Lucide React:** Icons.
*   **Node.js & Express.js:** Backend.
*   **Drizzle ORM:** Database queries.
*   **bcrypt:** Password hashing.
*   **date-fns:** Date utilities.
*   **nanoid:** Unique ID generation.
*   **Zod & drizzle-zod:** Schema validation.
*   **Capacitor:** Mobile app wrapping.
*   **Sendbird:** (Implicitly used for chat/push notifications, based on push notification details).