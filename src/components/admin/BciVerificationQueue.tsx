import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, ScrollText } from 'lucide-react';
import { toast } from 'sonner';

interface PendingProfile {
  id: string;
  full_name: string | null;
  bar_registration_number: string | null;
  bar_council_state: string | null;
  bci_verification_status: string;
  created_at: string;
}

export function BciVerificationQueue() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['admin', 'bci-pending'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, bar_registration_number, bar_council_state, bci_verification_status, created_at')
        .eq('bci_verification_status', 'submitted')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return ((data as unknown) as PendingProfile[]) ?? [];
    },
    refetchInterval: 60_000,
  });

  async function setStatus(userId: string, status: 'verified' | 'rejected', reason?: string) {
    const { error } = await (supabase.rpc as any)('set_bci_verification_status', {
      p_user_id: userId,
      p_status: status,
      p_reason: reason ?? null,
    });
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    toast.success(status === 'verified' ? 'Verified.' : 'Rejected.');
    queryClient.invalidateQueries({ queryKey: ['admin', 'bci-pending'] });
    setRejectingId(null);
    setRejectReason('');
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          BCI Verification Queue
          {pending.length > 0 && <Badge variant="secondary">{pending.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {!isLoading && pending.length === 0 && (
          <p className="text-sm text-muted-foreground">No submissions awaiting verification.</p>
        )}
        <div className="space-y-3">
          {pending.map((p) => (
            <div key={p.id} className="rounded border p-3 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-medium">{p.full_name || '(no name)'}</div>
                  <div className="text-xs text-muted-foreground">
                    Enrollment: <span className="font-mono">{p.bar_registration_number || '—'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Council: {p.bar_council_state || '—'}
                  </div>
                </div>
                <Badge variant="outline">submitted</Badge>
              </div>
              {rejectingId === p.id ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Reason for rejection (visible to the user)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!rejectReason.trim()}
                      onClick={() => setStatus(p.id, 'rejected', rejectReason.trim())}
                    >
                      Confirm rejection
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setStatus(p.id, 'verified')}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Verify
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRejectingId(p.id)}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
