import { View, StyleSheet, Pressable } from "react-native";
import { Text } from "./ui";
import { colors, spacing, radius, gold, shadow } from "@/theme";

export function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                active && shadow.goldGlow,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MultiChipGroup({
  label,
  hint,
  options,
  values,
  onChange,
  max,
}: {
  label: string;
  hint?: string;
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) {
      onChange(values.filter((v) => v !== opt));
    } else {
      if (max && values.length >= max) return;
      onChange([...values, opt]);
    }
  };
  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = values.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => toggle(opt)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                active && shadow.goldGlow,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  label: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1.5,
    opacity: 0.9,
  },
  hint: { color: colors.subtleForeground, fontSize: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: gold.faintBorder,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 15 },
  chipTextActive: { color: colors.primaryForeground, fontWeight: "700" },
});
