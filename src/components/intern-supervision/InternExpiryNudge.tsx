/**
 * INTERN INTEGRATION PHASE 2B: Intern Expiry Nudge
 * 
 * Banner shown when intern expires in ≤7 days.
 * Supervisor-only. Actions: Extend or Let expire.
 * 
 * SCOPE CONSTRAINTS:
 * - Supervisor-only visibility
 * - No automatic actions
 * - Feature-flagged
 * - Fully removable
 * 
 * SECURITY REVIEW: 2026-01-14
 */

import { useState } from 'react';
import { Clock, CalendarPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  usePhase2BEnabled,
  useInternActivityDigest,
  useExtendInternExpiry,
  type InternActivityDigest
} from '@/hooks/useInternSupervision';
import { format, addDays, addMonths } from 'date-fns';

/**
 * Banner showing interns expiring soon
 */
export function InternExpiryNudge() {
  const { data: isEnabled } = usePhase2BEnabled();
  const { data: digest = [] } = useInternActivityDigest();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  
  if (!isEnabled) {
    return null;
  }
  
  const expiringInterns = digest.filter(d => 
    d.days_until_expiry !== null && 
    d.days_until_expiry >= 0 && 
    d.days_until_expiry <= 7 &&
    !dismissed.has(d.intern_account_id)
  );
  
  if (expiringInterns.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-2">
      {expiringInterns.map(intern => (
        <ExpiryBanner 
          key={intern.intern_account_id} 
          intern={intern}
          onDismiss={() => {
            setDismissed(prev => new Set([...prev, intern.intern_account_id]));
          }}
        />
      ))}
    </div>
  );
}

/**
 * Individual expiry banner for one intern
 */
function ExpiryBanner({ 
  intern, 
  onDismiss 
}: { 
  intern: InternActivityDigest;
  onDismiss: () => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const extendExpiry = useExtendInternExpiry();
  
  const expiresAt = new Date(intern.expires_at);
  const daysLeft = intern.days_until_expiry ?? 0;
  
  const handleExtend = (date: Date | undefined) => {
    if (!date) return;
    extendExpiry.mutate({ 
      internAccountId: intern.intern_account_id, 
      newExpiryDate: date 
    });
    setCalendarOpen(false);
  };
  
  const quickExtendOptions = [
    { label: '+2 weeks', date: addDays(expiresAt, 14) },
    { label: '+1 month', date: addMonths(expiresAt, 1) },
    { label: '+3 months', date: addMonths(expiresAt, 3) },
  ];
  
  return (
    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
      <Clock className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-sm">
          <strong>{intern.intern_name}</strong>
          {daysLeft === 0 
            ? ' expires today' 
            : daysLeft === 1 
              ? ' expires tomorrow'
              : ` expires in ${daysLeft} days`
          }
          <span className="text-muted-foreground ml-1">
            ({format(expiresAt, 'dd MMM yyyy')})
          </span>
        </span>
        
        <div className="flex items-center gap-2">
          {/* Quick extend buttons */}
          {quickExtendOptions.map(opt => (
            <Button
              key={opt.label}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleExtend(opt.date)}
              disabled={extendExpiry.isPending}
            >
              {opt.label}
            </Button>
          ))}
          
          {/* Custom date picker */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7">
                <CalendarPlus className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={expiresAt}
                onSelect={handleExtend}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          {/* Dismiss (let expire) */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
