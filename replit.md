# Fusion - Luxury Muslim Matchmaking Platform

## Overview
Fusion is a premium Muslim matchmaking platform designed to help Muslim singles find meaningful connections in a halal, respectful way. It emphasizes Islamic values, privacy, and safety, while offering modern features like profile discovery, matching, messaging, and chaperone support. The platform aims to provide a luxury experience for users seeking serious relationships.

**App Store Preparation:** The platform is ready for iOS App Store submission via web app wrapping (Capacitor/Cordova). All App Store compliance features have been fully implemented and tested:
- ✅ User reporting system with multiple reason categories
- ✅ User blocking functionality with profile removal
- ✅ Privacy Policy page (comprehensive data handling details)
- ✅ Terms of Service page (subscription terms, age requirements)
- ✅ Age verification (18+) during signup with required checkbox
- ✅ Delete Account functionality (permanent data deletion)
- ✅ Manage Subscription (Stripe Customer Portal integration)
- ✅ Clear subscription terms and cancellation information

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a luxury aesthetic with a primary deep navy color, gold accents, and emerald green for success states. Design elements include a golden crescent moon logo, subtle Islamic geometric patterns, and elegant typography (Handel Gothic for headers, Inter for body text). The UI is mobile-optimized and inspired by apps like Hinge and Bumble, adapted for Muslim cultural sensitivity. An AI-powered face verification system is integrated to ensure profile authenticity.

### Technical Implementations
**Frontend:** Built with React 18, TypeScript, Wouter for routing, TanStack Query for data fetching, Vite as a build tool, shadcn/ui for components, and Tailwind CSS for styling.
**Backend:** Developed with Node.js, Express.js, and TypeScript. It uses Drizzle ORM for PostgreSQL interactions and Passport.js with a custom local strategy for authentication.
**Authentication:** Custom email/password authentication via Passport Local Strategy with bcrypt for password hashing and PostgreSQL for session storage. A comprehensive AI Face Verification system, using OpenAI Vision API (GPT-4o), ensures identity verification by comparing uploaded profile photos with live selfies. The system uses lenient AI prompts to accept normal selfies while detecting obvious stock photos, watermarks, and screenshots. Detailed logging tracks all verification attempts.
**Content Moderation:** Multi-layered protection system:
  - OpenAI Moderation API for detecting sexual content, harassment, violence, and hate speech
  - Custom scam pattern detection for financial requests, external platform redirects, and suspicious URLs
  - Explicit content filtering using regex patterns for sexual solicitation and inappropriate language
  - Bot behavior detection through repetitive message analysis
  - Tiered rate limiting: New accounts (5 msgs/day), unverified accounts (20-50 msgs/day), verified users (100 msgs/day)
**Profile System:** Features a detailed 5-step profile setup including basic info, Islamic values (sects, practice levels), profession, interests (100+ categorized), and a bio. Profiles include a comprehensive badge system for premium status, activity, profession, and photo verification.
**Subscription System:** Implements a modern premium subscription model (£9.99/month) via Stripe Checkout Sessions API with custom UI mode. Uses fixed Price ID for consistent billing. Features include:
  - Automatic customer creation and management
  - Custom embedded payment form using Stripe Payment Element
  - Webhook handlers for subscription lifecycle (created, updated, deleted, payment failures)
  - Dev mode bypass for testing without real payments
  - Free users can browse and swipe, but viewing matches and sending messages requires a subscription
  - Matches are only created if at least one user has an active subscription
**Matching Algorithm:** A match is created if both users swipe right AND at least one user has an active subscription.
**Video Calling:** Real-time video calling powered by Agora RTC SDK. Matched users can initiate video calls from the messages page with full camera/mic controls, call duration tracking, and secure token-based authentication. Call history is stored in the database.

### Feature Specifications
- **Profile Management:** Detailed user profiles, photo uploads, and comprehensive demographic and religious information.
- **Discovery & Swiping:** Users can discover potential matches and perform swipe actions.
- **Messaging:** Real-time secure messaging between matched users powered by WebSockets, with instant message delivery and call records for video calls.
- **Video Calling:** Real-time video calls with camera/mic controls, call duration tracking, call history, and branded Fusion logo overlay.
- **Chaperone Support:** Optional guardian access to conversations for traditional courtship.
- **Face Verification & Anti-Fraud System:** Comprehensive AI-driven protection against fake profiles, bots, and scammers:
  - **Enhanced Photo Verification:** AI detects stock photos, watermarks, screenshots, and professional modeling shots
  - **Mandatory Verification:** Face verification required before users can swipe or match
  - **Message Content Moderation:** Real-time filtering of explicit sexual content and scam patterns using OpenAI Moderation API
  - **Bot Detection:** Pattern recognition for mass messaging, copy-paste behavior, and suspicious activities
  - **Rate Limiting:** Tiered message limits based on account age and verification status (5-100 msgs/day)
  - **Scam Pattern Detection:** Blocks requests for money transfers, external platform redirects, and financial schemes
- **Subscription Tiers:** Free and premium tiers with distinct feature sets.
- **App Store Compliance Features:**
  - User reporting system with multiple reason categories
  - User blocking functionality
  - Privacy Policy and Terms of Service pages
  - Age verification (18+) during registration
  - Delete account functionality
  - Manage subscription options

### System Design Choices
- **Full-stack TypeScript:** Ensures type safety across the entire application.
- **RESTful API:** Clearly defined endpoints for various functionalities.
- **WebSocket Infrastructure:** Real-time messaging and call notifications using ws package with Express integration. Supports 1000+ concurrent users with automatic reconnection and event broadcasting for messages, incoming calls, and call status updates.
- **PostgreSQL Database:** Used for data persistence, including user profiles, swipes, matches, messages, chaperones, and session storage.
- **Serverless PostgreSQL (Neon):** Utilized for efficient and scalable database connections.
- **Session-based Authentication:** Secure, HTTP-only cookies for user sessions.

## External Dependencies

*   **Agora RTC SDK:** Real-time video calling with token-based authentication and channel management.
*   **OpenAI Vision API (GPT-4o):** For advanced facial recognition and identity verification.
*   **Stripe:** For handling premium subscriptions and payments.
*   **PostgreSQL (Neon Serverless):** The primary database for all application data.
*   **Passport.js:** For authentication (local strategy).
*   **Connect-pg-simple:** For PostgreSQL-based Express session storage.
*   **React 18:** Frontend library.
*   **Wouter:** Lightweight client-side router.
*   **TanStack Query:** Server state management.
*   **Vite:** Build tool.
*   **shadcn/ui & Radix UI:** UI component libraries.
*   **Tailwind CSS:** Styling framework.
*   **Lucide React:** Icon library.
*   **Node.js & Express.js:** Backend runtime and framework.
*   **Drizzle ORM:** Database queries and schema management.
*   **bcrypt:** Password hashing.
*   **date-fns:** Date utility library.
*   **nanoid:** Unique ID generation.
*   **Zod & drizzle-zod:** Schema validation.