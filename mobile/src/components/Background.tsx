import React from "react";
import { View, ImageBackground, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradients, colors } from "@/theme";

/**
 * Premium screen backdrop: deep navy gradient with a faint geometric-pattern
 * texture and a soft gold glow at the top. Used behind every screen so the app
 * reads as one rich, cohesive surface rather than flat panels.
 */
export function Background({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
      <ImageBackground
        source={require("../../assets/pattern.png")}
        resizeMode="repeat"
        style={StyleSheet.absoluteFill}
        imageStyle={styles.pattern}
      />
      {/* Warm glow near the top for depth */}
      <LinearGradient
        colors={["rgba(212,175,55,0.10)", "rgba(212,175,55,0)"]}
        style={styles.topGlow}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundDeep },
  pattern: { opacity: 0.25 },
  topGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 260 },
});
