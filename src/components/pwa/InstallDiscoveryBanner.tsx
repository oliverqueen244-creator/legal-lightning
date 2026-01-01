import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'vakalat_install_banner_dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

/**
 * Install Discovery Banner
 * 
 * RULES (from spec):
 * - Appears only if: App is not already installed AND (beforeinstallprompt is available OR platform is iOS)
 * - Appears at most once per user per week
 * - Never blocks workflow
 * - Never claims offline reliability
 * - Never shows during court mode
 */
export function InstallDiscoveryBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // Start dismissed to prevent flash
  const [isInstalling, setIsInstalling] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // Check if in court mode - banner should NOT show during active court hours
  const isCourtMode = useCallback(() => {
    // Court hours: 10 AM - 5 PM IST on weekdays
    const now = new Date();
    const hours = now.getHours();
    const day = now.getDay();
    const isWeekday = day >= 1 && day <= 5;
    const isCourtHours = hours >= 10 && hours < 17;
    return isWeekday && isCourtHours;
  }, []);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION_MS) {
        setIsDismissed(true);
        return;
      }
    }

    setIsDismissed(false);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsVisible(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Determine visibility based on all conditions
  useEffect(() => {
    const shouldShow = 
      !isInstalled && 
      !isDismissed && 
      !isCourtMode() &&
      (deferredPrompt !== null || isIOS);
    
    // Small delay to prevent layout shift
    if (shouldShow) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isInstalled, isDismissed, deferredPrompt, isIOS, isCourtMode]);

  const handleInstall = async () => {
    if (isIOS) {
      // For iOS, redirect to install page with instructions
      window.location.href = '/install';
      return;
    }

    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsDismissed(true);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <Card className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40 border-border/50 bg-background/95 backdrop-blur-sm shadow-lg animate-in slide-in-from-bottom-4 duration-300">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">
              Install VAKALAT-OS
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add VAKALAT-OS to your home screen for faster access during court hours.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Some features require an internet connection.
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 -mt-1 -mr-1"
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            onClick={handleInstall}
            disabled={isInstalling}
            size="sm"
            className="flex-1"
          >
            {isInstalling ? 'Installing...' : 'Install'}
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleDismiss}
            className="text-muted-foreground"
          >
            Not now
          </Button>
        </div>
      </div>
    </Card>
  );
}
