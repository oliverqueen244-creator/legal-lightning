import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus, LogIn } from 'lucide-react';
import { useCreateChamber, useJoinChamber, useOwnedChambers, useMemberChambers } from '@/hooks/useChambers';
import { toast } from 'sonner';

interface ChamberOnboardingStepProps {
  role: 'SENIOR' | 'JUNIOR' | 'CLERK' | string | null;
  onComplete: () => void;
}

export function ChamberOnboardingStep({ role, onComplete }: ChamberOnboardingStepProps) {
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [chamberName, setChamberName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  
  const { data: ownedChambers } = useOwnedChambers();
  const { data: memberChambers } = useMemberChambers();
  const createChamber = useCreateChamber();
  const joinChamber = useJoinChamber();
  
  const isSenior = role === 'SENIOR';
  const hasExistingChambers = (ownedChambers?.length || 0) + (memberChambers?.length || 0) > 0;

  const handleCreateChamber = async () => {
    if (!chamberName.trim()) {
      toast.error('Please enter a chamber name');
      return;
    }
    
    try {
      await createChamber.mutateAsync(chamberName.trim());
      toast.success('Chamber created successfully');
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create chamber');
    }
  };

  const handleJoinChamber = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }
    
    try {
      await joinChamber.mutateAsync(inviteCode.trim());
      toast.success('Joined chamber successfully');
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Failed to join chamber');
    }
  };

  if (hasExistingChambers) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          You're already a member of {(ownedChambers?.length || 0) + (memberChambers?.length || 0)} chamber(s).
        </p>
        <Button onClick={onComplete} className="w-full">
          Continue
        </Button>
      </div>
    );
  }

  if (mode === 'choice') {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          A chamber is a group of lawyers who work together. It helps coordinate work but does not share any case data automatically.
        </p>
        
        <div className="grid gap-3">
          {isSenior && (
            <Card 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setMode('create')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create a Chamber
                </CardTitle>
                <CardDescription className="text-sm">
                  Start your own chamber and invite juniors/clerks
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          
          <Card 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => setMode('join')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Join a Chamber
              </CardTitle>
              <CardDescription className="text-sm">
                Enter an invite code from a senior
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Button 
            variant="ghost" 
            onClick={onComplete}
            className="mt-2"
          >
            Skip for now (Solo practice)
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setMode('choice')}
          className="mb-2"
        >
          ← Back
        </Button>
        
        <div className="space-y-2">
          <Label htmlFor="chamber-name">Chamber Name</Label>
          <Input
            id="chamber-name"
            placeholder="e.g., Shah & Associates"
            value={chamberName}
            onChange={(e) => setChamberName(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={handleCreateChamber}
            disabled={createChamber.isPending}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-2" />
            Create Chamber
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setMode('choice')}
          className="mb-2"
        >
          ← Back
        </Button>
        
        <div className="space-y-2">
          <Label htmlFor="invite-code">Invite Code</Label>
          <Input
            id="invite-code"
            placeholder="Enter invite code from senior"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={handleJoinChamber}
            disabled={joinChamber.isPending}
            className="flex-1"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Join Chamber
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
