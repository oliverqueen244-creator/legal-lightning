import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Scale, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthGuardProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

// HARDENING: Maximum time to wait for auth before showing fallback
const AUTH_TIMEOUT_MS = 10000;

export function AuthGuard({ children, requireOnboarding = true }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, profile, loading } = useAuth();
  const [authTimedOut, setAuthTimedOut] = useState(false);

  // HARDENING: Timeout fallback - never show blank screen indefinitely
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.error('[AuthGuard] Auth loading timed out after 10s');
        setAuthTimedOut(true);
      }
    }, AUTH_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth');
      return;
    }

    // Check onboarding completion (skip if on onboarding page)
    if (requireOnboarding && !loading && isAuthenticated && profile) {
      const onboardingCompleted = profile.onboarding_completed;
      const isOnboardingPage = location.pathname === '/onboarding';
      
      if (!onboardingCompleted && !isOnboardingPage) {
        navigate('/onboarding');
      }
    }
  }, [isAuthenticated, loading, profile, navigate, requireOnboarding, location.pathname]);

  // HARDENING: Auth timeout - show recovery UI instead of blank screen
  if (authTimedOut) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Connection Issue</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Unable to verify your session. Please try again.
        </p>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
          >
            Refresh Page
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

  // Normal loading state - ALWAYS show loading UI, never null
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Scale className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  // Not authenticated - redirect handled by useEffect, show loading in meantime
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Scale className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  return <>{children}</>;
}
