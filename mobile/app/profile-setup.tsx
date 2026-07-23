import { useState } from "react";
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable, Image, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Text, Button, Input } from "@/components/ui";
import { ChipGroup } from "@/components/Chips";
import { Background } from "@/components/Background";
import { apiRequest, ApiError } from "@/api";
import { PROMPTS } from "@/prompts";
import { colors, spacing, radius, gold } from "@/theme";

const SECTS = ["No preference", "Sunni", "Shia", "Sufi", "Other"];
const PRACTICE = ["Strictly practising", "Actively practising", "Moderately practising", "Not very practising"];
const PRAYER = ["Always", "Most of the time", "Sometimes", "Rarely", "Never"];
const ACCESS = ["Live access", "Report only"];

const STEPS = ["About you", "Your faith", "Prompt", "Photos", "Wali", "Verify"];

export default function ProfileSetup() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  // Step 2
  const [sect, setSect] = useState<string | null>(null);
  const [practice, setPractice] = useState<string | null>(null);
  const [prayer, setPrayer] = useState<string | null>(null);
  // Step 3
  const [bio, setBio] = useState("");
  const [promptId, setPromptId] = useState<string | null>(null);
  const [promptAnswer, setPromptAnswer] = useState("");
  // Step 4
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // Step 5 (Wali)
  const [waliName, setWaliName] = useState("");
  const [waliEmail, setWaliEmail] = useState("");
  const [waliRelationship, setWaliRelationship] = useState("");
  const [waliAccess, setWaliAccess] = useState<string | null>("Live access");

  const next = () => { setError(null); setStep((s) => s + 1); };
  const back = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };

  // ---- photo upload ----
  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo access is needed to add photos"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.6, base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setUploading(true);
    setError(null);
    try {
      const dataUrl = `data:image/jpeg;base64,${res.assets[0].base64}`;
      const out = await apiRequest<{ photoUrl: string }>("POST", "/api/photos/upload-base64", {
        photo: dataUrl, photoType: "profile",
      });
      setPhotos((p) => [...p, out.photoUrl]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ---- save profile (after photos) ----
  const saveProfile = async () => {
    setBusy(true); setError(null);
    try {
      await apiRequest("POST", "/api/profile", {
        displayName: displayName.trim(),
        age: parseInt(age, 10),
        gender,
        location: location.trim(),
        lookingFor: "Marriage",
        bio: bio.trim() || undefined,
        sect: sect || undefined,
        religiousPractice: practice || undefined,
        prayerFrequency: prayer || undefined,
        photos,
        profilePrompts: promptId && promptAnswer.trim()
          ? [{ promptId, answer: promptAnswer.trim() }]
          : undefined,
      });
      await qc.invalidateQueries({ queryKey: ["/api/profile"] });
      next();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  };

  // ---- wali invite (optional) ----
  const saveWali = async (skip: boolean) => {
    if (skip || !waliName || !waliEmail) { next(); return; }
    setBusy(true); setError(null);
    try {
      await apiRequest("POST", "/api/chaperones", {
        chaperoneName: waliName.trim(),
        chaperoneEmail: waliEmail.trim(),
        relationshipType: waliRelationship.trim() || undefined,
        accessType: waliAccess === "Report only" ? "report" : "live",
      });
      next();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add your Wali");
    } finally {
      setBusy(false);
    }
  };

  // ---- verification ----
  const verify = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError("Camera access is needed to verify"); return; }
    const res = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front, quality: 0.6, base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setBusy(true); setError(null);
    try {
      const selfie = `data:image/jpeg;base64,${res.assets[0].base64}`;
      const out = await apiRequest<{ isMatch: boolean }>("POST", "/api/compare-faces", {
        uploadedPhoto: photos[0],
        liveSelfie: selfie,
      });
      await qc.invalidateQueries({ queryKey: ["/api/profile"] });
      if (out.isMatch) {
        router.replace("/(tabs)");
      } else {
        setError("We couldn't match your selfie to your photo. Try again in good lighting.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verification failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ---- per-step continue ----
  const onContinue = () => {
    setError(null);
    if (step === 0) {
      const ageNum = parseInt(age, 10);
      if (!displayName || !ageNum || !gender || !location) return setError("Please complete all fields");
      if (ageNum < 18) return setError("You must be at least 18");
      return next();
    }
    if (step === 1) return next(); // faith optional
    if (step === 2) return next(); // prompt optional
    if (step === 3) {
      if (photos.length === 0) return setError("Add at least one photo");
      return saveProfile();
    }
  };

  return (
    <Background>
    <SafeAreaView style={styles.safe}>
      {/* Progress */}
      <View style={styles.progressRow}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.progressSeg, i <= step && styles.progressActive]} />
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="muted" style={styles.stepLabel}>Step {step + 1} of {STEPS.length}</Text>

          {step === 0 && (
            <>
              <Text variant="display" style={styles.title}>About you</Text>
              <Field label="Display name"><Input placeholder="e.g. Aisha" value={displayName} onChangeText={setDisplayName} /></Field>
              <Field label="Age"><Input placeholder="e.g. 28" keyboardType="number-pad" value={age} onChangeText={setAge} /></Field>
              <ChipGroup label="I am a" options={["Male", "Female"]}
                value={gender ? gender[0].toUpperCase() + gender.slice(1) : null}
                onChange={(v) => setGender(v.toLowerCase())} />
              <Field label="Location"><Input placeholder="e.g. London, UK" value={location} onChangeText={setLocation} /></Field>
            </>
          )}

          {step === 1 && (
            <>
              <Text variant="display" style={styles.title}>Your faith</Text>
              <ChipGroup label="Sect" options={SECTS} value={sect} onChange={setSect} />
              <ChipGroup label="Religious practice" options={PRACTICE} value={practice} onChange={setPractice} />
              <ChipGroup label="Prayer" options={PRAYER} value={prayer} onChange={setPrayer} />
            </>
          )}

          {step === 2 && (
            <>
              <Text variant="display" style={styles.title}>Say something</Text>
              <Field label="About you">
                <Input placeholder="A few words about yourself and the spouse you hope to find…"
                  value={bio} onChangeText={setBio} multiline style={styles.textArea} />
              </Field>
              <Text style={styles.label}>Answer a prompt (optional)</Text>
              <View style={styles.promptList}>
                {PROMPTS.map((p) => (
                  <Pressable key={p.id} onPress={() => setPromptId(p.id)}
                    style={[styles.promptChip, promptId === p.id && styles.promptChipActive]}>
                    <Text style={[styles.promptChipText, promptId === p.id && { color: colors.primaryForeground }]}>{p.prompt}</Text>
                  </Pressable>
                ))}
              </View>
              {promptId ? (
                <Input placeholder="Your answer…" value={promptAnswer} onChangeText={setPromptAnswer}
                  multiline style={styles.textArea} />
              ) : null}
            </>
          )}

          {step === 3 && (
            <>
              <Text variant="display" style={styles.title}>Your photos</Text>
              <Text variant="muted">Add up to 6. Your first photo is your main one.</Text>
              <View style={styles.photoGrid}>
                {photos.map((uri, i) => (
                  <View key={i} style={styles.photoTile}>
                    <Image source={{ uri }} style={styles.photoImg} />
                    <Pressable style={styles.removePhoto} onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}>
                      <Ionicons name="close" size={16} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {photos.length < 6 && (
                  <Pressable style={[styles.photoTile, styles.addTile]} onPress={addPhoto} disabled={uploading}>
                    {uploading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="add" size={32} color={colors.primary} />}
                  </Pressable>
                )}
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <Text variant="display" style={styles.title}>Invite your Wali</Text>
              <Text variant="muted">Optionally add a guardian to oversee your conversations — a hallmark of a halal match. You can add or change this later.</Text>
              <Field label="Wali's name"><Input placeholder="e.g. Ahmed (father)" value={waliName} onChangeText={setWaliName} /></Field>
              <Field label="Wali's email"><Input placeholder="email@example.com" autoCapitalize="none" keyboardType="email-address" value={waliEmail} onChangeText={setWaliEmail} /></Field>
              <Field label="Relationship"><Input placeholder="e.g. Father, Brother, Uncle" value={waliRelationship} onChangeText={setWaliRelationship} /></Field>
              <ChipGroup label="Access" options={ACCESS} value={waliAccess} onChange={setWaliAccess} />
            </>
          )}

          {step === 5 && (
            <>
              <Text variant="display" style={styles.title}>Verify it's you</Text>
              <Text variant="muted">Take a quick selfie so we can confirm your photos are really you. This keeps Fusion safe and genuine — and you'll need it before you can connect with matches.</Text>
              <View style={styles.verifyIcon}>
                <Ionicons name="shield-checkmark" size={56} color={colors.primary} />
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        {/* Footer nav */}
        <View style={styles.footer}>
          {step > 0 && step < 5 ? (
            <Pressable style={styles.backBtn} onPress={back}><Text variant="muted">Back</Text></Pressable>
          ) : <View style={{ width: 60 }} />}

          {step <= 3 && (
            <Button title={busy ? "Saving…" : "Continue"} loading={busy} onPress={onContinue} style={styles.cta} />
          )}
          {step === 4 && (
            <View style={styles.waliActions}>
              <Pressable onPress={() => saveWali(true)} hitSlop={8}><Text variant="muted">Skip</Text></Pressable>
              <Button title={busy ? "Saving…" : "Add Wali"} loading={busy} onPress={() => saveWali(false)} style={styles.cta} />
            </View>
          )}
          {step === 5 && (
            <View style={styles.waliActions}>
              <Pressable onPress={() => router.replace("/(tabs)")} hitSlop={8}><Text variant="muted">Later</Text></Pressable>
              <Button title={busy ? "Verifying…" : "Take selfie"} loading={busy} onPress={verify} style={styles.cta} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </Background>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  progressSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)" },
  progressActive: { backgroundColor: colors.primary },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },
  stepLabel: { marginBottom: -spacing.sm },
  title: { marginBottom: spacing.xs },
  field: { gap: spacing.sm },
  label: { color: colors.foreground, fontWeight: "600", fontSize: 15 },
  textArea: { height: 110, paddingTop: spacing.md, textAlignVertical: "top" },
  error: { color: colors.destructive },
  promptList: { gap: spacing.sm },
  promptChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.card },
  promptChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  promptChipText: { color: colors.foreground },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  photoTile: { width: "30%", aspectRatio: 3 / 4, borderRadius: radius.md, overflow: "hidden" },
  photoImg: { width: "100%", height: "100%", backgroundColor: colors.input },
  addTile: { borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  removePhoto: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  verifyIcon: { alignSelf: "center", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(212,175,55,0.12)", alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(7,12,22,0.5)" },
  backBtn: { width: 60 },
  cta: { flex: 1 },
  waliActions: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.lg },
});
