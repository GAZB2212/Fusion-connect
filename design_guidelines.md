# Design Guidelines: Fusion - Luxury Muslim Matchmaking Platform

## Design Philosophy

**Premium Luxury Aesthetic**: Fusion is positioned as a sophisticated, marriage-focused platform for Muslim singles. The design emphasizes trust, elegance, and Islamic heritage through a carefully curated luxury palette and refined visual language.

**Core Principles**:
- **Luxury & Sophistication**: Premium feel that communicates quality and seriousness about marriage
- **Islamic Elegance**: Rooted in Islamic values with subtle cultural references
- **Trust & Safety**: Visual design reinforces credibility and privacy
- **Modern Refinement**: Contemporary interface that feels timeless and elegant

---

## Luxury Color Palette

**Primary Color - Deep Navy**:
- **Main**: #0A0E17 (HSL: 219 39% 6%) - Deep, sophisticated navy background
- **Use**: Primary backgrounds, headers, premium sections
- **Symbolism**: Trust, depth, sophistication, night sky

**Accent Color - Gold**:
- **Main**: #D4AF37 (HSL: 45 62% 53%) - Luxurious gold
- **Use**: Buttons, icons, dividers, premium features (USE SPARINGLY)
- **Symbolism**: Luxury, value, Islamic tradition (golden domes, calligraphy)

**Secondary Color - Emerald Green**:
- **Muted**: #0F5132 (HSL: 151 70% 19%) - Deep emerald
- **Use**: Success states, verified badges, secondary CTAs
- **Symbolism**: Growth, peace, Islamic significance

**Neutral Color - Ivory**:
- **Main**: #F8F4E3 (HSL: 45 38% 94%) - Warm ivory/cream
- **Use**: Text on dark backgrounds, light surfaces, elegant contrast
- **Symbolism**: Purity, warmth, traditional Islamic architecture

**Highlight Colors**:
- **Rose Gold**: #B76E79 (HSL: 348 32% 58%) - Soft, romantic accent
- **Maroon**: #7B1E26 (HSL: 355 68% 30%) - Deep, rich accent
- **Use**: Special features, romantic moments, premium indicators

---

## Design Principles

### Gold Usage - The Premium Touch
**CRITICAL**: Gold must be used sparingly to maintain its premium feel. Overuse diminishes luxury.

**Appropriate Gold Uses**:
- Primary CTA buttons (one per screen maximum)
- Premium feature badges
- Verification checkmarks
- Decorative dividers (subtle, thin lines)
- Icon accents (hearts, stars, key features)
- Logo elements

**Never Use Gold For**:
- Large background areas
- Body text
- Multiple buttons on the same screen
- Borders on cards (use subtle ivory/navy variants)

