/**
 * INTERN INTEGRATION PHASE 2B: Intern-Facing Expiry UX
 * 
 * Displays expiry warnings and blocks for interns:
 * - T-7 days: "Intern access expires in X days"
 * - T-0: "Access expired – contact supervisor"
 * 
 * After expiry:
 * - Cannot view any case
 * - Cannot open drafts
 * - Cannot submit anything
 * - Session remains valid but feature-blocked
 * 
 * NO SOFT GRACE PERIOD. Expiry is absolute.
 * 
 * INTERN FEATURE SET COMPLETE as of Phase 2B.
 * Any expansion requires new audit + design approval.
 * 
 * SECURITY REVIEW: 2026-01-14
 */

import { AlertTriangle, Clock, Lock, Phone } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useInternPermissions } from '@/hooks/useInternPermissions';
import { differenceInDays, format } from 'date-fns';

/**
 * Expiry warning banner for interns
 * Shows countdown at T-7 days, blocks at T-0
 */
export function InternExpiryBanner() {
  const { isIntern, isActiveIntern, expiresAt } = useInternPermissions();
  
  // Not an intern - don't show anything
  if (!isIntern) {
    return null;
  }
  
  // No expiry date - shouldn't happen, but guard
  if (!expiresAt) {
    return null;
  }
  
  const now = new Date();
  const daysRemaining = differenceInDays(expiresAt, now);
  
  // Already expired - show hard block
  if (daysRemaining < 0) {
    return <ExpiredBanner expiryDate={expiresAt} />;
  }
  
  // Expired today
  if (daysRemaining === 0) {
    return <ExpiringTodayBanner expiryDate={expiresAt} />;
  }
  
  // Within 7 days - show warning
  if (daysRemaining <= 7) {
    return <ExpiryWarningBanner daysRemaining={daysRemaining} expiryDate={expiresAt} />;
  }
  
  // More than 7 days - no banner needed
  return null;
}

/**
 * Hard block banner when access has expired
 */
function ExpiredBanner({ expiryDate }: { expiryDate: Date }) {
  return (
    <Alert variant="destructive" className="border-destructive bg-destructive/10">
      <Lock className="h-5 w-5" />
      <AlertTitle className="text-base font-semibold">
        Access Expired
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          Your intern access expired on <strong>{format(expiryDate, 'dd MMMM yyyy')}</strong>.
        </p>
        <p className="text-sm">
          You can no longer view cases, access documents, or submit drafts.
        </p>
        <div className="flex items-center gap-2 mt-3 text-sm">
          <Phone className="h-4 w-4" />
          <span>Contact your supervisor to restore access.</span>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Warning banner when access expires today
 */
function ExpiringTodayBanner({ expiryDate }: { expiryDate: Date }) {
  return (
    <Alert className="border-destructive/50 bg-destructive/5">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <AlertTitle className="text-base font-semibold flex items-center gap-2">
        Access Expires Today
        <Badge variant="destructive" className="text-xs">URGENT</Badge>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          Your intern access will expire at <strong>{format(expiryDate, 'HH:mm')}</strong> today.
        </p>
        <p className="text-sm text-muted-foreground">
          After expiry, you will not be able to view cases or submit drafts.
          Contact your supervisor if you need an extension.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Warning banner when access expires within 7 days
 */
function ExpiryWarningBanner({ 
  daysRemaining, 
  expiryDate 
}: { 
  daysRemaining: number;
  expiryDate: Date;
}) {
  const urgency = daysRemaining <= 3 ? 'high' : 'medium';
  
  return (
    <Alert className={urgency === 'high' 
      ? 'border-amber-500/50 bg-amber-500/10' 
      : 'border-muted bg-muted/30'
    }>
      <Clock className={`h-4 w-4 ${urgency === 'high' ? 'text-amber-600' : 'text-muted-foreground'}`} />
      <AlertTitle className="text-sm font-medium flex items-center gap-2">
        Intern Access Expires
        <Badge 
          variant={urgency === 'high' ? 'outline' : 'secondary'} 
          className={urgency === 'high' ? 'text-amber-600 border-amber-500 text-xs' : 'text-xs'}
        >
          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-1 text-xs text-muted-foreground">
        Your access ends on {format(expiryDate, 'dd MMMM yyyy')}. 
        Contact your supervisor if you need an extension.
      </AlertDescription>
    </Alert>
  );
}

/**
 * Feature blocker component for interns
 * Renders children only if intern has active access, otherwise shows block message
 */
export function InternFeatureBlocker({ 
  children,
  featureName = 'this feature'
}: { 
  children: React.ReactNode;
  featureName?: string;
}) {
  const { isIntern, isActiveIntern, expiresAt } = useInternPermissions();
  
  // Not an intern - render normally
  if (!isIntern) {
    return <>{children}</>;
  }
  
  // Active intern - render children
  if (isActiveIntern) {
    return <>{children}</>;
  }
  
  // Expired/revoked intern - show block
  const isExpired = expiresAt && expiresAt <= new Date();
  
  return (
    <div className="p-6 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
        <Lock className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h3 className="font-medium text-lg">Access Blocked</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isExpired 
            ? `Your intern access has expired. You cannot access ${featureName}.`
            : `You do not have permission to access ${featureName}.`}
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Phone className="h-4 w-4" />
        <span>Contact your supervisor</span>
      </div>
    </div>
  );
}

/**
 * Wrapper to completely block a feature for interns
 * Unlike InternFeatureBlocker, this renders nothing for interns (not even a message)
 */
export function InternFeatureHidden({ 
  children 
}: { 
  children: React.ReactNode;
}) {
  const { isIntern } = useInternPermissions();
  
  // Interns cannot see this at all
  if (isIntern) {
    return null;
  }
  
  return <>{children}</>;
}
