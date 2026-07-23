import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { Background } from "@/components/Background";
import { Text, Input, Button } from "@/components/ui";
import { useProfile } from "@/useProfile";
import { apiRequest, ApiError } from "@/api";
import { colors, spacing, radius, gold } from "@/theme";

export default function EditProfile() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useProfile();

  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [profession, setProfession] = useState("");
  const [location, setLocation] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setPhotos(profile.photos ?? []);
      setBio(profile.bio ?? "");
      setProfession(profile.profession ?? "");
      setLocation(profile.location ?? "");
    }
  }, [profile]);

  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo access is needed to add photos");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setUploading(true);
    setError(null);
    try {
      const dataUrl = `data:image/jpeg;base64,${res.assets[0].base64}`;
      const out = await apiRequest<{ photoUrl: string }>("POST", "/api/photos/upload-base64", {
        photo: dataUrl,
        photoType: "profile",
      });
      setPhotos((p) => [...p, out.photoUrl]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => setPhotos((p) => p.filter((x) => x !== url));

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiRequest("PATCH", "/api/profile", {
        photos,
        bio: bio.trim(),
        profession: profession.trim(),
        location: location.trim(),
      });
      await qc.invalidateQueries({ queryKey: ["/api/profile"] });
      setSaved(true);
      setTimeout(() => router.back(), 500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Background>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit profile</Text>
          <View style={{ width: 26 }} />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Photos</Text>
              <View style={styles.photoGrid}>
                {photos.map((url) => (
                  <View key={url} style={styles.photoWrap}>
                    <Image source={{ uri: url }} style={styles.photo} />
                    <Pressable style={styles.removeBtn} onPress={() => removePhoto(url)} hitSlop={6}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {photos.length < 6 ? (
                  <Pressable style={styles.addPhoto} onPress={addPhoto} disabled={uploading}>
                    {uploading ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Ionicons name="add" size={30} color={colors.primary} />
                    )}
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.label}>About you</Text>
              <Input
                placeholder="Tell them about yourself and what you're looking for…"
                value={bio}
                onChangeText={setBio}
                multiline
                style={styles.bio}
              />

              <Text style={styles.label}>Profession</Text>
              <Input placeholder="e.g. Doctor, Teacher, Engineer" value={profession} onChangeText={setProfession} />

              <Text style={styles.label}>Location</Text>
              <Input placeholder="City" value={location} onChangeText={setLocation} />

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {saved ? <Text style={styles.saved}>Saved ✓</Text> : null}

              <Button
                title="Save changes"
                loading={saving}
                onPress={save}
                style={{ marginTop: spacing.lg }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Background>
  );
}

const PHOTO = 104;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 0.4,
    marginTop: spacing.md,
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoWrap: { width: PHOTO, height: PHOTO },
  photo: { width: PHOTO, height: PHOTO, borderRadius: radius.md, backgroundColor: colors.input },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhoto: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: gold.border,
    borderStyle: "dashed",
    backgroundColor: gold.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  bio: { minHeight: 100, paddingTop: spacing.md, textAlignVertical: "top" },
  error: { color: colors.destructive, fontSize: 14, marginTop: spacing.sm },
  saved: { color: colors.success, fontSize: 14, fontWeight: "600", marginTop: spacing.sm },
});
