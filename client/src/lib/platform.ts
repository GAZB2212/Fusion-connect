// Platform detection utilities for web vs Capacitor native

export type Platform = 'web' | 'ios' | 'android';

export interface PlatformInfo {
  platform: Platform;
  isNative: boolean;
  isWeb: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

// Check if running inside Capacitor native container
export function isCapacitorNative(): boolean {
  // Capacitor injects this into the window object
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

// Get current platform
export function getPlatform(): Platform {
  if (!isCapacitorNative()) {
    return 'web';
  }
  
  const capacitor = (window as any).Capacitor;
  const platform = capacitor?.getPlatform?.();
  
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  
  return 'web';
}

// Get full platform info
export function getPlatformInfo(): PlatformInfo {
  const platform = getPlatform();
  
  return {
    platform,
    isNative: platform !== 'web',
    isWeb: platform === 'web',
    isIOS: platform === 'ios',
    isAndroid: platform === 'android'
  };
}

// Check if running on mobile (either native or mobile web)
export function isMobile(): boolean {
  if (isCapacitorNative()) return true;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Check if Capacitor plugins are available
export function hasCapacitorPlugin(pluginName: string): boolean {
  return !!(window as any).Capacitor?.Plugins?.[pluginName];
}
