import { Redirect } from "expo-router";
import { useAuth } from "@/auth";

// Entry route: send the user to the app if signed in, otherwise to landing.
export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? "/(tabs)" : "/landing"} />;
}
