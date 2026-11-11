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
import { ChipGroup, MultiChipGroup } from "@/components/Chips";
import { Background } from "@/components/Background";
import { useAuth } from "@/auth";
import { apiRequest, ApiError } from "@/api";
import { PROMPTS } from "@/prompts";
import { colors, spacing, radius } from "@/theme";

// ---- Option sets (Muzz-style, tuned for a Muslim marriage app) ----
const ETHNICITIES = [
  "Arab", "Pakistani", "Indian", "Bangladeshi", "Turkish", "Persian", "Kurdish",
  "Afghan", "Somali", "North African", "West African", "Black Caribbean",
  "Malay", "Indonesian", "White / European", "Mixed", "Other",
];
const LANGUAGES = [
  "English", "Arabic", "Urdu", "Punjabi", "Bengali", "Turkish", "Farsi", "Pashto",
  "Gujarati", "Hindi", "Somali", "French", "Malay", "Hausa", "Other",
];
const SECTS = ["Just Muslim", "Sunni", "Sunni (Hanafi)", "Sunni (Maliki)", "Sunni (Shafi'i)", "Sunni (Hanbali)", "Shia", "Sufi", "No preference", "Other"];
const PRACTICE = ["Strictly practising", "Actively practising", "Moderately practising", "Not very practising"];
const PRAYER = ["Always", "Most of the time", "Sometimes", "Rarely", "Prefer not to say"];
const HALAL = ["Always halal", "Mostly halal", "Sometimes", "Not important"];
const MARITAL = ["Never married", "Divorced", "Widowed", "Separated", "Annulled"];
const WANTS_CHILDREN = ["Yes", "Maybe", "No", "Open to discuss", "Prefer not to say"];
const YES_NO = ["No", "Yes"];
const INTERESTS = [
  "Travel", "Reading", "Cooking", "Fitness", "Sports", "Art", "Photography",
  "Volunteering", "Hiking", "Films", "Nasheeds", "Entrepreneurship",
  "Islamic studies", "Charity", "Foodie", "Calligraphy", "Languages", "Gaming",
];
const ACCESS = ["Live access", "Report only"];

const STEPS = [
  "About", "Name", "Location", "Background", "Faith", "Prayer",
  "Life", "Work", "You", "Photos", "Wali", "Verify",
];