### Deep Backgrounds for Elegance
- Primary sections use deep navy (#0A0E17), darker navy (#0E1220), and black
- Gold and ivory text/elements stand out beautifully against dark backgrounds
- Create visual hierarchy through subtle gradients and tonal variations
- Use ivory for high-contrast readability

### Gradients and Depth
- Use subtle gradients to create depth (NO textures or patterns)
- Layer dark tones: black → #0A0E17 → #0E1220
- Add subtle gold gradient overlays (5-10% opacity) for dimension
- Vary gradient directions (top-to-bottom, diagonal) between sections
- Cards use gradient fills for visual interest

---

## Typography

**Font Families**:
- **Primary**: 'Inter' - Clean, modern, premium readability
- **Display/Headers**: 'Handel Gothic' - Bold, geometric sans-serif for luxury branding
- **Arabic**: 'Noto Sans Arabic' - For Arabic text support

**Hierarchy**:
- **Hero**: 4xl-6xl, bold/extrabold (700-800), Handel Gothic - Landing headlines
- **Section Titles**: 2xl-3xl, bold (700), Handel Gothic - Section headers
- **Body Large**: lg, normal, Inter - Profiles, descriptions
- **Body**: base, normal, Inter - Standard text
- **Captions**: sm-xs, normal, Inter - Metadata, timestamps

**Colors**:
- On navy backgrounds: Ivory (#F8F4E3) for primary, muted ivory for secondary
- On light backgrounds: Navy (#0A0E17) for primary, muted navy for secondary
- Gold for accents and CTAs ONLY

---

## Component Styling

### Buttons

**Primary (Gold CTA)**:
- Background: Gold (#D4AF37)
- Text: Deep Navy (#0A0E17)
- Rounded: rounded-lg
- Shadow: Subtle gold glow on hover
- **Limit**: One primary gold button per screen

**Secondary (Outline)**:
- Border: 2px Gold (#D4AF37)
- Text: Gold (#D4AF37)
- Background: Transparent or subtle navy
- Hover: Very subtle gold background

**Tertiary (Emerald)**:
- Background: Emerald (#0F5132)
- Text: Ivory (#F8F4E3)
- Use for success actions, verified features

### Cards & Surfaces

**Profile Cards**:
- Background: Subtle navy elevation (#0E1220)
- Border: 1px ivory 10% opacity
- Rounded: rounded-xl
- Shadow: Subtle for depth
- Hover: Gentle lift effect

**Premium Features**:
- Gold accent border (1px, left or top)
- Navy background
- Gold icon in corner
- Ivory text

### Navigation

**Header/Nav**:
- Background: Deep Navy (#0A0E17) - matches logo
- Logo: Fusion with gold crescent and heart
- Links: Ivory text
- Active: Gold underline or accent

**Bottom Nav (Mobile)**:
- Background: Navy with slight transparency
- Icons: Ivory default
- Active: Gold
- Labels: Small ivory text

### Forms & Inputs

**Text Inputs**:
- Background: Transparent or subtle navy elevation
- Border: 1px ivory 20% opacity
- Focus: Gold border
- Text: Ivory
- Placeholder: Muted ivory

**Select Dropdowns**:
- Match input styling
- Gold chevron icon

**Toggles/Switches**:
- Off: Gray/navy
- On: Gold

---

## Images & Media

### Logo Usage
- Gold crescent moon with heart symbol
- White "FUSION" text
- Navy background (#0A0E17)
- Use consistently across all pages

### Hero Sections
- Deep black backgrounds with subtle gradients
- Layered gradient overlays for depth
- Gold accents for visual interest
- Ivory text for contrast

### Profile Photos
- Rounded corners (rounded-xl)
- Gold border for verified profiles (2px)
- Emerald checkmark badge for verification
- Optional blur for privacy (glassmorphism with ivory overlay)

---

## Layout Guidelines

**Spacing**: Generous whitespace for premium feel
- Micro: 2 (8px)
- Standard: 4-6 (16-24px)
- Section: 8-12 (32-48px)
- Large: 16-20 (64-80px)

**Containers**:
- Max-width: Vary by content (forms: max-w-md, content: max-w-6xl)
- Padding: Generous on all breakpoints

**Grid System**:
- Profile cards: 2-3 columns on desktop
- Feature sections: 3-column layouts
- Testimonials: 2-column with generous gap

---

## Premium Design Details

### Subtle Enhancements
- Gentle shadows on elevated elements
- Smooth transitions (200-300ms)
- Gold glow effects on hover (very subtle)
- Elegant icon animations
- Gradient transitions between sections for flow

### Islamic Cultural Elements
- Crescent moon in logo
- Respectful imagery
- Elegant, modest aesthetic
- Gold and emerald color symbolism

### Trust Indicators
- Verification badges (gold + emerald)
- Privacy controls with clear iconography
- Professional photography style
- Clean, organized layouts

---

## Accessibility

- Maintain WCAG AA contrast:
  - Ivory on navy: Excellent contrast
  - Gold on navy: Good for accents, not long text
- Minimum touch targets: 44px
- Focus states: Gold ring with offset
- Screen reader support on all interactive elements

---

## Dark Mode (Primary)

Fusion's primary mode is **dark mode** with the navy background. Light mode can be offered as an alternative.

**Light Mode Adjustments**:
- Background: Ivory (#F8F4E3)
- Text: Navy (#0A0E17)
- Cards: White with subtle ivory tint
- Gold remains accent color
- Borders: Navy 10% opacity

---

## Marketing/Landing Page

**Hero Section**:
- Full-width black background
- Animated logo video that disappears on end
- Gold CTA button
- Ivory headline and subheading
- Clean, gradient-based depth

**Features Grid**:
- 2 columns
- Gold icons
- Ivory text
- Gradient navy cards with subtle elevation
- Layered section gradients

**Social Proof**:
- Testimonial cards with gradient backgrounds
- Gold star ratings
- Professional aesthetic
- Married couples badge (emerald + gold)

**Final CTA**:
- Gradient background (navy to black)
- Large gold button
- Ivory supporting text
- Subtle gradient overlays for depth

---

## Animation Guidelines

**Use Subtly**:
- Gentle fade-ins for content
- Smooth swipe animations
- Gold glow pulse on match notification
- Elegant transitions between sections

**Avoid**:
- Excessive animations
- Distracting effects
- Auto-playing media
- Jarring transitions

---

## Premium Feeling Checklist

✓ Gold used sparingly and purposefully
✓ Deep navy backgrounds create depth
✓ Ivory text provides elegant contrast
✓ Generous whitespace throughout
✓ Subtle Islamic geometric patterns
✓ Professional, high-quality imagery
✓ Smooth, refined animations
✓ Verified badges and trust indicators
✓ Consistent luxury branding
✓ Sophisticated typography hierarchy
