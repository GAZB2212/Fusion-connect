import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator, StyleSheet, Pressable, Text } from "react-native";
import { colors } from "@/theme";
import { useAuth } from "@/auth";
import { useProfile, isNoProfile } from "@/useProfile";

export default function TabsLayout() {
  const { user } = useAuth();
  const { data: profile, isLoading, error, refetch, isFetching } = useProfile();

  // Protect the authenticated area
  if (!user) {
    return <Redirect href="/landing" />;
  }

  // Wait for the profile check before deciding where to send the user
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Couldn't reach the server (offline / server error): offer a retry rather
  // than mistaking an existing member for a new one.
  if (!profile && profile !== null && !isNoProfile(error)) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.mutedForeground} />
        <Text style={styles.offlineTitle}>Can't reach Fusion</Text>
        <Text style={styles.offlineText}>Check your connection and try again.</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={styles.retryText}>Try again</Text>
          )}
        </Pressable>
      </View>
    );
  }

  // New users (no profile / incomplete) go build their profile first
  if (!profile || !profile.isComplete) {
    return <Redirect href="/profile-setup" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: "Likes",
          tabBarIcon: ({ color, size }) => <Ionicons name="star-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: 24 },
  offlineTitle: { color: colors.foreground, fontSize: 20, fontWeight: "700", marginTop: 16 },
  offlineText: { color: colors.mutedForeground, fontSize: 15, marginTop: 6, textAlign: "center" },
  retryBtn: {
    marginTop: 24, minWidth: 140, alignItems: "center", backgroundColor: colors.primary,
    borderRadius: 9999, paddingHorizontal: 28, paddingVertical: 14,
  },
  retryText: { color: colors.primaryForeground, fontWeight: "600", fontSize: 16 },
});
