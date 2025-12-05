import { useCallback, useRef, useEffect } from 'react';

export type NotificationSoundType = 'message' | 'urgent' | 'panic' | 'passover' | 'fast_moving';

// Enhanced notification sound system with distinct sounds for different alerts
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

  const getOrCreateContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  }, []);

  const playNotification = useCallback((type: NotificationSoundType = 'message') => {
    if (!isEnabledRef.current) return;

    try {
      const ctx = getOrCreateContext();
      const now = ctx.currentTime;

      switch (type) {
        case 'panic': {
          // SIREN: Alternating two-tone alarm (police siren style)
          // High urgency - case is imminent
          for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sawtooth';
            const startTime = now + i * 0.3;
            
            // Alternate between 880Hz and 660Hz
            osc.frequency.setValueAtTime(880, startTime);
            osc.frequency.setValueAtTime(660, startTime + 0.15);
            
            gain.gain.setValueAtTime(0.35, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.28);
            
            osc.start(startTime);
            osc.stop(startTime + 0.3);
          }
          break;
        }
        
        case 'passover': {
          // DOWN-TONE: Descending notes indicating something was missed
          // Sad/warning feeling
          const frequencies = [587.33, 493.88, 392]; // D5 → B4 → G4 (descending)
          
          frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sine';
            const startTime = now + i * 0.15;
            
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.25, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
            
            osc.start(startTime);
            osc.stop(startTime + 0.2);
          });
          break;
        }
        
        case 'fast_moving': {
          // RAPID BEEPS: Quick succession of beeps indicating fast court movement
          for (let i = 0; i < 4; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'square';
            const startTime = now + i * 0.1;
            
            osc.frequency.setValueAtTime(1200, startTime);
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.05);
            
            osc.start(startTime);
            osc.stop(startTime + 0.08);
          }
          break;
        }
        
        case 'urgent': {
          // TWO-TONE ALERT: Attention-grabbing but not as intense as panic
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.setValueAtTime(1100, now + 0.1);
          osc.frequency.setValueAtTime(880, now + 0.2);
          
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        }
        
        case 'message':
        default: {
          // GENTLE CHIME: Pleasant notification sound
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, now); // D5
          osc.frequency.setValueAtTime(783.99, now + 0.1); // G5
          
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        }
      }
    } catch (err) {
      console.warn('Could not play notification sound:', err);
    }
  }, [getOrCreateContext]);

  const setEnabled = useCallback((enabled: boolean) => {
    isEnabledRef.current = enabled;
  }, []);

  return { playNotification, setEnabled };
}
