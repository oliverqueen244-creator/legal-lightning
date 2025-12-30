import { useState } from 'react';
import { Scale } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CourtModeSettings } from './CourtModeSettings';
import { useCourtMode } from '@/hooks/useCourtMode';

export function CourtModeBadge() {
  const { isCourtModeEnabled, isWithinCourtHours } = useCourtMode();
  const [showSettings, setShowSettings] = useState(false);

  if (!isCourtModeEnabled) return null;

  const isActive = isWithinCourtHours();

  return (
    <>
      <Badge
        variant="outline"
        className={`cursor-pointer gap-1.5 transition-colors ${
          isActive 
            ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20' 
            : 'border-muted-foreground/30 text-muted-foreground hover:bg-muted'
        }`}
        onClick={() => setShowSettings(true)}
      >
        <Scale className="h-3 w-3" />
        <span className="text-xs font-medium">
          Court Mode {isActive ? 'Active' : 'Standby'}
        </span>
      </Badge>

      <CourtModeSettings open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
}
