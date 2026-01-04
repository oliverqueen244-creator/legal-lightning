import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, TrendingUp, AlertCircle, Clock, HelpCircle as Unknown } from 'lucide-react';
import type { HearingLikelihood } from '@/types/database';
import { cn } from '@/lib/utils';

interface HearingLikelihoodBadgeProps {
  likelihood: HearingLikelihood | null;
  reason: string | null;
  className?: string;
}

/**
 * HearingLikelihoodBadge
 * 
 * Displays hearing likelihood with NON-PROMISSORY language.
 * 
 * CRITICAL: This component must NEVER use language that promises or guarantees
 * a hearing. All text must be conditional and reference court documentation.
 */
export function HearingLikelihoodBadge({ likelihood, reason, className }: HearingLikelihoodBadgeProps) {
  if (!likelihood || likelihood === 'UNKNOWN') {
    return null; // Don't show badge for unknown likelihood
  }

  const config = {
    LIKELY: {
      icon: TrendingUp,
      label: 'Listed',
      variant: 'outline' as const,
      className: 'border-court-success/50 text-court-success bg-court-success/5',
      description: 'Case is listed and may be reached per court proceedings.',
    },
    CONDITIONAL: {
      icon: Clock,
      label: 'Conditional',
      variant: 'outline' as const,
      className: 'border-court-warning/50 text-court-warning bg-court-warning/5',
      description: 'Hearing subject to court convenience and earlier matters.',
    },
    LOW_PROBABILITY: {
      icon: AlertCircle,
      label: 'Subject to time',
      variant: 'outline' as const,
      className: 'border-muted text-muted-foreground bg-muted/10',
      description: 'May not be reached today. Check with registry.',
    },
    UNKNOWN: {
      icon: Unknown,
      label: 'Status unclear',
      variant: 'outline' as const,
      className: 'border-muted text-muted-foreground',
      description: 'No execution policy found. Verify with court.',
    },
  };

  const { icon: Icon, label, className: badgeClassName, description } = config[likelihood];

  // Non-promissory reason text - add disclaimer if reason doesn't have one
  const safeReason = reason || description;
  const displayReason = safeReason.toLowerCase().includes('per court') || 
                        safeReason.toLowerCase().includes('subject to') ||
                        safeReason.toLowerCase().includes('may') ||
                        safeReason.toLowerCase().includes('uncertain')
    ? safeReason
    : `${safeReason} Subject to court proceedings.`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              'flex items-center gap-1 text-xs cursor-help',
              badgeClassName,
              className
            )}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {label}
            <HelpCircle className="h-2.5 w-2.5 ml-0.5 opacity-60" aria-hidden="true" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="text-xs font-medium">{description}</p>
            {reason && (
              <p className="text-xs text-muted-foreground italic">
                "{displayReason}"
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-2 border-t pt-1">
              ⚠️ This is derived from court notes, not a guarantee. 
              Actual hearing depends on court proceedings.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * HearingLikelihoodText
 * 
 * Inline text version for smaller contexts.
 * Uses NON-PROMISSORY language throughout.
 */
export function HearingLikelihoodText({ likelihood }: { likelihood: HearingLikelihood | null }) {
  if (!likelihood) return null;

  const textMap = {
    LIKELY: 'May be reached today',
    CONDITIONAL: 'Subject to court time',
    LOW_PROBABILITY: 'Uncertain if reached',
    UNKNOWN: 'Status to be verified',
  };

  return (
    <span className="text-xs text-muted-foreground">
      {textMap[likelihood]}
    </span>
  );
}
