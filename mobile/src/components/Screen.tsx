import React from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./ui";
import { colors, spacing } from "@/theme";

/** Standard screen wrapper with an optional large title header. */
export function Screen({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {title ? (
        <View style={styles.header}>
          <Text variant="display">{title}</Text>
          {subtitle ? (
            <Text variant="muted" style={{ marginTop: 4 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

/** Centered placeholder for screens not yet built. */
export function ComingSoon({ label }: { label: string }) {
  return (
    <View style={styles.center}>
      <Text variant="muted">{label} — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  body: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
