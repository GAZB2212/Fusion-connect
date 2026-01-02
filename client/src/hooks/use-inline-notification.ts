import { useState, useEffect } from "react";
import { haptic } from "@/lib/haptics";
import { isCapacitorNative } from "@/lib/platform";

export interface InlineNotification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
}

let notificationId = 0;
let currentNotification: InlineNotification | null = null;
let dismissTimeout: NodeJS.Timeout | null = null;

function dispatchNotification() {
  window.dispatchEvent(
    new CustomEvent("inline-notification", { detail: currentNotification })
  );
}

export function showInlineNotification(
  type: "success" | "error" | "warning" | "info",
  title: string,
  description?: string,
  duration: number = 3000
) {
  if (dismissTimeout) {
    clearTimeout(dismissTimeout);
  }

  notificationId++;
  currentNotification = {
    id: notificationId.toString(),
    type,
    title,
    description,
  };

  if (isCapacitorNative()) {
    switch (type) {
      case "error":
        haptic.error();
        break;
      case "warning":
        haptic.warning();
        break;
      case "success":
        haptic.success();
        break;
      default:
        haptic.light();
    }
  }

  dispatchNotification();

  dismissTimeout = setTimeout(() => {
    currentNotification = null;
    dispatchNotification();
  }, duration);
}

export function dismissInlineNotification() {
  if (dismissTimeout) {
    clearTimeout(dismissTimeout);
  }
  currentNotification = null;
  dispatchNotification();
}

export function useInlineNotification() {
  const [notification, setNotification] = useState<InlineNotification | null>(null);

  useEffect(() => {
    const handleNotification = (event: CustomEvent<InlineNotification | null>) => {
      setNotification(event.detail);
    };

    window.addEventListener(
      "inline-notification" as any,
      handleNotification as EventListener
    );

    return () => {
      window.removeEventListener(
        "inline-notification" as any,
        handleNotification as EventListener
      );
    };
  }, []);

  return {
    notification,
    show: showInlineNotification,
    dismiss: dismissInlineNotification,
  };
}
