import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isCapacitorNative } from './platform';

export const haptic = {
  light: async () => {
    if (!isCapacitorNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      console.debug('[Haptics] Light impact not available');
    }
  },

  medium: async () => {
    if (!isCapacitorNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
      console.debug('[Haptics] Medium impact not available');
    }
  },

  heavy: async () => {
    if (!isCapacitorNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {
      console.debug('[Haptics] Heavy impact not available');
    }
  },

  success: async () => {
    if (!isCapacitorNative()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {
      console.debug('[Haptics] Success notification not available');
    }
  },

  warning: async () => {
    if (!isCapacitorNative()) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (e) {
      console.debug('[Haptics] Warning notification not available');
    }
  },

  error: async () => {
    if (!isCapacitorNative()) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (e) {
      console.debug('[Haptics] Error notification not available');
    }
  },

  selectionChanged: async () => {
    if (!isCapacitorNative()) return;
    try {
      await Haptics.selectionChanged();
    } catch (e) {
      console.debug('[Haptics] Selection change not available');
    }
  },

  selectionStart: async () => {
    if (!isCapacitorNative()) return;
    try {
      await Haptics.selectionStart();
    } catch (e) {
      console.debug('[Haptics] Selection start not available');
    }
  },

  selectionEnd: async () => {
    if (!isCapacitorNative()) return;
    try {
      await Haptics.selectionEnd();
    } catch (e) {
      console.debug('[Haptics] Selection end not available');
    }
  },
};

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export const triggerHaptic = async (type: HapticType = 'light') => {
  switch (type) {
    case 'light':
      return haptic.light();
    case 'medium':
      return haptic.medium();
    case 'heavy':
      return haptic.heavy();
    case 'success':
      return haptic.success();
    case 'warning':
      return haptic.warning();
    case 'error':
      return haptic.error();
    case 'selection':
      return haptic.selectionChanged();
    default:
      return haptic.light();
  }
};
