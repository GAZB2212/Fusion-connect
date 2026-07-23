import { View, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { colors } from "@/theme";

// Placeholder — the Agora call UI + CallKit wiring lands in the calling phase.
export default function CallScreen() {
  return (
    <View style={styles.center}>
      <Text variant="muted">Calling — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.backgroundDeep },
});
