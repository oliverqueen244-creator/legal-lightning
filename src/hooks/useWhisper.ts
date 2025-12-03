import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { WhisperMessage } from '@/types/database';
import { toast } from 'sonner';

export function useWhisperFeed(docketId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['whisper', docketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_courtroom_feed')
        .select('*')
        .eq('docket_id', docketId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WhisperMessage[];
    },
    enabled: !!docketId,
  });

  return query;
}

export function useWhisperListener(docketId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!docketId) return;

    const channel = supabase
      .channel(`whisper-${docketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_courtroom_feed',
          filter: `docket_id=eq.${docketId}`,
        },
        (payload) => {
          const newMessage = payload.new as WhisperMessage;
          
          // Show mission-critical toast
          toast(newMessage.message, {
            className: 'bg-background border-2 border-primary text-primary font-bold shadow-[0_0_20px_hsl(48_97%_54%/0.4)]',
            duration: 8000,
            position: 'top-center',
          });
          
          queryClient.invalidateQueries({ queryKey: ['whisper', docketId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [docketId, queryClient]);
}

export function useSendWhisper() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ docketId, message }: { docketId: string; message: string }) => {
      const { data, error } = await supabase
        .from('live_courtroom_feed')
        .insert({
          docket_id: docketId,
          message,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whisper', variables.docketId] });
    },
  });
}
