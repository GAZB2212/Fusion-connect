import { useState } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Button, Input } from "@/components/ui";
import { ChipGroup } from "@/components/Chips";
import { apiRequest, ApiError } from "@/api";
import { colors, spacing } from "@/theme";

const SECTS = ["No preference", "Sunni", "Shia", "Sufi", "Other"];
const PRACTICE = ["Strictly practising", "Actively practising", "Moderately practising", "Not very practising"];
const PRAYER = ["Always", "Most of the time", "Sometimes", "Rarely", "Never"];

export default function ProfileSetup() {
  const router = useRouter();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [sect, setSect] = useState<string | null>(null);
  const [practice, setPractice] = useState<string | null>(null);
  const [prayer, setPrayer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const ageNum = parseInt(age, 10);
    if (!displayName || !ageNum || !gender || !location) {
      setError("Please fill in your name, age, gender and location");
      return;
    }
    if (ageNum < 18) {
      setError("You must be at least 18");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("POST", "/api/profile", {
        displayName: displayName.trim(),
        age: ageNum,
        gender,
        location: location.trim(),
        lookingFor: "Marriage",
        bio: bio.trim() || undefined,
        sect: sect || undefined,
        religiousPractice: practice || undefined,
        prayerFrequency: prayer || undefined,
        photos: [],
      });
      await qc.invalidateQueries({ queryKey: ["/api/profile"] });
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="display" style={styles.title}>Your profile</Text>
          <Text variant="muted" style={styles.subtitle}>
            Tell us about yourself so we can find your match
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Display name</Text>
            <Input placeholder="e.g. Aisha" value={displayName} onChangeText={setDisplayName} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Age</Text>
            <Input placeholder="e.g. 28" keyboardType="number-pad" value={age} onChangeText={setAge} />
          </View>

          <ChipGroup label="I am a" options={["Male", "Female"]} value={gender ? gender[0].toUpperCase() + gender.slice(1) : null}
            onChange={(v) => setGender(v.toLowerCase())} />

          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <Input placeholder="e.g. London, UK" value={location} onChangeText={setLocation} />
          </View>

          <ChipGroup label="Sect" options={SECTS} value={sect} onChange={setSect} />
          <ChipGroup label="Religious practice" options={PRACTICE} value={practice} onChange={setPractice} />
          <ChipGroup label="Prayer" options={PRAYER} value={prayer} onChange={setPrayer} />

          <View style={styles.field}>
            <Text style={styles.label}>About you</Text>
            <Input
              placeholder="A few words about yourself and what you're looking for in a spouse…"
              value={bio}
              onChangeText={setBio}
              multiline
              style={styles.textArea}
            />
          </View>

          {error ? <Text style={{ color: colors.destructive }}>{error}</Text> : null}
          <Button title="Save & Continue" loading={saving} onPress={onSubmit} style={{ marginTop: spacing.sm }} />
          <Text variant="muted" style={styles.note}>
            You can add photos and complete verification next.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },
  title: { marginTop: spacing.sm },
  subtitle: { marginBottom: spacing.sm },
  field: { gap: spacing.sm },
  label: { color: colors.foreground, fontWeight: "600", fontSize: 15 },
  textArea: { height: 110, paddingTop: spacing.md, textAlignVertical: "top" },
  note: { textAlign: "center", marginTop: spacing.sm },
});
