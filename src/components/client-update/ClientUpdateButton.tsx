import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileEdit } from 'lucide-react';
import { ClientUpdateGenerator } from './ClientUpdateGenerator';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import type { PostCourtNote } from '@/hooks/usePostCourtCapture';

interface ClientUpdateButtonProps {
  postCourtNote: PostCourtNote | null;
  caseNumber: string;
}

/**
 * Button to open Client Update Generator dialog.
 * Only visible to SENIOR role.
 */
export function ClientUpdateButton({
  postCourtNote,
  caseNumber,
}: ClientUpdateButtonProps) {
  const { user } = useAuth();
  const { data: role, isLoading } = useUserRole(user?.id);
  const [open, setOpen] = useState(false);

  // Only show for SENIOR
  if (isLoading || role !== 'SENIOR') {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
        disabled={!postCourtNote}
        title={!postCourtNote ? 'Add a post-court note first' : 'Generate client update'}
      >
        <FileEdit className="h-4 w-4" />
        <span className="hidden sm:inline">Client Update</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wide">
              Generate Client Update
            </DialogTitle>
          </DialogHeader>
          <ClientUpdateGenerator
            postCourtNote={postCourtNote}
            caseNumber={caseNumber}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
