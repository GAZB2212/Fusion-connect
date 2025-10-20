# Design Guidelines: Muslim Dating & Marriage Platform

## Design Approach

**Reference-Based Approach**: Drawing inspiration from Hinge's thoughtful profile design, Bumble's clean modern interface, and LinkedIn's professional trustworthiness, adapted specifically for Muslim users seeking halal relationships. The design must balance contemporary dating app aesthetics with cultural sensitivity and faith-based values.

**Core Principles**:
- **Trust & Safety First**: Every design decision reinforces security, privacy, and Islamic values
- **Modern Professionalism**: Contemporary interface that feels credible and serious about marriage
- **Cultural Sensitivity**: Respectful imagery, modest aesthetics, faith-forward features
- **Clarity Over Cleverness**: Direct, honest communication in all UI elements

---

## Color Palette

**Primary Colors** (Dark Mode):
- **Emerald Green**: 160 45% 45% - Primary brand color, symbolizing growth, peace, and Islamic tradition
- **Deep Emerald**: 160 50% 25% - Darker variant for depth and hierarchy

**Primary Colors** (Light Mode):
- **Emerald Green**: 160 60% 40% - Vibrant yet professional
- **Light Emerald**: 160 40% 95% - Subtle backgrounds and highlights

**Neutral Palette** (Dark Mode):
- **Background**: 220 15% 8% - Deep neutral background
- **Surface**: 220 12% 12% - Card and component backgrounds
- **Surface Elevated**: 220 10% 16% - Elevated components, modals
- **Border**: 220 10% 20% - Subtle borders and dividers
- **Text Primary**: 0 0% 95% - High contrast text
- **Text Secondary**: 0 0% 70% - Supporting text

**Neutral Palette** (Light Mode):
- **Background**: 0 0% 98% - Clean, soft white
- **Surface**: 0 0% 100% - Pure white for cards
- **Border**: 220 10% 88% - Gentle borders
- **Text Primary**: 220 15% 15% - Deep readable text
- **Text Secondary**: 220 10% 45% - Supporting text

**Accent Colors**:
- **Success/Verified**: 150 60% 45% - For verified profiles, matches
- **Warning/Alert**: 25 85% 55% - Gentle orange for important notices
- **Error**: 0 70% 50% - For critical alerts only

---

## Typography

**Font Families**:
- **Primary**: 'Inter' from Google Fonts - Clean, modern, excellent readability
- **Display**: 'Playfair Display' from Google Fonts - Elegant serif for marketing sections only
- **Arabic Support**: 'Noto Sans Arabic' for Arabic text and names

**Type Scale**:
- **Hero Display**: text-6xl (3.75rem) font-bold - Landing page headlines only
- **Page Titles**: text-4xl (2.25rem) font-bold - Main section headers
- **Section Headers**: text-2xl (1.5rem) font-semibold - Card titles, subsections
- **Body Large**: text-lg (1.125rem) font-normal - Profile descriptions, important text
- **Body**: text-base (1rem) font-normal - Standard text, messages
- **Body Small**: text-sm (0.875rem) font-normal - Labels, metadata
- **Caption**: text-xs (0.75rem) font-normal - Timestamps, helper text

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16** consistently
- Micro spacing: p-2, gap-2 (8px)
- Standard spacing: p-4, gap-4 (16px)
- Section spacing: p-8, gap-8 (32px)
- Large sections: p-16 (64px) for desktop landing pages

**Grid Layouts**:
- **Profile Cards**: grid-cols-2 md:grid-cols-3 lg:grid-cols-4 with gap-4
- **Feature Sections**: max-w-6xl mx-auto for content containment
- **Forms**: max-w-md mx-auto for focused input experiences

**Responsive Breakpoints**: Follow Tailwind defaults (sm: 640px, md: 768px, lg: 1024px, xl: 1280px)

---

## Component Library

### Navigation
- **Top Navigation Bar**: Sticky header with logo left, profile/settings right, emerald accent on active items
- **Tab Navigation**: Underlined tabs with emerald indicator for active state, used for Discover/Matches/Messages/Profile sections
- **Bottom Navigation** (Mobile): Fixed bottom nav with icons and labels for primary actions

### Cards & Profiles
- **Profile Cards**: Rounded corners (rounded-xl), subtle shadow (shadow-md), image top, content below with padding-4
- **Match Cards**: Larger format with prominent photo, name, age, location, brief bio preview
- **Message Previews**: Avatar left, name/last message stacked right, timestamp top-right, unread indicator (emerald dot)

