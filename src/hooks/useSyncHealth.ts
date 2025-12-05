import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LiveBoardCache } from '@/types/database';

export type SyncStatus = 'live' | 'delayed' | 'stale' | 'unknown';

export interface CourtSyncHealth {
  court_location: string;
  court_no: string;
  status: SyncStatus;
  staleSeconds: number;
  lastUpdated: string;
}

export interface SyncHealthState {
  overallStatus: SyncStatus;
  courts: CourtSyncHealth[];
  lastChecked: Date;
}

const STALE_THRESHOLD_LIVE = 30; // seconds
const STALE_THRESHOLD_DELAYED = 60; // seconds
const CHECK_INTERVAL = 5000; // 5 seconds

export function useSyncHealth(liveBoards: LiveBoardCache[] | undefined) {
  const [syncHealth, setSyncHealth] = useState<SyncHealthState>({
    overallStatus: 'unknown',
    courts: [],
    lastChecked: new Date()
  });

  const calculateSyncHealth = useCallback(() => {
    if (!liveBoards || liveBoards.length === 0) {
      setSyncHealth({
        overallStatus: 'unknown',
        courts: [],
        lastChecked: new Date()
      });
      return;
    }

    const now = Date.now();
    const courts: CourtSyncHealth[] = liveBoards.map(board => {
      const lastUpdated = new Date(board.last_updated).getTime();
      const staleSeconds = Math.round((now - lastUpdated) / 1000);
      
      let status: SyncStatus = 'live';
      if (staleSeconds > STALE_THRESHOLD_DELAYED) {
        status = 'stale';
      } else if (staleSeconds > STALE_THRESHOLD_LIVE) {
        status = 'delayed';
      }

      return {
        court_location: board.court_location,
        court_no: board.court_no,
        status,
        staleSeconds,
        lastUpdated: board.last_updated
      };
    });

    // Overall status is the worst status among all courts
    let overallStatus: SyncStatus = 'live';
    if (courts.some(c => c.status === 'stale')) {
      overallStatus = 'stale';
    } else if (courts.some(c => c.status === 'delayed')) {
      overallStatus = 'delayed';
    }

    setSyncHealth({
      overallStatus,
      courts,
      lastChecked: new Date()
    });
  }, [liveBoards]);

  // Check staleness every 5 seconds
  useEffect(() => {
    calculateSyncHealth();
    
    const interval = setInterval(calculateSyncHealth, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [calculateSyncHealth]);

  return syncHealth;
}

export function useCourtSyncHealth(courtLocation: string, courtNo: string, liveBoard: LiveBoardCache | undefined) {
  const [health, setHealth] = useState<{ status: SyncStatus; staleSeconds: number }>({
    status: 'unknown',
    staleSeconds: 0
  });

  useEffect(() => {
    if (!liveBoard) {
      setHealth({ status: 'unknown', staleSeconds: 0 });
      return;
    }

    const checkHealth = () => {
      const now = Date.now();
      const lastUpdated = new Date(liveBoard.last_updated).getTime();
      const staleSeconds = Math.round((now - lastUpdated) / 1000);
      
      let status: SyncStatus = 'live';
      if (staleSeconds > STALE_THRESHOLD_DELAYED) {
        status = 'stale';
      } else if (staleSeconds > STALE_THRESHOLD_LIVE) {
        status = 'delayed';
      }

      setHealth({ status, staleSeconds });
    };

    checkHealth();
    const interval = setInterval(checkHealth, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [liveBoard]);

  return health;
}

export function useSyncStatusHistory() {
  return useQuery({
    queryKey: ['syncStatusHistory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_status')
        .select('*')
        .order('last_sync_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    refetchInterval: 10000 // Refetch every 10 seconds
  });
}

export function useFallbackPolling(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    console.log('[useFallbackPolling] Starting 10-second fallback polling');
    
    const interval = setInterval(() => {
      console.log('[useFallbackPolling] Polling for live board updates');
      queryClient.invalidateQueries({ queryKey: ['liveBoard'] });
    }, 10000); // 10 seconds

    return () => {
      console.log('[useFallbackPolling] Stopping fallback polling');
      clearInterval(interval);
    };
  }, [enabled, queryClient]);
}
