import { isCapacitorNative, isIOS } from "./platform";

export type PermissionType = 'camera' | 'microphone' | 'camera_and_microphone';

export interface PermissionResult {
  granted: boolean;
  errorMessage?: string;
}

export async function requestCameraPermission(): Promise<PermissionResult> {
  console.log('[Permissions] Requesting camera permission...');
  
  try {
    if (isCapacitorNative()) {
      const Camera = (window as any).Capacitor?.Plugins?.Camera;
      
      if (Camera) {
        console.log('[Permissions] Using Capacitor Camera plugin');
        
        const status = await Camera.checkPermissions();
        console.log('[Permissions] Current camera status:', status);
        
        if (status.camera !== 'granted') {
          const result = await Camera.requestPermissions({ permissions: ['camera'] });
          console.log('[Permissions] Permission request result:', result);
          
          if (result.camera !== 'granted') {
            return {
              granted: false,
              errorMessage: isIOS() 
                ? 'Camera access denied. Please go to Settings > Fusion and enable Camera.'
                : 'Camera access denied. Please enable camera permission in your device settings.'
            };
          }
        }
        
        return { granted: true };
      }
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    console.log('[Permissions] Camera permission granted via getUserMedia');
    return { granted: true };
    
  } catch (error: any) {
    console.error('[Permissions] Camera permission error:', error);
    
    if (error.name === 'NotAllowedError') {
      return {
        granted: false,
        errorMessage: isIOS()
          ? 'Camera access denied. Please go to Settings > Fusion and enable Camera.'
          : 'Camera access denied. Please enable camera permission in your browser settings.'
      };
    }
    
    return {
      granted: false,
      errorMessage: 'Unable to access camera. Please check your permissions.'
    };
  }
}

export async function requestMicrophonePermission(): Promise<PermissionResult> {
  console.log('[Permissions] Requesting microphone permission...');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    console.log('[Permissions] Microphone permission granted');
    return { granted: true };
    
  } catch (error: any) {
    console.error('[Permissions] Microphone permission error:', error);
    
    if (error.name === 'NotAllowedError') {
      return {
        granted: false,
        errorMessage: isIOS()
          ? 'Microphone access denied. Please go to Settings > Fusion and enable Microphone.'
          : 'Microphone access denied. Please enable microphone permission in your browser settings.'
      };
    }
    
    return {
      granted: false,
      errorMessage: 'Unable to access microphone. Please check your permissions.'
    };
  }
}

export async function requestCameraAndMicrophonePermissions(): Promise<PermissionResult> {
  console.log('[Permissions] Requesting camera and microphone permissions...');
  
  try {
    if (isCapacitorNative()) {
      const Camera = (window as any).Capacitor?.Plugins?.Camera;
      
      if (Camera) {
        console.log('[Permissions] Checking Capacitor Camera permissions first');
        
        const status = await Camera.checkPermissions();
        console.log('[Permissions] Current status:', status);
        
        if (status.camera !== 'granted') {
          const result = await Camera.requestPermissions({ permissions: ['camera'] });
          console.log('[Permissions] Camera permission result:', result);
          
          if (result.camera !== 'granted') {
            return {
              granted: false,
              errorMessage: isIOS()
                ? 'Camera access denied. Please go to Settings > Fusion and enable Camera.'
                : 'Camera access denied. Please enable camera permission in your device settings.'
            };
          }
        }
      }
    }
    
    console.log('[Permissions] Requesting camera + audio via getUserMedia');
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    stream.getTracks().forEach(track => track.stop());
    console.log('[Permissions] Camera and microphone permissions granted');
    return { granted: true };
    
  } catch (error: any) {
    console.error('[Permissions] Camera/microphone permission error:', error);
    
    if (error.name === 'NotAllowedError') {
      return {
        granted: false,
        errorMessage: isIOS()
          ? 'Camera and microphone access denied. Please go to Settings > Fusion and enable Camera & Microphone.'
          : 'Camera and microphone access denied. Please enable permissions in your browser settings.'
      };
    }
    
    if (error.name === 'NotFoundError') {
      return {
        granted: false,
        errorMessage: 'Camera or microphone not found on this device.'
      };
    }
    
    if (error.name === 'NotReadableError') {
      return {
        granted: false,
        errorMessage: 'Camera is in use by another app. Please close other apps using the camera.'
      };
    }
    
    return {
      granted: false,
      errorMessage: 'Unable to access camera or microphone. Please check your permissions.'
    };
  }
}

export async function checkCameraPermission(): Promise<boolean> {
  try {
    if (isCapacitorNative()) {
      const Camera = (window as any).Capacitor?.Plugins?.Camera;
      if (Camera) {
        const status = await Camera.checkPermissions();
        return status.camera === 'granted';
      }
    }
    
    if (navigator.permissions) {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state === 'granted';
    }
    
    return false;
  } catch {
    return false;
  }
}
