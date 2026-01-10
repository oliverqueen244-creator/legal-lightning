import { useState } from 'react';
import { Scale, Clock, MessageSquare, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCourtMode } from '@/hooks/useCourtMode';
import { useAuth } from '@/hooks/useAuth';
import { getBenchMenuLabel } from '@/lib/benchNames';

interface CourtModeSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CourtModeSettings({ open, onOpenChange }: CourtModeSettingsProps) {
  const { profile } = useAuth();
  const { 
    settings, 
    isCourtModeEnabled, 
    enableCourtMode, 
    disableCourtMode, 
    updateSettings,
    isUpdating 
  } = useCourtMode();

  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const [pendingBench, setPendingBench] = useState<'JODHPUR' | 'JAIPUR' | 'BOTH' | null>(null);

  const handleToggleCourtMode = async (enabled: boolean) => {
    if (enabled) {
      const bench = (profile?.bench as 'JODHPUR' | 'JAIPUR' | 'BOTH') || 'BOTH';
      setPendingBench(bench);
      setShowEnableConfirm(true);
    } else {
      await disableCourtMode();
    }
  };

  const handleConfirmEnable = async () => {
    if (pendingBench) {
      await enableCourtMode(pendingBench);
      setShowEnableConfirm(false);
      setPendingBench(null);
    }
  };

  const handleTimeChange = (field: 'court_mode_start' | 'court_mode_end', value: string) => {
    updateSettings({ [field]: value + ':00' });
  };

  const handleBenchChange = (value: string) => {
    updateSettings({ court_mode_bench: value as 'JODHPUR' | 'JAIPUR' | 'BOTH' });
  };

  const handleWhatsAppToggle = (enabled: boolean) => {
    updateSettings({ whatsapp_escalation_enabled: enabled });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Court Mode Settings
            </DialogTitle>
            <DialogDescription>
              Configure how Nyay Hub alerts you during court hours
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Court Mode Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Court Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Enable enhanced notifications during court hours
                </p>
              </div>
              <Switch
                checked={isCourtModeEnabled}
                onCheckedChange={handleToggleCourtMode}
                disabled={isUpdating}
              />
            </div>

            {isCourtModeEnabled && (
              <>
                {/* Bench Selection */}
                <div className="space-y-2">
                  <Label>Active Bench</Label>
                  <Select
                    value={settings?.court_mode_bench || 'BOTH'}
                    onValueChange={handleBenchChange}
                    disabled={isUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bench" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JODHPUR">{getBenchMenuLabel('JODHPUR')}</SelectItem>
                      <SelectItem value="JAIPUR">{getBenchMenuLabel('JAIPUR')}</SelectItem>
                      <SelectItem value="BOTH">{getBenchMenuLabel('BOTH')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Court Hours */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Court Hours
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={settings?.court_mode_start?.slice(0, 5) || '10:30'}
                      onChange={(e) => handleTimeChange('court_mode_start', e.target.value)}
                      disabled={isUpdating}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={settings?.court_mode_end?.slice(0, 5) || '17:00'}
                      onChange={(e) => handleTimeChange('court_mode_end', e.target.value)}
                      disabled={isUpdating}
                      className="w-32"
                    />
                  </div>
                </div>

                {/* WhatsApp Escalation */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2 text-base font-medium">
                      <MessageSquare className="h-4 w-4" />
                      WhatsApp Escalation
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive WhatsApp alerts for unacknowledged critical notifications
                    </p>
                  </div>
                  <Switch
                    checked={settings?.whatsapp_escalation_enabled ?? false}
                    onCheckedChange={handleWhatsAppToggle}
                    disabled={isUpdating}
                  />
                </div>

                {/* Legal Disclaimer */}
                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Automated alert for assistance only. Always verify against official court records.
                    </span>
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enable Confirmation Dialog */}
      <Dialog open={showEnableConfirm} onOpenChange={setShowEnableConfirm}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Enable Court Mode
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm leading-relaxed">
              Court Mode helps you avoid missing court-critical situations.
            </p>
            <p className="text-sm leading-relaxed">
              During court hours, Nyay Hub may escalate urgent alerts through 
              additional channels if they are not acknowledged in time.
            </p>
            <p className="text-sm leading-relaxed font-medium">
              This does not override your phone's silent or DND settings.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowEnableConfirm(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmEnable}
              disabled={isUpdating}
            >
              Enable Court Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
