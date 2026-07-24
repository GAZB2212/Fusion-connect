import { useState } from "react";
import { View, TextInput, StyleSheet, Pressable, TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, gold } from "@/theme";

/** Premium auth field: glassy pill, leading icon, gold focus ring, password reveal. */
export function AuthInput({
  icon,
  secure,
  style,
  ...props
}: TextInputProps & { icon: keyof typeof Ionicons.glyphMap; secure?: boolean }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View style={[styles.wrap, focused && styles.wrapFocused]}>
      <Ionicons
        name={icon}
        size={19}
        color={focused ? colors.primary : colors.subtleForeground}
        style={styles.icon}
      />
      <TextInput
        {...props}
        secureTextEntry={hidden}
        placeholderTextColor={colors.subtleForeground}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, style]}
      />
      {secure ? (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} style={styles.reveal}>
          <Ionicons
            name={hidden ? "eye-outline" : "eye-off-outline"}
            size={19}
            color={colors.subtleForeground}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: gold.faintBorder,
    paddingHorizontal: spacing.lg,
  },
  wrapFocused: {
    borderColor: colors.primary,
    backgroundColor: "rgba(212,175,55,0.07)",
  },
  icon: { marginRight: spacing.sm },
  input: { flex: 1, color: colors.foreground, fontSize: 16, height: "100%" },
  reveal: { paddingLeft: spacing.sm },
});
