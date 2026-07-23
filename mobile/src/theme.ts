/**
 * Fusion design tokens, ported from the web app's CSS variables so the native
 * app matches the brand exactly.
 *
 * Source (dark theme):
 *   background  hsl(220 30% 12%)  deep navy
 *   foreground  hsl(45 38% 94%)   warm cream
 *   primary     hsl(45 62% 53%)   gold
 *   radius      8px
 */
export const colors = {
  // Backgrounds
  background: "#0F1826", // deep navy (app base)
  backgroundDeep: "#0A1628", // splash / darkest navy
  card: "#16202E", // slightly raised navy
  cardBorder: "rgba(245, 240, 228, 0.10)",
  border: "rgba(245, 240, 228, 0.12)",
  input: "#1B2636",

  // Text
  foreground: "#F5F0E4", // cream
  mutedForeground: "rgba(245, 240, 228, 0.60)",
  subtleForeground: "rgba(245, 240, 228, 0.40)",

  // Brand
  primary: "#D4AF37", // gold
  primaryForeground: "#0F1826",
  accent: "#D4AF37",

  // States
  success: "#10B981", // emerald
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",

  // Utility
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0, 0, 0, 0.6)",
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 20,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 34,
} as const;

export const font = {
  // Myriad Pro ships with the brand; loaded via expo-font (see _layout).
  // Falls back to system until the custom faces are wired in.
  regular: "System",
  medium: "System",
  semibold: "System",
  bold: "System",
} as const;

// Gradients for depth (used with expo-linear-gradient).
export const gradients = {
  // Screen backdrop: deep navy with subtle vertical falloff
  screen: ["#101B2D", "#0A1220", "#070C16"] as [string, string, string],
  // Gold sweep for premium buttons / accents
  gold: ["#E7C765", "#D4AF37", "#B8942A"] as [string, string, string],
  // Dark scrim over imagery so text stays legible
  scrim: ["rgba(7,12,22,0)", "rgba(7,12,22,0.85)"] as [string, string],
  // Card sheen
  card: ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.01)"] as [string, string],
};

// Elevation presets (iOS shadow). Gold glow for selected/premium elements.
export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  goldGlow: {
    shadowColor: "#D4AF37",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
} as const;

export const gold = {
  soft: "rgba(212,175,55,0.12)",
  border: "rgba(212,175,55,0.35)",
  faintBorder: "rgba(212,175,55,0.18)",
} as const;
