import { useState } from 'react';
import { Building2, Plus, Users, Copy, Check, LogOut, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useOwnedChambers,
  useMemberChambers,
  useChamberMembers,
  useChamberInvites,
  useCreateChamber,
  useDeleteChamber,
  useCreateInvite,
  useRevokeInvite,
  useJoinChamber,
  useLeaveChamber,
  useRevokeMember,
  type ChamberRole,
  type Chamber,
} from '@/hooks/useChambers';
import { useAuth } from '@/hooks/useAuth';

/**
 * Chamber Management Panel
 * 
 * Minimal, non-intrusive UI for chamber coordination.
 * NO chamber dashboard. NO case lists. Just member management.
 */
export function ChamberManagementPanel() {
  const { role } = useAuth();
  const { data: ownedChambers = [], isLoading: ownedLoading } = useOwnedChambers();
  const { data: memberChambers = [], isLoading: memberLoading } = useMemberChambers();
  
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [selectedChamber, setSelectedChamber] = useState<Chamber | null>(null);
  
  const isSenior = role === 'SENIOR' || role === 'ADMIN';
  const isLoading = ownedLoading || memberLoading;
  
  const hasChambers = ownedChambers.length > 0 || memberChambers.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            My Chambers
          </h2>
          <p className="text-sm text-muted-foreground">
            Coordinate with your practice team
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Join Chamber - Available to all */}
          <JoinChamberDialog open={joinOpen} onOpenChange={setJoinOpen} />
          
          {/* Create Chamber - SENIOR only */}
          {isSenior && (
            <CreateChamberDialog open={createOpen} onOpenChange={setCreateOpen} />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading chambers...</div>
      ) : !hasChambers ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {isSenior 
                ? "You haven't created any chambers yet" 
                : "You're not a member of any chambers"
              }
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setJoinOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Join with Code
              </Button>
              {isSenior && (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Chamber
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Owned Chambers */}
          {ownedChambers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Chambers You Own
              </h3>
              {ownedChambers.map((chamber) => (
                <OwnedChamberCard 
                  key={chamber.id} 
                  chamber={chamber}
                  onManage={() => setSelectedChamber(chamber)}
                />
              ))}
            </div>
          )}

          {/* Member Chambers */}
          {memberChambers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Chambers You're In
              </h3>
              {memberChambers.map((membership) => (
                <MemberChamberCard 
                  key={membership.id} 
                  membership={membership}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chamber Detail Dialog */}
      {selectedChamber && (
        <ChamberDetailDialog 
          chamber={selectedChamber} 
          open={!!selectedChamber}
          onOpenChange={(open) => !open && setSelectedChamber(null)}
        />
      )}
    </div>
  );
}

/**
 * Card for chambers the user owns
 */
function OwnedChamberCard({ 
  chamber, 
  onManage 
}: { 
  chamber: Chamber; 
  onManage: () => void;
}) {
  const { data: members = [] } = useChamberMembers(chamber.id);
  const deleteChamber = useDeleteChamber();
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{chamber.name}</CardTitle>
            <Badge variant="gold" className="text-xs">Owner</Badge>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onManage}>
              <Users className="h-4 w-4 mr-1" />
              Manage
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Chamber?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all members and invites. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteChamber.mutate(chamber.id)}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <CardDescription>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

/**
 * Card for chambers the user is a member of
 */
function MemberChamberCard({ 
  membership 
}: { 
  membership: { 
    id: string; 
    chamber_id: string; 
    role_in_chamber: ChamberRole;
    chamber?: Chamber;
  };
}) {
  const leaveChamber = useLeaveChamber();
  
  if (!membership.chamber) return null;
  
  const roleLabel = {
    senior: 'Senior',
    junior: 'Junior',
    clerk: 'Clerk'
  }[membership.role_in_chamber];
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{membership.chamber.name}</CardTitle>
            <Badge variant="secondary" className="text-xs">{roleLabel}</Badge>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <LogOut className="h-4 w-4 mr-1" />
                Leave
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave Chamber?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will need a new invite code to rejoin this chamber.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => leaveChamber.mutate(membership.chamber_id)}>
                  Leave
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
    </Card>
  );
}

/**
 * Dialog to create a new chamber
 */
function CreateChamberDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const createChamber = useCreateChamber();
  
  const handleCreate = async () => {
    if (!name.trim()) return;
    await createChamber.mutateAsync(name.trim());
    setName('');
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Chamber
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Chamber</DialogTitle>
          <DialogDescription>
            A chamber helps coordinate your practice team. It does not share cases or data automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="chamber-name">Chamber Name</Label>
            <Input
              id="chamber-name"
              placeholder="e.g., Shah & Associates"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createChamber.isPending}>
            {createChamber.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog to join a chamber with invite code
 */
function JoinChamberDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [code, setCode] = useState('');
  const joinChamber = useJoinChamber();
  
  const handleJoin = async () => {
    if (!code.trim()) return;
    await joinChamber.mutateAsync(code.trim());
    setCode('');
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Join Chamber
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Chamber</DialogTitle>
          <DialogDescription>
            Enter the invite code shared by the chamber owner.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              placeholder="e.g., a1b2c3d4"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleJoin} disabled={!code.trim() || joinChamber.isPending}>
            {joinChamber.isPending ? 'Joining...' : 'Join'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Chamber detail/management dialog (owner only)
 */
function ChamberDetailDialog({ 
  chamber, 
  open, 
  onOpenChange 
}: { 
  chamber: Chamber; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { data: members = [] } = useChamberMembers(chamber.id);
  const { data: invites = [] } = useChamberInvites(chamber.id);
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const revokeMember = useRevokeMember();
  
  const [newRole, setNewRole] = useState<ChamberRole>('junior');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  const handleCreateInvite = async () => {
    await createInvite.mutateAsync({
      chamberId: chamber.id,
      role: newRole
    });
  };
  
  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {chamber.name}
          </DialogTitle>
          <DialogDescription>
            Manage members and invites. Chamber membership does not grant case access.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Members */}
          <div>
            <h4 className="text-sm font-medium mb-3">Members ({members.length})</h4>
            <ScrollArea className="max-h-40">
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{member.lawyer?.full_name || 'Unknown'}</span>
                      <Badge variant="outline" className="text-xs">
                        {member.role_in_chamber}
                      </Badge>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => revokeMember.mutate({ 
                        membershipId: member.id, 
                        chamberId: chamber.id 
                      })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No members yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
          
          <Separator />
          
          {/* Create Invite */}
          <div>
            <h4 className="text-sm font-medium mb-3">Create Invite</h4>
            <div className="flex gap-2">
              <Select value={newRole} onValueChange={(v) => setNewRole(v as ChamberRole)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="clerk">Clerk</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleCreateInvite} 
                disabled={createInvite.isPending}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Generate Code
              </Button>
            </div>
          </div>
          
          {/* Active Invites */}
          {invites.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Active Invites</h4>
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                        {invite.invite_code}
                      </code>
                      <Badge variant="outline" className="text-xs">
                        {invite.role_in_chamber}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyInviteCode(invite.invite_code)}
                      >
                        {copiedCode === invite.invite_code ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => revokeInvite.mutate({ 
                          inviteId: invite.id, 
                          chamberId: chamber.id 
                        })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ChamberManagementPanel;
