import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { dismissInlineNotification, type InlineNotification } from "@/hooks/use-inline-notification";

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: {
    bg: "bg-green-500",
    icon: "text-white",
  },
  error: {
    bg: "bg-red-500",
    icon: "text-white",
  },
  warning: {
    bg: "bg-amber-500",
    icon: "text-white",
  },
  info: {
    bg: "bg-blue-500",
    icon: "text-white",
  },
};

interface InlineNotificationBannerProps {
  notification: InlineNotification | null;
}

export function InlineNotificationBanner({ notification }: InlineNotificationBannerProps) {
  if (!notification) return null;

  const Icon = icons[notification.type];
  const color = colors[notification.type];

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[100] pointer-events-none"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
        >
          <div className="mx-4 pointer-events-auto">
            <div
              className={`${color.bg} rounded-xl shadow-lg px-4 py-3 flex items-center gap-3`}
            >
              <Icon className={`h-5 w-5 ${color.icon} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">
                  {notification.title}
                </p>
                {notification.description && (
                  <p className="text-white/80 text-xs truncate">
                    {notification.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismissInlineNotification()}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4 text-white/80" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function InlineNotificationProvider() {
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

  return <InlineNotificationBanner notification={notification} />;
}
