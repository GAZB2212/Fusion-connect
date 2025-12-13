import { useRef, useCallback, useEffect } from 'react';

interface RingtoneOptions {
  frequency?: number;
  duration?: number;
  interval?: number;
}

export function useRingtone(options: RingtoneOptions = {}) {
  const {
    frequency = 440,
    duration = 400,
    interval = 200,
  } = options;

  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  const playTone = useCallback((freq: number, dur: number) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + dur / 1000);
  }, []);

  const playRingPattern = useCallback(() => {
    playTone(frequency, duration);
    setTimeout(() => {
      playTone(frequency * 1.25, duration);
    }, duration + 50);
  }, [playTone, frequency, duration]);

  const startRinging = useCallback(() => {
    if (isPlayingRef.current) return;
    
    isPlayingRef.current = true;
    playRingPattern();
    
    intervalIdRef.current = setInterval(() => {
      if (isPlayingRef.current) {
        playRingPattern();
      }
    }, (duration * 2) + interval + 800);
  }, [playRingPattern, duration, interval]);

  const stopRinging = useCallback(() => {
    isPlayingRef.current = false;
    
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopRinging();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopRinging]);

  return { startRinging, stopRinging, isPlaying: isPlayingRef.current };
}