export default function ProfileSetup() {
  const router = useRouter();
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Basics
  const [gender, setGender] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  // Background
  const [ethnicities, setEthnicities] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  // Faith
  const [bornMuslim, setBornMuslim] = useState<string | null>(null);
  const [sect, setSect] = useState<string | null>(null);
  const [practice, setPractice] = useState<string | null>(null);
  const [prayer, setPrayer] = useState<string | null>(null);
  const [halal, setHalal] = useState<string | null>(null);
  // Life
  const [maritalStatus, setMaritalStatus] = useState<string | null>(null);
  const [hasKids, setHasKids] = useState<string | null>(null);
  const [wantsChildren, setWantsChildren] = useState<string | null>(null);
  const [height, setHeight] = useState("");
  // Work
  const [education, setEducation] = useState("");
  const [profession, setProfession] = useState("");
  // You
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [promptId, setPromptId] = useState<string | null>(null);
  const [promptAnswer, setPromptAnswer] = useState("");
  // Photos
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // Wali
  const [waliName, setWaliName] = useState("");
  const [waliEmail, setWaliEmail] = useState("");
  const [waliRelationship, setWaliRelationship] = useState("");
  const [waliAccess, setWaliAccess] = useState<string | null>("Live access");

  const confirmLogout = () =>
    Alert.alert("Log out", "Leave onboarding and sign out? Your progress here isn't saved.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: signOut },
    ]);

  const next = () => { setError(null); setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const back = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };

  // ---- photo upload ----
  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo access is needed to add photos"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: true });
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
      const body: Record<string, unknown> = {
        displayName: displayName.trim(),
        age: parseInt(age, 10),
        gender,
        location: location.trim(),
        lookingFor: "Marriage",
        photos,
      };
      if (ethnicities.length) body.ethnicities = ethnicities;
      if (languages.length) body.languages = languages;
      if (bornMuslim) body.bornMuslim = bornMuslim === "Yes";
      if (sect) body.sect = sect;
      if (practice) body.religiousPractice = practice;
      if (prayer) body.prayerFrequency = prayer;
      if (halal) body.halalImportance = halal;
      if (maritalStatus) body.maritalStatus = maritalStatus;
      if (hasKids) body.hasChildren = hasKids === "Yes";
      if (wantsChildren) body.wantsChildren = wantsChildren;
      const h = parseInt(height, 10);
      if (!Number.isNaN(h) && h > 0) { body.height = h; body.heightUnit = "cm"; }
      if (education.trim()) body.education = education.trim();
      if (profession.trim()) { body.profession = profession.trim(); body.occupation = profession.trim(); }
      if (interests.length) body.interests = interests;
      if (bio.trim()) body.bio = bio.trim();
      if (promptId && promptAnswer.trim()) body.profilePrompts = [{ promptId, answer: promptAnswer.trim() }];

      await apiRequest("POST", "/api/profile", body);
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
    const res = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.6, base64: true });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setBusy(true); setError(null);
    try {
      const selfie = `data:image/jpeg;base64,${res.assets[0].base64}`;
      const out = await apiRequest<{ isMatch: boolean }>("POST", "/api/compare-faces", {
        uploadedPhoto: photos[0], liveSelfie: selfie,
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
      if (!gender) return setError("Please choose one");
      return next();
    }
    if (step === 1) {
      const ageNum = parseInt(age, 10);
      if (!displayName.trim() || !ageNum) return setError("Please add your name and age");
      if (ageNum < 18) return setError("You must be at least 18 to use Fusion");
      if (ageNum > 99) return setError("Please enter a valid age");
      return next();
    }
    if (step === 2) {
      if (!location.trim()) return setError("Please add your location");
      return next();
    }
    if (step >= 3 && step <= 8) return next(); // optional but encouraged
    if (step === 9) {
      if (photos.length === 0) return setError("Add at least one photo to continue");
      return saveProfile();
    }
  };

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <Background>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={back} hitSlop={10} disabled={step === 0} style={step === 0 ? { opacity: 0.3 } : undefined}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={styles.setupBrand}>Set up your profile</Text>
          <Pressable onPress={confirmLogout} hitSlop={10}>
            <Ionicons name="log-out-outline" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text variant="muted" style={styles.stepLabel}>Step {step + 1} of {STEPS.length}</Text>

            {step === 0 && (
              <>
                <Text variant="display" style={styles.title}>I am a…</Text>
                <Text variant="muted" style={styles.sub}>Fusion is for marriage — you'll be shown profiles of the opposite gender.</Text>
                <ChipGroup label="Gender" options={["Male", "Female"]}
                  value={gender ? gender[0].toUpperCase() + gender.slice(1) : null}
                  onChange={(v) => setGender(v.toLowerCase())} />
              </>
            )}

            {step === 1 && (
              <>
                <Text variant="display" style={styles.title}>Your name & age</Text>
                <Field label="First name"><Input placeholder="e.g. Aisha" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" /></Field>
                <Field label="Age"><Input placeholder="e.g. 28" keyboardType="number-pad" value={age} onChangeText={setAge} maxLength={2} /></Field>
              </>
            )}

            {step === 2 && (
              <>
                <Text variant="display" style={styles.title}>Where you're based</Text>
                <Text variant="muted" style={styles.sub}>We use this to show you matches nearby.</Text>
                <Field label="Location"><Input placeholder="e.g. London, UK" value={location} onChangeText={setLocation} /></Field>
              </>
            )}

            {step === 3 && (
              <>
                <Text variant="display" style={styles.title}>Your background</Text>
                <MultiChipGroup label="Ethnicity" hint="up to 3" options={ETHNICITIES} values={ethnicities} onChange={setEthnicities} max={3} />
                <MultiChipGroup label="Languages" hint="up to 5" options={LANGUAGES} values={languages} onChange={setLanguages} max={5} />
              </>
            )}

            {step === 4 && (
              <>
                <Text variant="display" style={styles.title}>Your faith</Text>
                <ChipGroup label="Were you born Muslim?" options={YES_NO} value={bornMuslim} onChange={setBornMuslim} />
                <ChipGroup label="Sect" options={SECTS} value={sect} onChange={setSect} />
                <ChipGroup label="Religious practice" options={PRACTICE} value={practice} onChange={setPractice} />
              </>
            )}

            {step === 5 && (
              <>
                <Text variant="display" style={styles.title}>Your deen</Text>
                <ChipGroup label="How often do you pray?" options={PRAYER} value={prayer} onChange={setPrayer} />
                <ChipGroup label="Do you eat halal?" options={HALAL} value={halal} onChange={setHalal} />
              </>
            )}

            {step === 6 && (
              <>
                <Text variant="display" style={styles.title}>A little about life</Text>
                <ChipGroup label="Marital status" options={MARITAL} value={maritalStatus} onChange={setMaritalStatus} />
                <ChipGroup label="Do you have children?" options={YES_NO} value={hasKids} onChange={setHasKids} />
                <ChipGroup label="Do you want children?" options={WANTS_CHILDREN} value={wantsChildren} onChange={setWantsChildren} />
                <Field label="Height (cm) — optional"><Input placeholder="e.g. 170" keyboardType="number-pad" value={height} onChangeText={setHeight} maxLength={3} /></Field>
              </>
            )}

            {step === 7 && (
              <>
                <Text variant="display" style={styles.title}>Education & work</Text>
                <Text variant="muted" style={styles.sub}>Optional, but it helps you stand out.</Text>
                <Field label="Education"><Input placeholder="e.g. BSc Pharmacy, UCL" value={education} onChangeText={setEducation} /></Field>
                <Field label="Profession"><Input placeholder="e.g. Pharmacist" value={profession} onChangeText={setProfession} autoCapitalize="words" /></Field>
              </>
            )}

            {step === 8 && (
              <>
                <Text variant="display" style={styles.title}>Say something</Text>
                <MultiChipGroup label="Interests" hint="up to 6" options={INTERESTS} values={interests} onChange={setInterests} max={6} />
                <Field label="About you">
                  <Input placeholder="A few words about yourself and the spouse you hope to find…"
                    value={bio} onChangeText={setBio} multiline style={styles.textArea} />
                </Field>
                <Text style={styles.label}>Answer a prompt (optional)</Text>
                <View style={styles.promptList}>
                  {PROMPTS.map((p) => (
                    <Pressable key={p.id} onPress={() => setPromptId(promptId === p.id ? null : p.id)}
                      style={[styles.promptChip, promptId === p.id && styles.promptChipActive]}>
                      <Text style={[styles.promptChipText, promptId === p.id && { color: colors.primaryForeground }]}>{p.prompt}</Text>
                    </Pressable>
                  ))}
                </View>
                {promptId ? (
                  <Input placeholder="Your answer…" value={promptAnswer} onChangeText={setPromptAnswer} multiline style={styles.textArea} />
                ) : null}
              </>
            )}

            {step === 9 && (
              <>
                <Text variant="display" style={styles.title}>Your photos</Text>
                <Text variant="muted" style={styles.sub}>Add up to 6. Your first photo is your main one. Clear face photos get more matches.</Text>
                <View style={styles.photoGrid}>
                  {photos.map((uri, i) => (
                    <View key={i} style={styles.photoTile}>
                      <Image source={{ uri }} style={styles.photoImg} />
                      {i === 0 ? <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>Main</Text></View> : null}
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

            {step === 10 && (
              <>
                <Text variant="display" style={styles.title}>Invite your Wali</Text>
                <Text variant="muted" style={styles.sub}>Optionally add a guardian to oversee your conversations — a hallmark of a halal match. You can add or change this later.</Text>
                <Field label="Wali's name"><Input placeholder="e.g. Ahmed (father)" value={waliName} onChangeText={setWaliName} /></Field>
                <Field label="Wali's email"><Input placeholder="email@example.com" autoCapitalize="none" keyboardType="email-address" value={waliEmail} onChangeText={setWaliEmail} /></Field>
                <Field label="Relationship"><Input placeholder="e.g. Father, Brother, Uncle" value={waliRelationship} onChangeText={setWaliRelationship} /></Field>
                <ChipGroup label="Access" options={ACCESS} value={waliAccess} onChange={setWaliAccess} />
              </>
            )}

            {step === 11 && (
              <>
                <Text variant="display" style={styles.title}>Verify it's you</Text>
                <Text variant="muted" style={styles.sub}>Take a quick selfie so we can confirm your photos are really you. This keeps Fusion safe and genuine — and you'll get a verified badge.</Text>
                <View style={styles.verifyIcon}>
                  <Ionicons name="shield-checkmark" size={56} color={colors.primary} />
                </View>
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            {step <= 9 && (
              <Button title={busy ? "Saving…" : step === 9 ? "Save & continue" : "Continue"} loading={busy} onPress={onContinue} style={styles.cta} />
            )}
            {step === 10 && (
              <View style={styles.rowActions}>
                <Pressable onPress={() => saveWali(true)} hitSlop={8}><Text variant="muted">Skip</Text></Pressable>
                <Button title={busy ? "Saving…" : "Add Wali"} loading={busy} onPress={() => saveWali(false)} style={styles.cta} />
              </View>
            )}
            {step === 11 && (
              <View style={styles.rowActions}>
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
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  setupBrand: { color: colors.foreground, fontSize: 15, fontWeight: "600" },
  progressTrack: { height: 5, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: colors.primary },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },
  stepLabel: { marginBottom: -spacing.sm },
  title: { marginBottom: spacing.xs },
  sub: { marginTop: -spacing.sm },
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
  mainBadge: { position: "absolute", bottom: 4, left: 4, backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  mainBadgeText: { color: colors.primaryForeground, fontSize: 10, fontWeight: "700" },
  addTile: { borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  removePhoto: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  verifyIcon: { alignSelf: "center", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(212,175,55,0.12)", alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  footer: { padding: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(7,12,22,0.5)" },
  rowActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.lg },
  cta: { width: "100%" },
});
