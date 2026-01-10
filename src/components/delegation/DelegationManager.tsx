/**
 * CP-5: Delegation Manager Component
 * 
 * Allows lawyers to create, view, and revoke delegations to clerks.
 * Enforces scope-based permissions.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { UserPlus, UserMinus, Eye, Upload, FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useDelegation, DelegationScope, FORBIDDEN_SCOPES, type Delegation } from '@/hooks/useDelegation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Scope definitions with icons and descriptions
const SCOPE_CONFIG: Record<DelegationScope, { label: string; icon: React.ReactNode; description: string }> = {
  view_cases: {
    label: 'View Cases',
    icon: <Eye className="h-4 w-4" />,
    description: 'Can see your case list and details',
  },
  upload_documents: {
    label: 'Upload Documents',
    icon: <Upload className="h-4 w-4" />,
    description: 'Can upload case documents on your behalf',
  },
  add_notes: {
    label: 'Add Notes',
    icon: <FileText className="h-4 w-4" />,
    description: 'Can add notes and annotations',
  },
  track_hearings: {
    label: 'Track Hearings',
    icon: <Clock className="h-4 w-4" />,
    description: 'Can track hearing progress and status',
  },
  mark_presence: {
    label: 'Mark Presence',
    icon: <CheckCircle className="h-4 w-4" />,
    description: 'Can mark presence/attendance for hearings',
  },
};

export function DelegationManager() {
  const { 
    delegations, 
    isLawyer, 
    createDelegation, 
    revokeDelegation,
    updateScopes,
  } = useDelegation();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newClerkEmail, setNewClerkEmail] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<DelegationScope[]>(['view_cases']);

  // Fetch available clerks (profiles with CLERK role)
  const { data: availableClerks = [] } = useQuery({
    queryKey: ['available-clerks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'CLERK');
      
      if (error) {
        console.error('[DelegationManager] Failed to fetch clerks:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: isLawyer,
  });

  if (!isLawyer) {
    return null;
  }

  const handleCreateDelegation = async () => {
    // Find clerk by email/name (simplified - in production would use email lookup)
    const clerk = availableClerks.find(c => 
      c.full_name?.toLowerCase().includes(newClerkEmail.toLowerCase())
    );
    
    if (!clerk) {
      return;
    }

    await createDelegation.mutateAsync({
      clerkId: clerk.id,
      scopes: selectedScopes,
    });

    setIsCreateDialogOpen(false);
    setNewClerkEmail('');
    setSelectedScopes(['view_cases']);
  };

  const handleRevoke = async (delegationId: string) => {
    await revokeDelegation.mutateAsync(delegationId);
  };

  const toggleScope = (scope: DelegationScope) => {
    setSelectedScopes(prev => 
      prev.includes(scope) 
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Clerk Delegations
            </CardTitle>
            <CardDescription>
              Manage who can assist with your cases
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Clerk
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Delegation</DialogTitle>
                <DialogDescription>
                  Grant a clerk permission to assist with your cases. They will never own cases or have full control.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="clerk-name">Clerk Name</Label>
                  <Input
                    id="clerk-name"
                    placeholder="Search by name..."
                    value={newClerkEmail}
                    onChange={(e) => setNewClerkEmail(e.target.value)}
                  />
                  {newClerkEmail && availableClerks.length > 0 && (
                    <div className="border rounded-md divide-y max-h-32 overflow-auto">
                      {availableClerks
                        .filter(c => c.full_name?.toLowerCase().includes(newClerkEmail.toLowerCase()))
                        .map(clerk => (
                          <button
                            key={clerk.id}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => setNewClerkEmail(clerk.full_name || '')}
                          >
                            {clerk.full_name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="space-y-2">
                    {(Object.entries(SCOPE_CONFIG) as [DelegationScope, typeof SCOPE_CONFIG[DelegationScope]][]).map(([scope, config]) => (
                      <label
                        key={scope}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                          selectedScopes.includes(scope) 
                            ? "bg-primary/5 border-primary/30" 
                            : "hover:bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={selectedScopes.includes(scope)}
                          onCheckedChange={() => toggleScope(scope)}
                          disabled={scope === 'view_cases'} // view_cases is always required
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 font-medium">
                            {config.icon}
                            {config.label}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {config.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Forbidden scopes warning */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-destructive">Restricted Actions</p>
                    <p className="text-destructive/80 mt-0.5">
                      Clerks can never: claim ownership, confirm matches, force active, or change case assignments.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateDelegation}
                  disabled={!newClerkEmail || selectedScopes.length === 0 || createDelegation.isPending}
                >
                  {createDelegation.isPending ? 'Creating...' : 'Create Delegation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {delegations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No active delegations</p>
            <p className="text-sm">Add a clerk to help manage your cases</p>
          </div>
        ) : (
          <div className="space-y-3">
            {delegations.map((delegation) => (
              <DelegationCard
                key={delegation.id}
                delegation={delegation}
                onRevoke={() => handleRevoke(delegation.id)}
                isRevoking={revokeDelegation.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DelegationCardProps {
  delegation: Delegation;
  onRevoke: () => void;
  isRevoking: boolean;
}

function DelegationCard({ delegation, onRevoke, isRevoking }: DelegationCardProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{delegation.lawyer_name}</span>
          {delegation.chamber_name && (
            <Badge variant="outline" className="text-xs">
              {delegation.chamber_name}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {delegation.scopes.map((scope) => (
            <Badge key={scope} variant="secondary" className="text-xs">
              {SCOPE_CONFIG[scope]?.label || scope}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Delegated {format(new Date(delegation.delegated_at), 'MMM d, yyyy')}
        </p>
      </div>
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
            <UserMinus className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Delegation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately remove all access for this clerk. They will no longer be able to view or assist with your cases.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRevoke}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? 'Revoking...' : 'Revoke Access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
