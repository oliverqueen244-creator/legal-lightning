import { useState, useEffect } from 'react';
import logoImage from '@/assets/logo.png';
import { cn } from '@/lib/utils';

const SPLASH_SHOWN_KEY = 'nyayhub_splash_shown_session';

// Routes where splash should NOT show (documentation/dossier pages)
const SKIP_SPLASH_ROUTES = ['/dossier', '/technical-dossier', '/docs', '/install'];

/**
 * Branded Splash Screen
 * 
 * Shows the Nyay-Hub logo during initial app load.
 * Only shows once per session to avoid annoyance.
 * Does not show on documentation/dossier pages.
 */
export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Skip splash on documentation/dossier routes
    const currentPath = window.location.pathname;
    if (SKIP_SPLASH_ROUTES.some(route => currentPath.startsWith(route))) {
      return;
    }

    // Only show splash once per session
    const hasShown = sessionStorage.getItem(SPLASH_SHOWN_KEY);
    if (hasShown) {
      return;
    }

    // Show splash
    setIsVisible(true);
    sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');

    // Start fade out after 1.5 seconds
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1500);

    // Remove from DOM after fade completes
    const removeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500',
        isFadingOut && 'opacity-0 pointer-events-none'
      )}
    >
      {/* Logo with pulse animation */}
      <div className="relative">
        <img
          src={logoImage}
          alt="Nyay-Hub"
          className="h-24 w-24 animate-pulse"
        />
        {/* Glow effect */}
        <div className="absolute inset-0 h-24 w-24 bg-primary/20 blur-xl rounded-full -z-10" />
      </div>

      {/* Brand name */}
      <h1 className="font-display text-3xl font-bold text-foreground mt-6 tracking-wide">
        Nyay-Hub
      </h1>
      
      {/* Tagline */}
      <p className="text-muted-foreground text-sm mt-2">
        Litigation Operating System
      </p>

      {/* Loading indicator */}
      <div className="mt-8 flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>

      {/* Court name */}
      <p className="absolute bottom-8 text-xs text-muted-foreground/60">
        Rajasthan High Court
      </p>
    </div>
  );
}
