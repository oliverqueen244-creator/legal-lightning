import { useCallback, useRef, useEffect } from 'react';

// Simple notification sound using Web Audio API
export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isEnabledRef = useRef(true);

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };

    // Resume audio context on user interaction (required by browsers)
    const handleInteraction = () => {
      initAudio();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const playNotification = useCallback((type: 'message' | 'urgent' = 'message') => {
    if (!isEnabledRef.current) return;

    try {
      const ctx = audioContextRef.current;
      if (!ctx) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current!;
      
      // Resume if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === 'urgent') {
        // Urgent: Two-tone alert
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1); // C#6
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      } else {
        // Message: Gentle chime
        oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.1); // G5
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      }
    } catch (err) {
      console.warn('Could not play notification sound:', err);
    }
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    isEnabledRef.current = enabled;
  }, []);

  return { playNotification, setEnabled };
}
