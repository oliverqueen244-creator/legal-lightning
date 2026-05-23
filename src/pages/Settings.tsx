/**
 * USER SETTINGS PAGE
 * 
 * Dedicated settings page for profile and alias management.
 * Separate from onboarding which only runs once on signup.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scale, User, Fingerprint, ArrowLeft, Save, Loader2, Shield } from 'lucide-react';
import ProfileStep from '@/components/onboarding/ProfileStep';
import AliasManager from '@/components/onboarding/AliasManager';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { toast } from 'sonner';

export default function Settings() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    bar_registration_number: '',
    bar_council_state: '',
    bench: '' as 'JAIPUR' | 'JODHPUR' | 'BOTH' | '',
  });

  // Default to aliases tab if coming from alias link
  const defaultTab = searchParams.get('tab') === 'aliases' ? 'aliases' : 'profile';

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        bar_registration_number: profile.bar_registration_number || '',
        bar_council_state: profile.bar_council_state || '',
        bench: (profile.bench as 'JAIPUR' | 'JODHPUR' | 'BOTH' | '') || '',
      });
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    setSaving(true);
    
    // For database, we store 'JAIPUR' or 'JODHPUR' - if BOTH, we'll use JAIPUR as primary
    const benchForDb = profileData.bench === 'BOTH' ? 'JAIPUR' : profileData.bench;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profileData.full_name,
        bar_registration_number: profileData.bar_registration_number,
        bench: benchForDb || null,
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      toast.error('Failed to update profile');
      return;
    }
    
    toast.success('Profile updated');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Scale className="w-12 h-12 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl py-8 px-4">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your profile and preferences</p>
            </div>
          </div>

          {/* Settings Tabs */}
          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="aliases" className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4" />
                Name Aliases
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Privacy & Data
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal details and practice information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ProfileStep
                    data={profileData}
                    onChange={setProfileData}
                  />
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSaveProfile} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aliases Tab */}
            <TabsContent value="aliases">
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-primary" />
                    Name Aliases
                  </CardTitle>
                  <CardDescription>
                    Manage name variations for case matching in court records
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AliasManager defaultName={profileData.full_name || profile?.full_name || ''} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Tab */}
            <TabsContent value="privacy">
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Privacy &amp; Data Rights
                  </CardTitle>
                  <CardDescription>
                    Your rights under India's Digital Personal Data Protection Act, 2023.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PrivacySettings />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  );
}
