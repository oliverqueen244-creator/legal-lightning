/**
 * CP-5: Delegation Badge Component
 * 
 * Displays the current delegation status for clerks.
 * Shows "Assisting Adv. <Name>" when acting on behalf of a lawyer.
 */

import { Badge } from '@/components/ui/badge';
import { UserCheck } from 'lucide-react';
import { useDelegation, getActingAsLabel } from '@/hooks/useDelegation';
import { cn } from '@/lib/utils';

interface DelegationBadgeProps {
  className?: string;
  variant?: 'default' | 'compact';
}

export function DelegationBadge({ className, variant = 'default' }: DelegationBadgeProps) {
  const { isClerk, primaryDelegation, hasDelegation } = useDelegation();

  // Only show for clerks with active delegation
  if (!isClerk || !hasDelegation || !primaryDelegation) {
    return null;
  }

  const label = getActingAsLabel(isClerk, primaryDelegation);

  if (variant === 'compact') {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "flex items-center gap-1 text-xs bg-primary/10 text-primary border-primary/20",
          className
        )}
      >
        <UserCheck className="h-3 w-3" aria-hidden="true" />
        {label}
      </Badge>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20", className)}>
      <UserCheck className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="text-sm font-medium text-primary">{label}</span>
    </div>
  );
}
