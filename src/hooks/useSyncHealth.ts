import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LiveBoardCache } from '@/types/database';
import { isCourtHours } from './useLiveBoard';

export type SyncStatus = 'live' | 'delayed' | 'stale' | 'unknown' | 'not_in_session';

export interface CourtSyncHealth {
  court_location: string;
  court_no: string;
  status: SyncStatus;
  staleSeconds: number;
  lastUpdated: string;
  isActive: boolean;
}

export interface SyncHealthState {
  overallStatus: SyncStatus;
  courts: CourtSyncHealth[];
  lastChecked: Date;
  courtHoursStatus: { inSession: boolean; reason: string };
}

const STALE_THRESHOLD_LIVE = 30; // seconds
const STALE_THRESHOLD_DELAYED = 60; // seconds
const CHECK_INTERVAL = 5000; // 5 seconds

export function useSyncHealth(liveBoards: LiveBoardCache[] | undefined) {
  const [syncHealth, setSyncHealth] = useState<SyncHealthState>({
    overallStatus: 'unknown',
    courts: [],
    lastChecked: new Date(),
    courtHoursStatus: { inSession: false, reason: '' }
  });

  const calculateSyncHealth = useCallback(() => {
    const courtHoursStatus = isCourtHours();
    
    if (!liveBoards || liveBoards.length === 0) {
      setSyncHealth({
        overallStatus: courtHoursStatus.inSession ? 'unknown' : 'not_in_session',
        courts: [],
        lastChecked: new Date(),
        courtHoursStatus
      });
      return;
    }

    // If outside court hours, don't show stale warnings
    if (!courtHoursStatus.inSession) {
      const courts: CourtSyncHealth[] = liveBoards.map(board => ({
        court_location: board.court_location,
        court_no: board.court_no,
        status: 'not_in_session' as SyncStatus,
        staleSeconds: 0,
        lastUpdated: board.last_updated,
        isActive: board.is_active ?? false
      }));

      setSyncHealth({
        overallStatus: 'not_in_session',
        courts,
        lastChecked: new Date(),
        courtHoursStatus
      });
      return;
    }

    // During court hours, calculate normal sync health
    const now = Date.now();
    const courts: CourtSyncHealth[] = liveBoards.map(board => {
      const lastUpdated = new Date(board.last_updated).getTime();
      const staleSeconds = Math.round((now - lastUpdated) / 1000);
      const isActive = board.is_active ?? false;
      
      // If court is not active, don't mark as stale
      if (!isActive) {
        return {
          court_location: board.court_location,
          court_no: board.court_no,
          status: 'unknown' as SyncStatus,
          staleSeconds,
          lastUpdated: board.last_updated,
          isActive
        };
      }
      
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
        lastUpdated: board.last_updated,
        isActive
      };
    });

    // Overall status is the worst status among ACTIVE courts only
    const activeCourts = courts.filter(c => c.isActive);
    let overallStatus: SyncStatus = 'live';
    
    if (activeCourts.length === 0) {
      overallStatus = 'unknown';
    } else if (activeCourts.some(c => c.status === 'stale')) {
      overallStatus = 'stale';
    } else if (activeCourts.some(c => c.status === 'delayed')) {
      overallStatus = 'delayed';
    }

    setSyncHealth({
      overallStatus,
      courts,
      lastChecked: new Date(),
      courtHoursStatus
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
  const [health, setHealth] = useState<{ status: SyncStatus; staleSeconds: number; isActive: boolean }>({
    status: 'unknown',
    staleSeconds: 0,
    isActive: false
  });

  useEffect(() => {
    const courtHoursStatus = isCourtHours();
    
    if (!liveBoard) {
      setHealth({ status: 'unknown', staleSeconds: 0, isActive: false });
      return;
    }

    const checkHealth = () => {
      const courtHours = isCourtHours();
      const isActive = liveBoard.is_active ?? false;
      
      // Outside court hours - don't show stale warnings
      if (!courtHours.inSession) {
        setHealth({ status: 'not_in_session', staleSeconds: 0, isActive });
        return;
      }
      
      // If court is not active during court hours
      if (!isActive) {
        setHealth({ status: 'unknown', staleSeconds: 0, isActive });
        return;
      }
      
      const now = Date.now();
      const lastUpdated = new Date(liveBoard.last_updated).getTime();
      const staleSeconds = Math.round((now - lastUpdated) / 1000);
      
      let status: SyncStatus = 'live';
      if (staleSeconds > STALE_THRESHOLD_DELAYED) {
        status = 'stale';
      } else if (staleSeconds > STALE_THRESHOLD_LIVE) {
        status = 'delayed';
      }

      setHealth({ status, staleSeconds, isActive });
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
