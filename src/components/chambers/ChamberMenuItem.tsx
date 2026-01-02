import { useState } from 'react';
import { Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ChamberManagementPanel } from './ChamberManagementPanel';

/**
 * Menu item for the User Menu dropdown that opens the chamber panel
 */
export function ChamberMenuItem() {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem 
          className="min-h-touch"
          onSelect={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          <Building2 className="mr-2 h-4 w-4" />
          My Chambers
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Chamber Management</DialogTitle>
        </DialogHeader>
        <ChamberManagementPanel />
      </DialogContent>
    </Dialog>
  );
}

export default ChamberMenuItem;
