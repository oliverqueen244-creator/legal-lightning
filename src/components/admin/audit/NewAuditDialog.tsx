import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateAuditRun, AuditScope } from '@/hooks/useAudit';

interface NewAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  onSuccess: (id: string) => void;
}

export function NewAuditDialog({ open, onOpenChange, userId, onSuccess }: NewAuditDialogProps) {
  const createAuditRun = useCreateAuditRun();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<AuditScope>('feature');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim()) return;

    try {
      const result = await createAuditRun.mutateAsync({
        audit_name: name.trim(),
        audit_scope: scope,
        conducted_by: userId,
      });
      setName('');
      setScope('feature');
      onSuccess(result.id);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Audit Run</DialogTitle>
          <DialogDescription>
            Create a new audit to evaluate product quality and release readiness.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="audit-name">Audit Name</Label>
            <Input
              id="audit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., v1.2 Release Audit, War Room Feature Review"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audit-scope">Audit Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as AuditScope)}>
              <SelectTrigger id="audit-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feature">Feature Audit</SelectItem>
                <SelectItem value="release">Release Audit</SelectItem>
                <SelectItem value="full-system">Full System Audit</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {scope === 'feature' && 'Evaluate a specific feature or component'}
              {scope === 'release' && 'Pre-release quality gate assessment'}
              {scope === 'full-system' && 'Comprehensive system-wide audit'}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createAuditRun.isPending}>
              {createAuditRun.isPending ? 'Creating...' : 'Start Audit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
