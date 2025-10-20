# HalalMatch - Luxury Muslim Matchmaking Platform

## Overview

HalalMatch is a premium Muslim matchmaking platform designed to help Muslim singles find meaningful connections in a halal, respectful way. The application emphasizes Islamic values, privacy, and safety while providing modern dating app features like profile discovery, matching, messaging, and chaperone support for traditional courtship.

The platform is built as a full-stack TypeScript application with a React frontend and Express backend, using PostgreSQL for data persistence and custom email/password authentication via Passport Local Strategy.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (October 2025)

### Authentication System Overhaul
- **Replaced Replit OAuth with custom email/password authentication**
  - Implemented Passport Local Strategy for native login experience
  - Added bcrypt for secure password hashing
  - Session storage via PostgreSQL with connect-pg-simple
  - Created custom Login and Signup pages with forms
  - Updated all API routes to use `req.user.id` instead of OAuth claims
  - Added logout functionality with session destruction
  - Logout button in profile setup header redirects to landing page

### Luxury Brand Redesign
- **Implemented premium luxury aesthetic**
  - Primary: Deep Navy (#0A0E17) - sophisticated background matching logo
  - Accent: Gold (#D4AF37) - used sparingly for buttons, icons, premium features
  - Secondary: Emerald Green (#0F5132) - success states, verified badges
  - Neutral: Ivory (#F8F4E3) - text on dark backgrounds, elegant contrast
  - Highlights: Rose Gold (#B76E79), Maroon (#7B1E26)

- **Design Elements**
  - New logo: Golden crescent moon with heart symbol on navy background
  - Islamic geometric patterns as subtle background textures (low opacity)
  - Gold accents used sparingly to maintain premium feel
  - Deep navy backgrounds throughout for luxury aesthetic
  - Ivory text for high contrast readability
  - Playfair Display serif font for headers (elegance)
  - Inter sans-serif for body text (readability)

- **Updated Pages**
  - Landing page: Premium hero section with logo, luxury styling
  - Login/Signup: Navy cards with gold accents, ivory text
  - All forms: Dark mode optimized with luxury palette

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **React 18** with TypeScript for type safety
- **Wouter** for client-side routing (lightweight alternative to React Router)
- **TanStack Query (React Query)** for server state management and data fetching
- **Vite** as the build tool and development server
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for styling with custom design tokens

**Design System:**
The application follows design guidelines inspired by Hinge, Bumble, and LinkedIn, adapted for Muslim cultural sensitivity. It uses:
- Emerald green as the primary brand color (symbolizing growth, peace, and Islamic tradition)
- Inter font family for clean, modern readability
- Dark and light mode support with comprehensive color tokens
- Neutral color palette emphasizing trust and professionalism

**Component Architecture:**
- Reusable UI components from shadcn/ui in `client/src/components/ui/`
- Page components in `client/src/pages/` for each major view (landing, home, profile setup, matches, messages, settings)
- Custom navigation component (`BottomNav`) for mobile-first navigation
- Form handling with React Hook Form and Zod validation

**State Management:**
- TanStack Query handles all server state, caching, and background refetching
- Local component state for UI interactions
- No global state management library needed due to Query's capabilities

**Authentication Flow:**
- Unauthenticated users see the landing page
- Authenticated users without complete profiles are redirected to profile setup
- Authenticated users with complete profiles access the main app

### Backend Architecture

**Technology Stack:**
- **Node.js** with **Express.js** for the REST API server
- **TypeScript** for type safety across the stack
- **Drizzle ORM** for database queries and schema management
- **Passport.js** with OpenID Connect strategy for Replit Auth integration
- **Express Session** with PostgreSQL session store for persistence

**API Design:**
RESTful endpoints organized in `server/routes.ts`:
- `/api/profile` - User profile CRUD operations
- `/api/discover` - Fetch potential matches based on preferences
- `/api/swipe` - Record swipe actions (like/pass)
- `/api/matches` - Retrieve mutual matches
- `/api/messages` - Message CRUD with polling for real-time updates
- `/api/chaperones` - Manage chaperone (Wali/guardian) access
- `/api/auth/user` - Authentication status endpoint

**Authentication & Authorization:**
- Replit's OpenID Connect (OIDC) integration for user authentication
- Session-based authentication using secure, HTTP-only cookies
- `isAuthenticated` middleware protects all API routes
- User sessions stored in PostgreSQL for persistence across server restarts

**Database Schema:**
The application uses PostgreSQL with the following core entities:
- **users** - Basic user information from Replit Auth
- **profiles** - Extended profile data (demographics, religious preferences, photos, bio)
- **swipes** - Track user swipe actions (right/left)
- **matches** - Store mutual matches when both users swipe right
- **messages** - Chat messages between matched users
- **chaperones** - Guardian/Wali access to conversations
- **sessions** - Express session storage

**Business Logic:**
- **Matching Algorithm**: When a user swipes right, check if the other user has already swiped right. If yes, create a match and return `isMatch: true`.
- **Discovery**: Filter out already-swiped profiles and return profiles matching user preferences (gender, age range, location, religious preferences).
- **Privacy Controls**: Profile visibility settings, photo blur options, and chaperone-enabled conversations.

### Data Storage

**Database: PostgreSQL (via Neon)**
- Serverless PostgreSQL connection using `@neondatabase/serverless`
- WebSocket-based connection pooling for efficient resource usage
- Drizzle ORM for type-safe queries and migrations

**Schema Design Principles:**
- UUID primary keys for all entities
- Foreign key constraints with CASCADE delete for data integrity
- Timestamps (createdAt, updatedAt) on all major tables
- JSONB fields for flexible data (photos array, preferences)
- Indexed fields for query performance (user lookups, match queries)

**Migration Strategy:**
- Schema defined in `shared/schema.ts` using Drizzle Kit
- Migrations stored in `migrations/` directory
- `drizzle-kit push` command deploys schema changes

### External Dependencies

**Authentication Service:**
- **Replit Auth (OpenID Connect)** - Primary authentication provider
- Environment variables: `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`
- OIDC discovery endpoint dynamically fetched and cached

**Database Service:**
- **Neon Serverless PostgreSQL** - Database hosting
- Environment variable: `DATABASE_URL`
- WebSocket support required for serverless connections

**Session Storage:**
- **connect-pg-simple** - PostgreSQL session store for Express
- Sessions persisted to database for reliability
- 7-day session TTL with HTTP-only, secure cookies

**UI Component Library:**
- **Radix UI** - Headless, accessible component primitives
- **shadcn/ui** - Pre-styled Radix components with Tailwind
- **Lucide React** - Icon library

**Development Tools:**
- **Vite plugins**: Runtime error overlay, cartographer (Replit integration), dev banner
- **TypeScript** for full-stack type safety
- **ESBuild** for production bundling

**Third-party Utilities:**
- **date-fns** - Date formatting and manipulation
- **memoizee** - Function memoization for OIDC config caching
- **nanoid** - Unique ID generation
- **Zod** - Runtime schema validation
- **drizzle-zod** - Generate Zod schemas from Drizzle tables

**Development Environment:**
The application is optimized for Replit deployment with specific environment variables and configuration for the Replit hosting platform.