import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Scale, User, Search, CheckCircle2, ArrowRight, ArrowLeft, Users, ShieldCheck } from 'lucide-react';
import ProfileStep from '@/components/onboarding/ProfileStep';
import AliasManager from '@/components/onboarding/AliasManager';
import CourtScan from '@/components/onboarding/CourtScan';
import { ChamberOnboardingStep } from '@/components/onboarding/ChamberOnboardingStep';
import { ConsentStep } from '@/components/onboarding/ConsentStep';
import { CONSENT_VERSION, type ConsentSelections } from '@/components/onboarding/consentTypes';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, title: 'Consent & Privacy', icon: ShieldCheck },
  { id: 2, title: 'Profile Setup', icon: User },
  { id: 3, title: 'Name Variations', icon: Scale },
  { id: 4, title: 'Chamber', icon: Users },
  { id: 5, title: 'Court Sync', icon: Search },
];

export default function Onboarding() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [consent, setConsent] = useState<ConsentSelections>({
    privacyPolicy: false,
    thirdPartyAi: false,
    telegramAlerts: false,
  });
  const [profileData, setProfileData] = useState({
    full_name: '',
    bar_registration_number: '',
    bar_council_state: '',
    bench: '' as 'JAIPUR' | 'JODHPUR' | 'BOTH' | '',
  });

  const recordConsent = async () => {
    if (!user?.id) return false;
    const rows = [
      { user_id: user.id, consent_type: 'PRIVACY_POLICY', consent_version: CONSENT_VERSION, granted: consent.privacyPolicy },
      { user_id: user.id, consent_type: 'THIRD_PARTY_AI', consent_version: CONSENT_VERSION, granted: consent.thirdPartyAi },
      { user_id: user.id, consent_type: 'TELEGRAM_ALERTS', consent_version: CONSENT_VERSION, granted: consent.telegramAlerts },
    ];
    // user_consents is new; types.ts will pick it up after `supabase gen types`.
    const from = supabase.from as unknown as (table: string) => {
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await from('user_consents').insert(rows);
    if (error) {
      toast.error('Could not record consent');
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        bar_registration_number: profile.bar_registration_number || '',
        bar_council_state: (profile as { bar_council_state?: string }).bar_council_state || '',
        bench: (profile.bench as 'JAIPUR' | 'JODHPUR' | 'BOTH' | '') || '',
      });
    }
  }, [profile]);

  const progress = (currentStep / STEPS.length) * 100;

  const handleProfileUpdate = async () => {
    if (!user?.id) return;

    // For database, we store 'JAIPUR' or 'JODHPUR' - if BOTH, we'll use JAIPUR as primary
    const benchForDb = profileData.bench === 'BOTH' ? 'JAIPUR' : profileData.bench;

    const hasBciData = profileData.bar_registration_number && profileData.bar_council_state;
    const update: Record<string, unknown> = {
      full_name: profileData.full_name,
      bar_registration_number: profileData.bar_registration_number,
      bench: benchForDb || null,
    };
    if (hasBciData) {
      // Lawyer supplied BCI details -> mark as submitted, awaiting admin verification.
      update.bar_council_state = profileData.bar_council_state;
      update.bci_verification_status = 'submitted';
    }
    const { error } = await supabase.from('profiles').update(update).eq('id', user.id);

    if (error) {
      toast.error('Failed to update profile');
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!consent.privacyPolicy || !consent.thirdPartyAi) {
        toast.error('Privacy policy and AI processing consent are required.');
        return;
      }
      const ok = await recordConsent();
      if (!ok) return;
    }

    if (currentStep === 2) {
      if (!profileData.full_name || !profileData.bench) {
        toast.error('Please fill in all required fields');
        return;
      }
      const success = await handleProfileUpdate();
      if (!success) return;
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!user?.id) return;

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to complete onboarding');
      return;
    }

    toast.success('Welcome to Nyay-Hub!');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Scale className="w-12 h-12 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Scale className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-display font-bold text-primary">Nyay-Hub</h1>
          </div>
          <p className="text-muted-foreground">Complete your profile to get started</p>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex justify-between">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 text-sm ${
                  step.id === currentStep
                    ? 'text-primary font-semibold'
                    : step.id < currentStep
                    ? 'text-primary/60'
                    : 'text-muted-foreground'
                }`}
              >
                {step.id < currentStep ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {STEPS[currentStep - 1].icon && (
                <span className="text-primary">
                  {(() => {
                    const StepIcon = STEPS[currentStep - 1].icon;
                    return <StepIcon className="w-5 h-5" />;
                  })()}
                </span>
              )}
              {STEPS[currentStep - 1].title}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && 'Review and accept the privacy policy before we set up your account'}
              {currentStep === 2 && 'Tell us about yourself and your practice'}
              {currentStep === 3 && 'Add the name variations used in court records'}
              {currentStep === 4 && 'Set up or join a chamber for coordination'}
              {currentStep === 5 && 'Find your cases in the High Court records'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && (
              <ConsentStep value={consent} onChange={setConsent} />
            )}
            {currentStep === 2 && (
              <ProfileStep
                data={profileData}
                onChange={setProfileData}
              />
            )}
            {currentStep === 3 && (
              <AliasManager defaultName={profileData.full_name} />
            )}
            {currentStep === 4 && (
              <ChamberOnboardingStep
                role={profile?.role || null}
                onComplete={handleNext}
              />
            )}
            {currentStep === 5 && (
              <CourtScan bench={profileData.bench as 'JAIPUR' | 'JODHPUR' | 'BOTH'} />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleComplete} className="bg-primary text-primary-foreground">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Complete Setup
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
