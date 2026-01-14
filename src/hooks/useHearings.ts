/**
 * useHearings Hook
 * 
 * Manages lawyer-confirmed hearing events.
 * Hearings are derived from post_court_notes or manually marked.
 * 
 * A hearing represents that a case was actually HEARD on a given date,
 * as opposed to just being LISTED on the cause list.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type HearingSource = 'post_court' | 'manual';

export interface CaseHearing {
  id: string;
  case_fingerprint: string;
  hearing_date: string;
  court_room_no: string | null;
  judge_names: string | null;
  was_heard: boolean;
  outcome: string | null;
  source: HearingSource;
  source_post_court_note_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all hearings for a case by fingerprint
 */
export function useHearingsForCase(caseFingerprint: string | null) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['case-hearings', caseFingerprint],
    queryFn: async (): Promise<CaseHearing[]> => {
      if (!caseFingerprint || !user?.id) return [];
      
      const { data, error } = await supabase
        .from('case_hearings')
        .select('*')
        .eq('case_fingerprint', caseFingerprint)
        .eq('created_by', user.id)
        .order('hearing_date', { ascending: true });
      
      if (error) throw error;
      return (data || []) as CaseHearing[];
    },
    enabled: !!caseFingerprint && !!user?.id,
  });
}

/**
 * Fetch hearings for multiple case fingerprints
 */
export function useHearingsForCases(caseFingerprints: string[]) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['case-hearings-batch', caseFingerprints.sort().join(',')],
    queryFn: async (): Promise<Map<string, CaseHearing[]>> => {
      if (!caseFingerprints.length || !user?.id) return new Map();
      
      const { data, error } = await supabase
        .from('case_hearings')
        .select('*')
        .in('case_fingerprint', caseFingerprints)
        .eq('created_by', user.id)
        .order('hearing_date', { ascending: true });
      
      if (error) throw error;
      
      // Group by fingerprint
      const map = new Map<string, CaseHearing[]>();
      for (const hearing of (data || []) as CaseHearing[]) {
        const existing = map.get(hearing.case_fingerprint) || [];
        existing.push(hearing);
        map.set(hearing.case_fingerprint, existing);
      }
      
      return map;
    },
    enabled: caseFingerprints.length > 0 && !!user?.id,
  });
}

/**
 * Check if a hearing exists for a specific case on a specific date
 */
export function useHearingForDate(caseFingerprint: string | null, date: string | null) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['case-hearing', caseFingerprint, date],
    queryFn: async (): Promise<CaseHearing | null> => {
      if (!caseFingerprint || !date || !user?.id) return null;
      
      const { data, error } = await supabase
        .from('case_hearings')
        .select('*')
        .eq('case_fingerprint', caseFingerprint)
        .eq('hearing_date', date)
        .eq('created_by', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as CaseHearing | null;
    },
    enabled: !!caseFingerprint && !!date && !!user?.id,
  });
}

/**
 * Manually mark a case as heard on a specific date
 * (Used when lawyer wants to confirm hearing without full post-court note)
 */
export function useMarkAsHeard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      caseFingerprint: string;
      hearingDate: string;
      courtRoomNo?: string;
      judgeNames?: string;
      outcome?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('case_hearings')
        .upsert({
          case_fingerprint: params.caseFingerprint,
          hearing_date: params.hearingDate,
          court_room_no: params.courtRoomNo || null,
          judge_names: params.judgeNames || null,
          was_heard: true,
          outcome: params.outcome || null,
          source: 'manual',
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'case_fingerprint,hearing_date,created_by',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as CaseHearing;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['case-hearings', data.case_fingerprint] });
      queryClient.invalidateQueries({ queryKey: ['case-hearing', data.case_fingerprint, data.hearing_date] });
      queryClient.invalidateQueries({ queryKey: ['listing-history'] });
    },
  });
}

/**
 * Remove a manually-added hearing (cannot remove post_court-derived hearings)
 */
export function useRemoveHearing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (hearingId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Only allow deletion of manual hearings
      const { error } = await supabase
        .from('case_hearings')
        .delete()
        .eq('id', hearingId)
        .eq('created_by', user.id)
        .eq('source', 'manual');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-hearings'] });
      queryClient.invalidateQueries({ queryKey: ['case-hearing'] });
      queryClient.invalidateQueries({ queryKey: ['listing-history'] });
    },
  });
}

/**
 * Get count of confirmed hearings for a case
 */
export function useHearingCount(caseFingerprint: string | null) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['hearing-count', caseFingerprint],
    queryFn: async (): Promise<number> => {
      if (!caseFingerprint || !user?.id) return 0;
      
      const { count, error } = await supabase
        .from('case_hearings')
        .select('*', { count: 'exact', head: true })
        .eq('case_fingerprint', caseFingerprint)
        .eq('created_by', user.id)
        .eq('was_heard', true);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!caseFingerprint && !!user?.id,
  });
}
