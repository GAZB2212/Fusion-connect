import React from "react";
import {
  Text as RNText,
  TextProps,
  Pressable,
  PressableProps,
  ActivityIndicator,
  StyleSheet,
  View,
  TextInput,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, fontSize, gradients, shadow, gold } from "@/theme";

export function Text(props: TextProps & { variant?: "body" | "muted" | "title" | "display" }) {
  const { variant = "body", style, ...rest } = props;
  return <RNText {...rest} style={[styles.textBase, styles[variant], style]} />;
}

export function Button(
  props: PressableProps & {
    title: string;
    loading?: boolean;
    variant?: "primary" | "outline" | "ghost";
  }
) {
  const { title, loading, variant = "primary", disabled, style, ...rest } = props;
  const isDisabled = disabled || loading;

  const inner = loading ? (
    <ActivityIndicator color={variant === "primary" ? colors.primaryForeground : colors.primary} />
  ) : (
    <RNText style={[styles.btnText, variant === "primary" ? styles.btnTextPrimary : styles.btnTextAccent]}>
      {title}
    </RNText>
  );

  // Primary buttons get a gold gradient fill + soft glow for a premium feel
  if (variant === "primary") {
    return (
      <Pressable
        {...rest}
        disabled={isDisabled}
        style={(state) => [
          styles.btnShadow,
          !isDisabled && shadow.goldGlow,
          isDisabled && styles.btnDisabled,
          state.pressed && styles.btnPressed,
          typeof style === "function" ? style(state) : style,
        ]}
      >
        <LinearGradient
          colors={gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={(state) => [
        styles.btn,
        variant === "outline" && styles.btnOutline,
        variant === "ghost" && styles.btnGhost,
        isDisabled && styles.btnDisabled,
        state.pressed && styles.btnPressed,
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {inner}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.subtleForeground}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Card(props: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

const styles = StyleSheet.create({
  textBase: { color: colors.foreground, fontSize: fontSize.base },
  body: {},
  muted: { color: colors.mutedForeground, fontSize: fontSize.sm },
  title: { fontSize: fontSize.xxl, fontWeight: "700" },
  display: { fontSize: fontSize.display, fontWeight: "700", letterSpacing: -0.5 },

  btnShadow: { borderRadius: radius.full },
  btn: {
    height: 56,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    overflow: "hidden",
  },
  btnOutline: { borderWidth: 1.5, borderColor: gold.border, backgroundColor: "rgba(212,175,55,0.06)" },
  btnGhost: { backgroundColor: "transparent" },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  btnText: { fontSize: fontSize.base, fontWeight: "700", letterSpacing: 0.3 },
  btnTextPrimary: { color: colors.primaryForeground },
  btnTextAccent: { color: colors.primary },

  input: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: gold.faintBorder,
    paddingHorizontal: spacing.lg,
    color: colors.foreground,
    fontSize: fontSize.base,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    ...shadow.card,
  },
});
