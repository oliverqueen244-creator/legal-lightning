/**
 * Case Assignment Dialog
 * Allows supervisors to assign their cases to interns
 */

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDocket } from '@/hooks/useDocket';
import { useAssignCaseToIntern, useInternAssignments } from '@/hooks/useInternSupervision';
import { format } from 'date-fns';
import type { DocketItem } from '@/types/database';

interface CaseAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  internAccountId: string;
  internName: string;
}

export function CaseAssignmentDialog({ 
  open, 
  onOpenChange, 
  internAccountId, 
  internName 
}: CaseAssignmentDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const { data: docket = [], isLoading } = useDocket(selectedDate);
  const { data: assignments = [] } = useInternAssignments(internAccountId);
  const assignCase = useAssignCaseToIntern();
  
  // Get already assigned docket IDs to filter them out
  const assignedDocketIds = new Set(assignments.map(a => a.docket_id));
  
  // Filter cases based on search and exclude already assigned
  const availableCases = docket.filter((item: DocketItem) => {
    if (assignedDocketIds.has(item.id)) return false;
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      item.case_number.toLowerCase().includes(searchLower) ||
      item.petitioner?.toLowerCase().includes(searchLower) ||
      item.respondent?.toLowerCase().includes(searchLower)
    );
  });

  const handleAssign = (docketId: string) => {
    assignCase.mutate(
      { internAccountId, docketId },
      {
        onSuccess: () => {
          // Keep dialog open for multiple assignments
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Case to {internName}</DialogTitle>
          <DialogDescription>
            Select cases from your docket to assign
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date selector */}
          <div className="flex gap-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Case list */}
          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading cases...
              </div>
            ) : availableCases.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {docket.length === 0 
                  ? 'No cases found for this date' 
                  : search 
                    ? 'No matching cases' 
                    : 'All cases already assigned'}
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {availableCases.map((item: DocketItem) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm truncate">
                          {item.case_number}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          #{item.item_no}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {item.petitioner || 'Unknown'} v. {item.respondent || 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Court {item.court_room_no} • {item.list_type}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAssign(item.id)}
                      disabled={assignCase.isPending}
                      className="shrink-0 ml-2"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Summary */}
          <p className="text-xs text-muted-foreground text-center">
            {assignments.length} case{assignments.length !== 1 ? 's' : ''} currently assigned
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
