import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { queryClient } from "@/api";
import { AuthProvider, useAuth } from "@/auth";
import { SendbirdProvider } from "@/sendbird";
import { CallProvider } from "@/calls";
import { colors } from "@/theme";

function RootNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="landing" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="settings/edit-profile" />
      <Stack.Screen name="settings/blocked" />
      <Stack.Screen name="chat/[matchId]" />
      <Stack.Screen name="subscribe" options={{ presentation: "modal" }} />
      <Stack.Screen name="call/[callId]" options={{ presentation: "fullScreenModal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SendbirdProvider>
              <CallProvider>
                <StatusBar style="light" />
                <RootNavigator />
              </CallProvider>
            </SendbirdProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
