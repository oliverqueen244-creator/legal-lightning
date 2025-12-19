import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LiveBoardCache } from '@/types/database';

// Check if current time is within court hours (client-side mirror of server logic)
export function isCourtHours(): { inSession: boolean; reason: string } {
  const now = new Date();
  
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const dayOfWeek = istTime.getUTCDay(); // 0 = Sunday
  const timeInMinutes = hours * 60 + minutes;
  
  // Courts closed on Sunday
  if (dayOfWeek === 0) {
    return { inSession: false, reason: "Sunday - Courts closed" };
  }
  
  // Determine if summer schedule (Apr 15 - Jun 27)
  const month = istTime.getUTCMonth() + 1; // 1-12
  const day = istTime.getUTCDate();
  
  const isSummer = (month === 4 && day >= 15) || 
                   (month === 5) || 
                   (month === 6 && day <= 27);
  
  // Add 15-minute buffer before and 30-minute buffer after
  const bufferBefore = 15;
  const bufferAfter = 30;
  
  if (isSummer) {
    // Summer hours: 8 AM - 1 PM IST
    const startTime = 8 * 60 - bufferBefore; // 7:45 AM
    const endTime = 13 * 60 + bufferAfter; // 1:30 PM
    
    if (timeInMinutes >= startTime && timeInMinutes <= endTime) {
      return { inSession: true, reason: "Summer session (8 AM - 1 PM)" };
    }
    return { inSession: false, reason: `Outside summer hours (8 AM - 1 PM)` };
  } else {
    // Winter hours: 10:30 AM - 1 PM + 2 PM - 4:30 PM IST
    const morningStart = 10 * 60 + 30 - bufferBefore; // 10:15 AM
    const morningEnd = 13 * 60 + bufferAfter; // 1:30 PM
    const afternoonStart = 14 * 60 - bufferBefore; // 1:45 PM
    const afternoonEnd = 16 * 60 + 30 + bufferAfter; // 5:00 PM
    
    if ((timeInMinutes >= morningStart && timeInMinutes <= morningEnd) ||
        (timeInMinutes >= afternoonStart && timeInMinutes <= afternoonEnd)) {
      return { inSession: true, reason: "Winter session" };
    }
    return { inSession: false, reason: `Outside winter hours` };
  }
}

export function useLiveBoard() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['liveBoard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_board_cache')
        .select('*');

      if (error) throw error;
      
      // Cast to include is_active field
      return (data as any[]).map(item => ({
        ...item,
        is_active: item.is_active ?? false
      })) as LiveBoardCache[];
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

// Get only active courts
export function useActiveLiveBoards() {
  const { data: liveBoards, ...rest } = useLiveBoard();
  
  const activeCourts = liveBoards?.filter(board => board.is_active) ?? [];
  
  return {
    ...rest,
    data: activeCourts,
    allBoards: liveBoards, // Expose all boards for reference
  };
}

export function useLiveBoardForCourt(courtLocation: string, courtNo: string) {
  const { data: liveBoards } = useLiveBoard();
  
  return liveBoards?.find(
    (board) => board.court_location === courtLocation && board.court_no === courtNo
  );
}
