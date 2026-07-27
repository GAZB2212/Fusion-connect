import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Image, Easing, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import { colors, gradients, spacing } from "@/theme";

const { height } = Dimensions.get("window");

/**
 * Branded launch animation shown once on cold start: the gold fusion wordmark
 * drops in from above with a spring, the tagline fades up, then the whole
 * thing cross-fades away to reveal the app.
 */
export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const drop = useRef(new Animated.Value(0)).current; // 0 = above screen, 1 = settled
  const markOpacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Reveal our animated splash over the native one, then animate.
    SplashScreen.hideAsync().catch(() => {});

    Animated.sequence([
      Animated.parallel([
        Animated.timing(markOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(drop, { toValue: 1, tension: 18, friction: 6, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(glow, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(tagline, { toValue: 1, duration: 520, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
      Animated.delay(650),
      Animated.timing(fadeOut, { toValue: 0, duration: 420, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onFinish());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = drop.interpolate({ inputRange: [0, 1], outputRange: [-height * 0.45, 0] });
  const scale = drop.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] });

  return (
    <Animated.View style={[styles.root, { opacity: fadeOut }]} pointerEvents="none">
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill as any} />
      <Image
        source={require("../../assets/pattern.png")}
        style={styles.pattern}
        resizeMode="cover"
      />

      <View style={styles.center}>
        {/* Soft gold glow behind the mark */}
        <Animated.View style={[styles.glow, { opacity: glow }]} />

        <Animated.Image
          source={require("../../assets/wordmark.png")}
          resizeMode="contain"
          style={[styles.wordmark, { opacity: markOpacity, transform: [{ translateY }, { scale }] }]}
        />

        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: tagline,
              transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
        >
          find your perfect match
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: colors.backgroundDeep },
  pattern: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.primary,
    opacity: 0.25,
    // A big blurred-looking halo via shadow (iOS).
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 90,
    shadowOffset: { width: 0, height: 0 },
  },
  wordmark: { width: 260, height: 150 },
  tagline: {
    color: colors.foreground,
    fontSize: 15,
    letterSpacing: 1.5,
    marginTop: spacing.md,
    opacity: 0.9,
  },
});
