import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Users, Eye, Share2, Loader2 } from 'lucide-react';
import { useSharingConsent, useUpdateSharingConsent } from '@/hooks/useJudgeIntelligence';
import { toast } from 'sonner';

interface ChamberSharingPanelProps {
  /** If provided, manages consent for this chamber */
  currentChamberId?: string;
  /** Callback when sharing status changes */
  onSharingChange?: (isSharing: boolean, isViewing: boolean) => void;
}

export function ChamberSharingPanel({ 
  currentChamberId,
  onSharingChange 
}: ChamberSharingPanelProps) {
  const [chamberId, setChamberId] = useState(currentChamberId || '');
  const [isEditing, setIsEditing] = useState(!currentChamberId);
  
  const effectiveChamberId = currentChamberId || chamberId;
  
  const { data: consent, isLoading } = useSharingConsent(effectiveChamberId || undefined);
  const { mutate: updateConsent, isPending } = useUpdateSharingConsent();

  const shareEnabled = consent?.share_own_observations ?? false;
  const viewEnabled = consent?.view_chamber_observations ?? false;

  const handleToggleShare = (enabled: boolean) => {
    if (!effectiveChamberId) {
      toast.error('Please enter a chamber ID first');
      return;
    }
    
    updateConsent({
      chamber_id: effectiveChamberId,
      share_own_observations: enabled,
      view_chamber_observations: viewEnabled
    }, {
      onSuccess: () => {
        toast.success(enabled 
          ? 'Now sharing observations with chamber' 
          : 'Stopped sharing observations');
        onSharingChange?.(enabled, viewEnabled);
      },
      onError: () => {
        toast.error('Failed to update sharing settings');
      }
    });
  };

  const handleToggleView = (enabled: boolean) => {
    if (!effectiveChamberId) {
      toast.error('Please enter a chamber ID first');
      return;
    }
    
    updateConsent({
      chamber_id: effectiveChamberId,
      share_own_observations: shareEnabled,
      view_chamber_observations: enabled
    }, {
      onSuccess: () => {
        toast.success(enabled 
          ? 'Now viewing chamber observations' 
          : 'Stopped viewing chamber observations');
        onSharingChange?.(shareEnabled, enabled);
      },
      onError: () => {
        toast.error('Failed to update viewing settings');
      }
    });
  };

  const handleSetChamber = () => {
    if (!chamberId.trim()) {
      toast.error('Please enter a chamber ID');
      return;
    }
    setIsEditing(false);
  };

  // Status display
  const getSharingStatus = () => {
    if (shareEnabled && viewEnabled) return { label: 'Full Sharing', variant: 'default' as const };
    if (shareEnabled) return { label: 'Sharing Only', variant: 'secondary' as const };
    if (viewEnabled) return { label: 'Viewing Only', variant: 'secondary' as const };
    return { label: 'Private', variant: 'outline' as const };
  };

  const status = getSharingStatus();

  return (
    <div className="space-y-4 p-3 rounded-lg border border-border/30 bg-muted/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Chamber Sharing</span>
        </div>
        <Badge variant={status.variant} className="text-[10px] h-5">
          {status.label}
        </Badge>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-2 rounded bg-muted/30 border border-border/20">
        <AlertCircle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Sharing is optional. Observations are factual records, not advice. 
          Both toggles must be ON for sharing to occur between chamber members.
        </p>
      </div>

      {/* Chamber ID Input */}
      {isEditing ? (
        <div className="space-y-2">
          <Label htmlFor="chamber-id" className="text-xs text-muted-foreground">
            Chamber Identifier
          </Label>
          <div className="flex gap-2">
            <Input
              id="chamber-id"
              value={chamberId}
              onChange={(e) => setChamberId(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="e.g., sharma-associates"
              className="h-8 text-xs flex-1"
              disabled={!!currentChamberId}
            />
            {!currentChamberId && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleSetChamber}
                className="h-8 text-xs"
              >
                Set
              </Button>
            )}
          </div>
          <p className="text-[9px] text-muted-foreground/60">
            Use the same ID as other chamber members to share observations
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/20">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Chamber:</span>
            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
              {effectiveChamberId}
            </code>
          </div>
          {!currentChamberId && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsEditing(true)}
              className="h-6 text-xs px-2"
            >
              Change
            </Button>
          )}
        </div>
      )}

      {/* Sharing Toggles */}
      {effectiveChamberId && !isEditing && (
        <div className="space-y-3 pt-2 border-t border-border/20">
          {/* Share toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
              <Label htmlFor="share-toggle" className="text-xs cursor-pointer">
                Share my observations with this chamber
              </Label>
            </div>
            <Switch
              id="share-toggle"
              checked={shareEnabled}
              onCheckedChange={handleToggleShare}
              disabled={isPending || isLoading}
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <Label htmlFor="view-toggle" className="text-xs cursor-pointer">
                View chamber-shared observations
              </Label>
            </div>
            <Switch
              id="view-toggle"
              checked={viewEnabled}
              onCheckedChange={handleToggleView}
              disabled={isPending || isLoading}
            />
          </div>

          {/* Status indicator */}
          {isPending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Updating...</span>
            </div>
          )}
        </div>
      )}

      {/* Legal note */}
      <p className="text-[9px] text-muted-foreground/50 pt-2 border-t border-border/20">
        Changes apply immediately. Revocation instantly removes access.
      </p>
    </div>
  );
}

export default ChamberSharingPanel;
