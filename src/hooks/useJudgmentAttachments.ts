import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
export interface JudgmentAttachment {
  id: string;
  docket_id: string | null;
  argument_id: string | null;
  judgment_url: string;
  judgment_title: string;
  judgment_court: string | null;
  judgment_date: string | null;
  priority_signals: string[];
  user_note: string | null;
  attached_by: string;
  attached_at: string;
  source: string;
  search_vector: string | null;
  ranking_score: number | null;
  ranking_signals: Record<string, number> | null;
}

interface AttachJudgmentParams {
  docketId?: string;
  argumentId?: string;
  judgmentUrl: string;
  judgmentTitle: string;
  judgmentCourt?: string;
  judgmentDate?: string;
  prioritySignals?: string[];
  userNote?: string;
  source: 'live-search' | 'saved';
  searchVector?: string;
  rankingScore?: number;
  rankingSignals?: Record<string, number>;
}

export function useJudgmentAttachments(docketId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch attachments for a docket
  const attachmentsQuery = useQuery({
    queryKey: ['judgment-attachments', docketId],
    queryFn: async () => {
      if (!docketId) return [];
      
      const { data, error } = await supabase
        .from('judgment_attachments')
        .select('*')
        .eq('docket_id', docketId)
        .order('attached_at', { ascending: false });

      if (error) throw error;
      return data as JudgmentAttachment[];
    },
    enabled: !!docketId,
  });

  // Attach a judgment
  const attachMutation = useMutation({
    mutationFn: async (params: AttachJudgmentParams) => {
      // P0 FIX: Block write action when offline
      if (!navigator.onLine) {
        throw new Error('OFFLINE_BLOCKED');
      }

      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('judgment_attachments')
        .insert({
          docket_id: params.docketId,
          argument_id: params.argumentId,
          judgment_url: params.judgmentUrl,
          judgment_title: params.judgmentTitle,
          judgment_court: params.judgmentCourt,
          judgment_date: params.judgmentDate,
          priority_signals: params.prioritySignals || [],
          user_note: params.userNote,
          attached_by: user.id,
          source: params.source,
          search_vector: params.searchVector,
          ranking_score: params.rankingScore,
          ranking_signals: params.rankingSignals,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judgment-attachments', docketId] });
      toast.success('Reference judgment attached');
    },
    onError: (error) => {
      if (error.message === 'OFFLINE_BLOCKED') {
        toast.error('Internet connection required', {
          description: 'Cannot attach judgment while offline.',
        });
        return;
      }
      toast.error('Failed to attach judgment: ' + error.message);
    },
  });

  // Remove attachment
  const detachMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase
        .from('judgment_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judgment-attachments', docketId] });
      toast.success('Reference judgment removed');
    },
    onError: (error) => {
      toast.error('Failed to remove judgment: ' + error.message);
    },
  });

  // Check if a judgment URL is already attached
  const isAttached = (url: string) => {
    return attachmentsQuery.data?.some(a => a.judgment_url === url) || false;
  };

  return {
    attachments: attachmentsQuery.data || [],
    isLoading: attachmentsQuery.isLoading,
    attach: attachMutation.mutate,
    detach: detachMutation.mutate,
    isAttaching: attachMutation.isPending,
    isDetaching: detachMutation.isPending,
    isAttached,
  };
}
