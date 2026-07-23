import { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIAP, getReceiptIOS, ErrorCode, type Purchase } from "react-native-iap";
import { useQueryClient } from "@tanstack/react-query";
import { Text, Button } from "@/components/ui";
import { Background } from "@/components/Background";
import { apiRequest } from "@/api";
import { PREMIUM_PRODUCT_ID } from "@/useSubscription";
import { colors, spacing, radius, gold } from "@/theme";

const BENEFITS = [
  { icon: "heart", text: "See everyone who likes you" },
  { icon: "infinite", text: "Unlimited matches & messaging" },
  { icon: "call", text: "Voice & video calls with matches" },
  { icon: "sparkles", text: "Priority placement in discovery" },
  { icon: "shield-checkmark", text: "Verified, serious members only" },
];

export default function Subscribe() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void finalize(purchase);
    },
    onPurchaseError: (err) => {
      setWorking(false);
      if (err?.code !== ErrorCode.UserCancelled) {
        setMessage(err?.message || "Purchase failed. Please try again.");
      }
    },
  });

  const finalize = async (purchase: Purchase) => {
    try {
      // Grab the App Store receipt and verify it on our backend.
      const receipt = Platform.OS === "ios" ? await getReceiptIOS().catch(() => "") : "";
      const proof = receipt || purchase.purchaseToken || "";
      await apiRequest("POST", "/api/iap/apple/verify", { receipt: proof });
      await finishTransaction({ purchase, isConsumable: false });
      await queryClient.invalidateQueries({ queryKey: ["/api/subscription-status"] });
      setMessage(null);
      router.back();
    } catch (e: any) {
      setMessage(
        e?.message || "We couldn't confirm your purchase. If you were charged, tap Restore."
      );
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    if (connected) {
      fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: "subs" }).catch(() => {});
    }
  }, [connected, fetchProducts]);

  const product = useMemo(
    () => subscriptions.find((s) => s.id === PREMIUM_PRODUCT_ID) ?? subscriptions[0],
    [subscriptions]
  );
  const priceLabel = product?.displayPrice ?? "£19.99";

  const onSubscribe = async () => {
    if (!connected) {
      setMessage("Connecting to the App Store… please try again in a moment.");
      return;
    }
    setMessage(null);
    setWorking(true);
    try {
      await requestPurchase({
        request: {
          apple: { sku: PREMIUM_PRODUCT_ID },
          google: { skus: [PREMIUM_PRODUCT_ID] },
        },
        type: "subs",
      });
    } catch (e: any) {
      setWorking(false);
      if (e?.code !== ErrorCode.UserCancelled) {
        setMessage(e?.message || "Couldn't start the purchase.");
      }
    }
  };

  const onRestore = async () => {
    setWorking(true);
    setMessage(null);
    try {
      await restorePurchases();
      const receipt = Platform.OS === "ios" ? await getReceiptIOS().catch(() => "") : "";
      if (receipt) {
        const res = await apiRequest<{ hasActiveSubscription: boolean }>(
          "POST",
          "/api/iap/apple/verify",
          { receipt }
        );
        await queryClient.invalidateQueries({ queryKey: ["/api/subscription-status"] });
        if (res.hasActiveSubscription) {
          router.back();
          return;
        }
      }
      setMessage("No active subscription found to restore.");
    } catch (e: any) {
      setMessage(e?.message || "Couldn't restore purchases.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Background>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.close} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={26} color={colors.mutedForeground} />
          </Pressable>

          <View style={styles.crown}>
            <Ionicons name="diamond" size={32} color={colors.primary} />
          </View>
          <Text variant="display" style={styles.title}>
            Fusion Premium
          </Text>
          <Text variant="muted" style={styles.subtitle}>
            Everything you need to find your spouse
          </Text>

          <View style={styles.card}>
            {BENEFITS.map((b) => (
              <View key={b.text} style={styles.benefit}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon as any} size={18} color={colors.primary} />
                </View>
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{priceLabel}</Text>
            <Text variant="muted"> / month</Text>
          </View>
          <Text style={styles.compare}>Less than half the price of the leading app</Text>

          {message ? <Text style={styles.error}>{message}</Text> : null}

          <Button
            title={working ? "" : "Start Premium"}
            loading={working}
            onPress={onSubscribe}
            style={styles.cta}
          />

          <Pressable onPress={onRestore} hitSlop={8} disabled={working}>
            <Text style={styles.restore}>Restore purchases</Text>
          </Pressable>

          <Text variant="muted" style={styles.note}>
            Billed monthly through your Apple ID. Renews automatically until cancelled in
            Settings. Cancel anytime.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  content: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  close: { alignSelf: "flex-end" },
  crown: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: gold.soft,
    borderWidth: 1,
    borderColor: gold.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  title: { textAlign: "center", marginTop: spacing.sm },
  subtitle: { textAlign: "center", marginBottom: spacing.md },
  card: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.md,
  },
  benefit: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: gold.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: { flex: 1, fontSize: 15, color: colors.foreground },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: spacing.lg },
  price: { fontSize: 40, fontWeight: "800", color: colors.foreground },
  compare: { fontSize: 13, color: colors.primary, fontWeight: "500" },
  error: { color: colors.destructive, fontSize: 14, textAlign: "center" },
  cta: { width: "100%", marginTop: spacing.sm },
  restore: { color: colors.primary, fontWeight: "600", marginTop: spacing.md, fontSize: 15 },
  note: { textAlign: "center", fontSize: 12, marginTop: spacing.md, lineHeight: 17 },
});
