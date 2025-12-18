import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Scale } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export function AuthGuard({ children, requireOnboarding = true }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, profile, loading } = useAuth();

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Scale className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