### Forms & Inputs
- **Text Inputs**: Rounded (rounded-lg), border-2, focus:border-emerald with subtle ring, padding-3
- **Dropdowns/Selects**: Consistent styling with inputs, clear chevron indicators
- **Toggle Switches**: Emerald when active, gray when inactive, smooth transitions
- **Checkboxes**: Rounded squares with emerald check, used for multi-select filters
- **Range Sliders**: Emerald track fill, white thumb with subtle shadow

### Buttons
- **Primary CTA**: bg-emerald, text-white, rounded-lg, px-6 py-3, font-semibold, hover state with slight darkening
- **Secondary**: border-2 border-emerald, text-emerald, same size/padding as primary, transparent background
- **Outline on Images**: Secondary style with backdrop-blur-md and semi-transparent white background
- **Icon Buttons**: Circular (rounded-full), subtle background, emerald on active/hover
- **Swipe Actions**: Large circular buttons - emerald for "like", gray for "pass", gold for "super like" (if included)

### Modals & Overlays
- **Modal Dialogs**: Centered, max-w-lg, rounded-2xl, backdrop-blur with dark overlay (bg-black/60)
- **Bottom Sheets** (Mobile): Slide up from bottom, rounded-t-3xl, white background, drag handle at top
- **Toast Notifications**: Fixed top-right, rounded-lg, emerald for success, sliding animation

### Privacy & Safety Components
- **Photo Blur Toggle**: Glassmorphism overlay with "Click to reveal" text, blur-2xl effect
- **Verification Badge**: Emerald checkmark in circle, positioned top-right on profile photos
- **Chaperone Indicator**: Subtle icon showing conversation has Wali present, with tooltip explanation

### Media & Content
- **Image Galleries**: Swipeable carousel with dots indicator, full-bleed on mobile
- **Video Profiles**: Play button overlay (emerald), rounded corners matching cards
- **Voice Messages**: Waveform visualization in emerald, play/pause controls

### Filters & Search
- **Filter Panel**: Sidebar on desktop, bottom sheet on mobile, organized sections with clear labels
- **Search Bar**: Full-width, rounded-full, emerald border on focus, search icon left
- **Applied Filters**: Pill-shaped tags with emerald background, X to remove, displayed above results

---

## Images

**Hero Section** (Landing Page):
- Large hero image showing diverse Muslim singles in modest, professional settings (coffee shop conversation, outdoor market, cultural venue)
- Image should feel authentic, warm, and culturally respectful - avoid stock photo aesthetic
- Apply subtle gradient overlay (emerald to transparent) for text readability
- Placement: Full-width hero, 70vh height on desktop, 50vh on mobile

**Profile Section Images**:
- Placeholder images should use subtle patterns or initials on emerald backgrounds
- Real user photos displayed in rounded-xl containers with aspect-ratio-square
- Gallery images use rounded-lg with small gaps between

**Feature Showcase Images**:
- Phone mockups showing app interface in use (screenshot style)
- 3-4 mockups displaying: swipe interface, chat with chaperone, profile creation, match notification
- Placement: Alternating left/right in feature sections, max-w-md

**Trust & Safety Icons**:
- Custom illustrated icons for: verification badge, privacy lock, chaperone feature, halal commitment
- Emerald color with subtle stroke, consistent style across all icons

---

## Accessibility & Dark Mode

- Maintain WCAG AA contrast ratios in both modes (4.5:1 for text)
- All interactive elements have minimum 44px touch targets
- Form inputs maintain consistent dark mode styling with lighter borders (border-neutral-600)
- Focus states use emerald ring with 2px offset
- Icons always paired with text labels for clarity

---

## Marketing/Landing Page Specific

**Layout Strategy**:
- **Hero**: 70vh with centered headline, subheadline, dual CTA buttons, hero image background
- **Social Proof**: Logo strip of media features (BBC, Al Jazeera, NYT style outlets)
- **Features Grid**: 3-column on desktop showcasing: Privacy & Safety, Faith-Based Matching, Chaperone Feature
- **How It Works**: 4-step visual process with phone mockups
- **Testimonials**: 2-column cards with photos, quotes, names, "Married via App" badge
- **Final CTA**: Full-width emerald section with app download buttons and success statistics

**Visual Richness**:
- Use subtle geometric Islamic patterns as background textures (very low opacity)
- Generous whitespace - py-20 for desktop sections, py-12 for mobile
- Each section tells complete story - no sparse single-element sections

---

## Animations

**Use Sparingly**:
- Swipe card animations: Smooth slide out with rotation on like/pass
- Match success: Gentle scale-up pulse on mutual match notification
- Message send: Slight slide-in animation for new messages
- Tab transitions: Smooth fade between sections

**Avoid**: Excessive hover effects, distracting background animations, auto-playing videos