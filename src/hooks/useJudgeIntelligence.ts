import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ========================================
// TYPES
// ========================================

export interface JudgeObservation {
  id: string;
  lawyer_id: string;
  judge_name: string;
  bench: string;
  court_no: string | null;
  observation_text: string;
  observation_type: 'general' | 'procedural' | 'timing' | 'preference';
  source_docket_id: string | null;
  source_case_number: string | null;
  hearing_date: string | null;
  created_at: string;
  // UI metadata
  is_own: boolean;
  is_chamber_shared?: boolean;
}

export interface SharingConsent {
  id: string;
  lawyer_id: string;
  chamber_id: string;
  share_own_observations: boolean;
  view_chamber_observations: boolean;
  consented_at: string;
  revoked_at: string | null;
}

export interface ProceduralPattern {
  id: string;
  bench: string;
  court_no: string;
  pattern_date: string;
  avg_start_time: string | null;
  avg_lunch_duration_minutes: number | null;
  typical_items_per_hour: number | null;
  observations_count: number;
}

export interface AddObservationParams {
  judge_name: string;
  bench: string;
  court_no?: string;
  observation_text: string;
  observation_type?: 'general' | 'procedural' | 'timing' | 'preference';
  source_docket_id?: string;
  source_case_number?: string;
  hearing_date?: string;
}

// ========================================
// PERSONAL OBSERVATIONS HOOK
// ========================================

interface UseJudgeObservationsParams {
  judgeName?: string | null;
  bench?: string | null;
  limit?: number;
}

export function useJudgeObservations({
  judgeName,
  bench,
  limit = 50
}: UseJudgeObservationsParams = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['judge-observations', user?.id, judgeName, bench, limit],
    queryFn: async (): Promise<JudgeObservation[]> => {
      if (!user?.id) return [];

      let query = supabase
        .from('judge_observations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by judge name if provided
      if (judgeName) {
        query = query.ilike('judge_name', `%${judgeName}%`);
      }

      // Filter by bench if provided
      if (bench) {
        query = query.eq('bench', bench);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Mark ownership
      return (data || []).map(obs => ({
        ...obs,
        observation_type: obs.observation_type as JudgeObservation['observation_type'],
        is_own: obs.lawyer_id === user.id,
        is_chamber_shared: obs.lawyer_id !== user.id
      }));
    },
    enabled: !!user?.id
  });
}

// ========================================
// ADD OBSERVATION MUTATION
// ========================================

export function useAddObservation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddObservationParams) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('judge_observations')
        .insert({
          lawyer_id: user.id,
          judge_name: params.judge_name,
          bench: params.bench,
          court_no: params.court_no || null,
          observation_text: params.observation_text,
          observation_type: params.observation_type || 'general',
          source_docket_id: params.source_docket_id || null,
          source_case_number: params.source_case_number || null,
          hearing_date: params.hearing_date || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-observations'] });
    }
  });
}

// ========================================
// CHAMBER SHARING CONSENT
// ========================================

export function useSharingConsent(chamberId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['judge-sharing-consent', user?.id, chamberId],
    queryFn: async (): Promise<SharingConsent | null> => {
      if (!user?.id || !chamberId) return null;

      const { data, error } = await supabase
        .from('judge_observation_sharing')
        .select('*')
        .eq('lawyer_id', user.id)
        .eq('chamber_id', chamberId)
        .is('revoked_at', null)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!chamberId
  });
}

export function useUpdateSharingConsent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      chamber_id: string;
      share_own_observations: boolean;
      view_chamber_observations: boolean;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Upsert consent
      const { data, error } = await supabase
        .from('judge_observation_sharing')
        .upsert({
          lawyer_id: user.id,
          chamber_id: params.chamber_id,
          share_own_observations: params.share_own_observations,
          view_chamber_observations: params.view_chamber_observations,
          consented_at: new Date().toISOString(),
          revoked_at: null
        }, {
          onConflict: 'lawyer_id,chamber_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-sharing-consent'] });
      queryClient.invalidateQueries({ queryKey: ['judge-observations'] });
    }
  });
}

// ========================================
// PROCEDURAL PATTERNS (PUBLIC AGGREGATE)
// ========================================

export function useProceduralPatterns(bench?: string, courtNo?: string) {
  return useQuery({
    queryKey: ['procedural-patterns', bench, courtNo],
    queryFn: async (): Promise<ProceduralPattern[]> => {
      let query = supabase
        .from('bench_procedural_patterns')
        .select('*')
        .order('pattern_date', { ascending: false })
        .limit(30);

      if (bench) {
        query = query.eq('bench', bench);
      }

      if (courtNo) {
        query = query.eq('court_no', courtNo);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!bench
  });
}

// ========================================
// GROUPED OBSERVATIONS BY JUDGE
// ========================================

export interface GroupedObservations {
  judgeName: string;
  bench: string;
  observations: JudgeObservation[];
  ownCount: number;
  chamberCount: number;
  latestDate: string;
}

export function useGroupedJudgeObservations(bench?: string | null) {
  const { data: observations = [], ...rest } = useJudgeObservations({ bench, limit: 200 });

  // Group by judge
  const grouped: GroupedObservations[] = [];
  const judgeMap = new Map<string, JudgeObservation[]>();

  observations.forEach(obs => {
    const key = `${obs.judge_name}__${obs.bench}`;
    if (!judgeMap.has(key)) {
      judgeMap.set(key, []);
    }
    judgeMap.get(key)!.push(obs);
  });

  judgeMap.forEach((obs, key) => {
    const [judgeName, bench] = key.split('__');
    grouped.push({
      judgeName,
      bench,
      observations: obs,
      ownCount: obs.filter(o => o.is_own).length,
      chamberCount: obs.filter(o => o.is_chamber_shared).length,
      latestDate: obs[0]?.created_at || ''
    });
  });

  // Sort by latest observation
  grouped.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());

  return { data: grouped, ...rest };
}
