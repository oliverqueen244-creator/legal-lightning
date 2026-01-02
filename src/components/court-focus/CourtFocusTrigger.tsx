import { Focus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCourtFocusMode } from '@/hooks/useCourtFocusMode';
import { cn } from '@/lib/utils';

interface CourtFocusTriggerProps {
  className?: string;
  variant?: 'default' | 'compact';
}

export function CourtFocusTrigger({ className, variant = 'default' }: CourtFocusTriggerProps) {
  const { 
    isActive, 
    enterFocusMode, 
    isCourtModeEnabled,
    focusCase,
  } = useCourtFocusMode();

  // Don't show if already in focus mode
  if (isActive) return null;

  // Only show when court mode is enabled or there's a matched case
  if (!isCourtModeEnabled && !focusCase) return null;

  if (variant === 'compact') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={enterFocusMode}
        className={cn(
          'gap-2 border-primary/50 hover:border-primary hover:bg-primary/10',
          className
        )}
      >
        <Focus className="h-4 w-4" />
        <span>Focus</span>
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size="lg"
      onClick={enterFocusMode}
      className={cn(
        'gap-2 font-bold',
        focusCase && focusCase.status === 'running' && 'animate-pulse',
        className
      )}
    >
      <Focus className="h-5 w-5" />
      <span>Enter Court Focus</span>
    </Button>
  );
}
