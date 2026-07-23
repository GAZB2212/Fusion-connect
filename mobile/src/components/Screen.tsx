import React from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./ui";
import { Background } from "./Background";
import { colors, spacing } from "@/theme";

/** Standard screen: premium backdrop + optional large title header. */
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
    <Background>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        {title ? (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? (
              <Text style={styles.subtitle}>{subtitle}</Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </Background>
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
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { fontSize: 34, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 },
  subtitle: { color: colors.primary, marginTop: 4, fontSize: 14, fontWeight: "500", letterSpacing: 0.3 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
