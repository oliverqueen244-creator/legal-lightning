import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LiveBoardCache } from '@/types/database';

export function useLiveBoard() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['liveBoard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_board_cache')
        .select('*');

      if (error) throw error;
      return data as LiveBoardCache[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('live-board-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_board_cache',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['liveBoard'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useLiveBoardForCourt(courtLocation: string, courtNo: string) {
  const { data: liveBoards } = useLiveBoard();
  
  return liveBoards?.find(
    (board) => board.court_location === courtLocation && board.court_no === courtNo
  );
}
