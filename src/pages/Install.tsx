import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Smartphone, Monitor, CheckCircle2, WifiOff, Shield, AlertTriangle } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Page
 * 
 * INSTALLABILITY SAFETY COPY: Conservative messaging about offline capabilities.
 * Users must understand connection-dependent features before installing.
 */
export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
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

  // FIX 2: Robust iOS/iPadOS detection (handles iPadOS 13+ which reports as macOS)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-wide text-foreground">
            Install Vakalat-OS
          </h1>
          <p className="text-muted-foreground">
            Access your litigation dashboard from your home screen
          </p>
        </div>

        {/* Already Installed */}
        {isInstalled && (
          <Card className="border-court-success/50 bg-court-success/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-court-success">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <p className="font-semibold">Already Installed</p>
                  <p className="text-sm text-muted-foreground">
                    Vakalat-OS is on your home screen.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Install Prompt Available */}
        {deferredPrompt && !isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Ready to Install
              </CardTitle>
              <CardDescription>
                Add Vakalat-OS to your device for quick access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleInstall} 
                disabled={isInstalling}
                className="w-full"
                size="lg"
              >
                {isInstalling ? 'Installing...' : 'Install App'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Manual Install Instructions */}
        {!deferredPrompt && !isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isIOS ? (
                  <Smartphone className="h-5 w-5 text-primary" />
                ) : isAndroid ? (
                  <Smartphone className="h-5 w-5 text-primary" />
                ) : (
                  <Monitor className="h-5 w-5 text-primary" />
                )}
                Install Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isIOS ? (
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Tap the <strong>Share</strong> button in Safari</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                  <li>Tap <strong>Add</strong> to confirm</li>
                </ol>
              ) : isAndroid ? (
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Tap the <strong>menu</strong> (three dots) in your browser</li>
                  <li>Select <strong>Add to Home Screen</strong> or <strong>Install App</strong></li>
                  <li>Tap <strong>Install</strong> to confirm</li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Click the <strong>install icon</strong> in the address bar</li>
                  <li>Or open browser menu → <strong>Install Vakalat-OS</strong></li>
                  <li>Click <strong>Install</strong> to confirm</li>
                </ol>
              )}
            </CardContent>
          </Card>
        )}

        {/* INSTALLABILITY SAFETY COPY - MANDATORY */}
        <Card className="border-border/50 bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Connection-Aware Design
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>VAKALAT-OS adapts to connection quality</strong> to prevent 
              misleading court information. Some features require an active internet 
              connection.
            </p>
            
            <div className="flex items-start gap-2 p-2 rounded bg-background/50">
              <WifiOff className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">When offline:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Viewing cached cases and documents is available</li>
                  <li>Personal notes can be saved locally and will sync when online</li>
                  <li>Messaging and live court data require connection</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2 rounded bg-background/50">
              <AlertTriangle className="h-4 w-4 text-court-warning shrink-0 mt-0.5" />
              <p>
                Court schedules and live board status are <strong>always fetched fresh</strong> 
                when connected to ensure accuracy.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Current Status */}
        <div className="flex justify-center gap-2">
          <Badge variant={isOnline ? 'outline' : 'destructive'} className="text-xs">
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop'}
          </Badge>
        </div>
      </div>
    </div>
  );
}
