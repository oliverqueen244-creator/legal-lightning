/**
 * CP-4: Dual-Stream Docket Hook
 * 
 * Provides separate streams for:
 * - Personal cases (case_context = 'personal', matched to user)
 * - Chamber cases (case_context = 'chamber', user is chamber member)
 * 
 * This enables Junior advocates to see both their independent practice
 * and cases they handle through their chamber.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DocketItem, CaseContext } from '@/types/database';
import { useAuth } from './useAuth';
import { useMemberChambers, useOwnedChambers } from './useChambers';
import { useEffect, useMemo } from 'react';

const DOCKET_STALE_TIME = 30_000;

export interface DualStreamDocket {
  personalCases: DocketItem[];
  chamberCases: DocketItem[];
  allCases: DocketItem[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetch personal cases (case_context = 'personal')
 */
export function usePersonalDocket(date?: string) {
  const { user } = useAuth();
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['docket', 'personal', user?.id, targetDate],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('date', targetDate)
        .eq('matched_profile_id', user.id)
        .eq('case_context', 'personal')
        .order('list_type', { ascending: false })
        .order('item_no', { ascending: true });
      
      if (error) throw error;
      return (data || []) as DocketItem[];
    },
    enabled: !!user?.id,
    staleTime: DOCKET_STALE_TIME,
  });
}

/**
 * Fetch chamber cases (case_context = 'chamber')
 * User sees chamber cases if they are a member or owner of the chamber
 */
export function useChamberDocket(date?: string) {
  const { user } = useAuth();
  const { data: ownedChambers = [] } = useOwnedChambers();
  const { data: memberChambers = [] } = useMemberChambers();
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  // Get all chamber IDs where user has access
  const chamberIds = useMemo(() => {
    const owned = ownedChambers.map(c => c.id);
    const member = memberChambers.map(m => m.chamber_id);
    return [...new Set([...owned, ...member])];
  }, [ownedChambers, memberChambers]);
  
  return useQuery({
    queryKey: ['docket', 'chamber', user?.id, chamberIds, targetDate],
    queryFn: async () => {
      if (!user?.id || chamberIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('date', targetDate)
        .eq('case_context', 'chamber')
        .in('chamber_id', chamberIds)
        .order('chamber_id', { ascending: true })
        .order('list_type', { ascending: false })
        .order('item_no', { ascending: true });
      
      if (error) throw error;
      return (data || []) as DocketItem[];
    },
    enabled: !!user?.id && chamberIds.length > 0,
    staleTime: DOCKET_STALE_TIME,
  });
}

/**
 * Combined dual-stream docket hook
 * Returns both personal and chamber cases in separate arrays
 */
export function useDualStreamDocket(date?: string): DualStreamDocket {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const personalQuery = usePersonalDocket(date);
  const chamberQuery = useChamberDocket(date);
  
  // Subscribe to realtime changes
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel(`dual-docket-${targetDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_court_docket',
          filter: `date=eq.${targetDate}`,
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          // Invalidate personal cases if user's case changed
          if (
            newRecord?.matched_profile_id === user.id ||
            oldRecord?.matched_profile_id === user.id
          ) {
            queryClient.invalidateQueries({ 
              queryKey: ['docket', 'personal', user.id, targetDate] 
            });
          }
          
          // Invalidate chamber cases if chamber case changed
          if (newRecord?.case_context === 'chamber' || oldRecord?.case_context === 'chamber') {
            queryClient.invalidateQueries({ 
              queryKey: ['docket', 'chamber', user.id] 
            });
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, targetDate, user?.id]);
  
  return {
    personalCases: personalQuery.data || [],
    chamberCases: chamberQuery.data || [],
    allCases: [...(personalQuery.data || []), ...(chamberQuery.data || [])],
    isLoading: personalQuery.isLoading || chamberQuery.isLoading,
    error: personalQuery.error || chamberQuery.error,
  };
}

/**
 * Get the appropriate case label based on case context and user role
 */
export function getCaseContextLabel(
  caseContext: CaseContext,
  isClerk: boolean
): string {
  if (isClerk) {
    return 'Tracked case';
  }
  return caseContext === 'chamber' ? 'Chamber case' : 'Your case';
}
