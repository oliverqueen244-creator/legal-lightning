import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { RefreshCw, Smartphone, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ForceUpdateConfig {
  version: number;
  reason: string;
  triggered_by: string | null;
  triggered_at: string | null;
}

export function ForceUpdateControl() {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  // Fetch current version
  const { data: configData, isLoading } = useQuery({
    queryKey: ['force-update-version'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value, updated_at')
        .eq('key', 'force_update_version')
        .single();
      
      if (error) throw error;
      return {
        config: data?.value as unknown as ForceUpdateConfig,
        updated_at: data?.updated_at as string
      };
    }
  });

  // Trigger force update mutation
  const triggerUpdate = useMutation({
    mutationFn: async (updateReason: string) => {
      const currentVersion = configData?.config?.version ?? 1;
      const newVersion = currentVersion + 1;

      const { error } = await supabase
        .from('app_config')
        .update({
          value: {
            version: newVersion,
            reason: updateReason,
            triggered_by: 'admin',
            triggered_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('key', 'force_update_version');

      if (error) throw error;
      return newVersion;
    },
    onSuccess: (newVersion) => {
      toast.success(`Force update triggered! Version: ${newVersion}`, {
        description: 'All installed PWAs will update on next app open.'
      });
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['force-update-version'] });
    },
    onError: (error) => {
      toast.error('Failed to trigger force update', {
        description: error.message
      });
    }
  });

  const handleTriggerUpdate = () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the update');
      return;
    }
    triggerUpdate.mutate(reason.trim());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = configData?.config;
  const updatedAt = configData?.updated_at;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <CardTitle>PWA Force Update Control</CardTitle>
        </div>
        <CardDescription>
          Trigger a forced update for all installed PWA instances. This will clear caches and reload the app on all devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Version Info */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Version</span>
            <Badge variant="outline" className="text-lg font-mono">
              v{config?.version ?? 1}
            </Badge>
          </div>
          
          {config?.reason && (
            <div className="flex items-start gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Last Reason:</span>
              <span className="text-sm">{config.reason}</span>
            </div>
          )}
          
          {updatedAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last updated: {format(new Date(updatedAt), 'PPpp')}</span>
            </div>
          )}
        </div>

        {/* Trigger Update Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="update-reason">Update Reason</Label>
            <Input
              id="update-reason"
              placeholder="e.g., Critical bug fix, UI update, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Describe why you're forcing an update. This is logged for audit purposes.
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                className="w-full" 
                variant="destructive"
                disabled={!reason.trim() || triggerUpdate.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${triggerUpdate.isPending ? 'animate-spin' : ''}`} />
                Trigger Force Update
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Confirm Force Update
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    This will force <strong>ALL installed PWA instances</strong> to clear their caches and reload on the next app open.
                  </p>
                  <p className="text-sm">
                    <strong>Reason:</strong> {reason}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone. Users may experience a brief interruption.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleTriggerUpdate}>
                  Confirm Update
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Info Box */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            <strong>How it works:</strong> When you trigger a force update, all installed PWAs will check the version number on their next app open. If the server version is higher, they will automatically clear all caches and reload with fresh assets.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
