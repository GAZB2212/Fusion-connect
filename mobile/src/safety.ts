import { ActionSheetIOS, Alert, Platform } from "react-native";
import { apiRequest } from "./api";

const REPORT_REASONS = [
  "Inappropriate photos or profile",
  "Inappropriate messages",
  "Fake profile or scam",
  "Harassment",
  "Other",
];

function chooseReason(onPick: (reason: string) => void) {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Why are you reporting this profile?",
        options: [...REPORT_REASONS, "Cancel"],
        cancelButtonIndex: REPORT_REASONS.length,
      },
      (i) => {
        if (i < REPORT_REASONS.length) onPick(REPORT_REASONS[i]);
      }
    );
  } else {
    Alert.alert("Why are you reporting this profile?", undefined, [
      ...REPORT_REASONS.map((r) => ({ text: r, onPress: () => onPick(r) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }
}

/**
 * Report and/or block a member from anywhere their profile is shown.
 * `onRemoved` runs once the member should disappear from the current view
 * (after a block, or after a report — reported profiles are hidden too).
 */
export function openSafetyMenu(opts: { userId: string; name: string; onRemoved?: () => void }) {
  const first = opts.name.split(" ")[0] || "this member";

  const block = async () => {
    try {
      await apiRequest("POST", `/api/users/${opts.userId}/block`);
      opts.onRemoved?.();
    } catch {
      Alert.alert("Couldn't block", "Please check your connection and try again.");
    }
  };

  const confirmBlock = () =>
    Alert.alert(`Block ${first}?`, "They won't be able to see you or contact you.", [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: block },
    ]);

  const report = () =>
    chooseReason(async (reason) => {
      try {
        await apiRequest("POST", `/api/users/${opts.userId}/report`, { reason });
        // Hide the reported member from the reporter straight away.
        await apiRequest("POST", `/api/users/${opts.userId}/block`).catch(() => {});
        opts.onRemoved?.();
        Alert.alert(
          "Report received",
          "Thank you — our team will review this report. You won't see this profile again."
        );
      } catch {
        Alert.alert("Couldn't send report", "Please check your connection and try again.");
      }
    });

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Report", "Block", "Cancel"], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) report();
        else if (i === 1) confirmBlock();
      }
    );
  } else {
    Alert.alert(first, undefined, [
      { text: "Report", onPress: report },
      { text: "Block", style: "destructive", onPress: confirmBlock },
      { text: "Cancel", style: "cancel" },
    ]);
  }
}
