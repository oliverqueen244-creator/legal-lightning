import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle, RefreshCw, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthGuardProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

// HARDENING: Maximum time to wait for auth before showing fallback
// Increased to 15s and made more resilient
const AUTH_TIMEOUT_MS = 15000;

/**
 * AuthGuard - PHASE 0.2 OPTIMIZED
 * 
 * Now renders a skeleton dashboard shell immediately while auth resolves.
 * This allows meaningful first paint without blocking on auth/profile/role.
 * 
 * Auth still gates: writes, admin panels, and route redirects.
 */
export function AuthGuard({ children, requireOnboarding = true }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, profile, loading } = useAuth();
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountTimeRef = useRef(Date.now());

  // Clear timeout when loading completes
  useEffect(() => {
    if (!loading && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      // Reset timeout state if auth resolved
      if (authTimedOut) {
        setAuthTimedOut(false);
      }
    }
  }, [loading, authTimedOut]);

  // HARDENING: Timeout fallback - never show blank screen indefinitely
  useEffect(() => {
    // Only set timeout if we're still loading and haven't timed out
    if (loading && !authTimedOut) {
      timeoutRef.current = setTimeout(() => {
        if (loading) {
          const elapsed = Date.now() - mountTimeRef.current;
          console.error(`[AuthGuard] Auth loading timed out after ${elapsed}ms`);
          setAuthTimedOut(true);
        }
      }, AUTH_TIMEOUT_MS);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loading, authTimedOut]);

  // Handle redirects for unauthenticated users
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setRedirecting(true);
      navigate('/auth');
      return;
    }

    // Check onboarding completion (skip if on onboarding page)
    if (requireOnboarding && !loading && isAuthenticated && profile) {
      const onboardingCompleted = profile.onboarding_completed;
      const isOnboardingPage = location.pathname === '/onboarding';
      
      if (!onboardingCompleted && !isOnboardingPage) {
        setRedirecting(true);
        navigate('/onboarding');
      }
    }
  }, [isAuthenticated, loading, profile, navigate, requireOnboarding, location.pathname]);

  // Retry handler - soft retry without full page reload
  const handleRetry = useCallback(async () => {
    setRetrying(true);
    // Reset states and give auth another chance
    setAuthTimedOut(false);
    mountTimeRef.current = Date.now();
    
    // Wait a moment then reload to reset auth state
    await new Promise(resolve => setTimeout(resolve, 500));
    window.location.reload();
  }, []);

  // HARDENING: Auth timeout - show recovery UI instead of blank screen
  if (authTimedOut && !retrying) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Taking Longer Than Usual</h2>
        <p className="text-sm text-muted-foreground text-center mb-4 max-w-xs">
          Session verification is slow. This could be a temporary network issue.
        </p>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleRetry}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button 
            onClick={() => navigate('/auth')}
          >
            Sign In Again
          </Button>
        </div>
      </div>
    );
  }

  // Show loading spinner while retrying
  if (retrying) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Reconnecting...</p>
      </div>
    );
  }

  // PHASE 0.2: Show skeleton dashboard while auth loads
  // This allows first meaningful paint without blocking
  if (loading && !redirecting) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header skeleton */}
        <div className="border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </div>
        
        {/* Dashboard content skeleton */}
        <main className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - tabs and cards */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-8 w-24" />
              </div>
              
              {/* Tab skeleton */}
              <Skeleton className="h-12 w-full rounded-lg" />
              
              {/* Card skeletons */}
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            </div>
            
            {/* Right column - widgets */}
            <div className="lg:col-span-1 space-y-6">
              <Skeleton className="h-80 w-full rounded-lg" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          </div>
        </main>
        
        {/* Subtle loading indicator */}
        <div className="fixed bottom-4 right-4 flex items-center gap-2 text-muted-foreground text-sm">
          <Scale className="h-4 w-4 animate-pulse" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Redirecting state - show minimal loader
  if (redirecting || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Scale className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  return <>{children}</>;
}
