import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import HiddenAdminPortal from '@/components/admin/HiddenAdminPortal';
import logoImage from '@/assets/logo.png';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, isAuthenticated, profile, loading } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'SENIOR' | 'JUNIOR' | 'CLERK'>('JUNIOR');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Hidden admin portal state
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = () => {
    logoClickCount.current += 1;
    
    // Reset timer on each click
    if (logoClickTimer.current) {
      clearTimeout(logoClickTimer.current);
    }
    
    // Reset count after 3 seconds of no clicks
    logoClickTimer.current = setTimeout(() => {
      logoClickCount.current = 0;
    }, 3000);
    
    // Open admin portal after 7 clicks
    if (logoClickCount.current >= 7) {
      logoClickCount.current = 0;
      setShowAdminPortal(true);
    }
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !loading && profile) {
      // Check if onboarding is completed
      if (profile.onboarding_completed) {
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    }
  }, [isAuthenticated, loading, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // P0 FIX: Block auth when offline - network-aware error handling
    if (!navigator.onLine) {
      toast.error('Connection required to sign in', {
        description: 'Check your network connection and try again.',
        duration: 4000,
      });
      return;
    }
    
    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          // P0 FIX: Network-aware error mapping
          const errorMsg = error.message.toLowerCase();
          if (errorMsg.includes('invalid login credentials')) {
            setError('Invalid email or password');
          } else if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('timeout')) {
            setError('Network issue detected. Please retry when connected.');
          } else {
            setError(error.message);
          }
        } else {
          toast.success('Welcome back!');
          // Navigation handled by useEffect
        }
      } else {
        if (!fullName.trim()) {
          setError('Please enter your full name');
          setSubmitting(false);
          return;
        }
        
        const { error } = await signUp(email, password, fullName, role);
        if (error) {
          // P0 FIX: Network-aware error mapping
          const errorMsg = error.message.toLowerCase();
          if (errorMsg.includes('already registered')) {
            setError('This email is already registered. Please sign in.');
          } else if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('timeout')) {
            setError('Network issue detected. Please retry when connected.');
          } else {
            setError(error.message);
          }
        } else {
          toast.success('Account created! Let\'s set up your profile.');
          navigate('/onboarding');
        }
      }
    } catch (err) {
      // P0 FIX: Catch network failures at the catch level too
      setError('Unable to connect. Check your network and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <img src={logoImage} alt="Nyay-Hub" className="h-12 w-12 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src={logoImage} 
              alt="Nyay-Hub" 
              className="h-12 w-12 cursor-pointer hover:scale-110 transition-transform select-none" 
              onClick={handleLogoClick}
            />
          </div>
          <CardTitle className="font-display text-2xl">
            {isLogin ? 'Welcome Back' : 'Join Nyay-Hub'}
          </CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Sign in to access your dashboard' 
              : 'Create an account to get started'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Adv. Rakesh Sharma"
                    className="pl-10"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="advocate@example.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  minLength={6}
                  required
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-3">
                <Label>Select Your Role</Label>
                <p className="text-xs text-muted-foreground">
                  This determines your default view. Role cannot be changed after signup.
                </p>
                <RadioGroup
                  value={role}
                  onValueChange={(value) => setRole(value as 'SENIOR' | 'JUNIOR' | 'CLERK')}
                  className="grid grid-cols-3 gap-3"
                >
                  <div className="relative">
                    <RadioGroupItem
                      value="SENIOR"
                      id="senior"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="senior"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-border bg-card p-3 cursor-pointer hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    >
                      <span className="font-semibold text-foreground text-sm">Senior</span>
                      <span className="text-[10px] text-muted-foreground mt-1 text-center">War Room</span>
                    </Label>
                  </div>
                  
                  <div className="relative">
                    <RadioGroupItem
                      value="JUNIOR"
                      id="junior"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="junior"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-border bg-card p-3 cursor-pointer hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    >
                      <span className="font-semibold text-foreground text-sm">Junior</span>
                      <span className="text-[10px] text-muted-foreground mt-1 text-center">Control Deck</span>
                    </Label>
                  </div>

                  <div className="relative">
                    <RadioGroupItem
                      value="CLERK"
                      id="clerk"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="clerk"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-border bg-card p-3 cursor-pointer hover:bg-accent peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    >
                      <span className="font-semibold text-foreground text-sm">Clerk</span>
                      <span className="text-[10px] text-muted-foreground mt-1 text-center">Read-only</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <Button
              type="submit"
              variant="gold"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden Admin Portal */}
      <HiddenAdminPortal 
        isOpen={showAdminPortal} 
        onClose={() => setShowAdminPortal(false)} 
      />
    </div>
  );
}
