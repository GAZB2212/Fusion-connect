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
import { colors, radius, spacing, fontSize } from "@/theme";

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
  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={(state) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "outline" && styles.btnOutline,
        variant === "ghost" && styles.btnGhost,
        isDisabled && styles.btnDisabled,
        state.pressed && styles.btnPressed,
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.primaryForeground : colors.primary} />
      ) : (
        <RNText
          style={[
            styles.btnText,
            variant === "primary" ? styles.btnTextPrimary : styles.btnTextAccent,
          ]}
        >
          {title}
        </RNText>
      )}
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

  btn: {
    height: 52,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnOutline: { borderWidth: 1, borderColor: colors.primary, backgroundColor: "transparent" },
  btnGhost: { backgroundColor: "transparent" },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  btnText: { fontSize: fontSize.base, fontWeight: "600" },
  btnTextPrimary: { color: colors.primaryForeground },
  btnTextAccent: { color: colors.primary },

  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
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
  },
});
