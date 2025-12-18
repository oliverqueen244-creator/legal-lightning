import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { format, isToday, subDays } from 'date-fns';

export interface PostCourtNote {
  id: string;
  case_fingerprint: string;
  docket_id: string | null;
  hearing_date: string;
  what_happened: string | null;
  next_direction: string | null;
  note_for_next: string | null;
  author_id: string;
  created_at: string;
  updated_at: string;
}

export interface PendingCapture {
  docket_id: string;
  case_number: string;
  case_fingerprint: string;
  court_room_no: string;
  item_no: number;
  petitioner: string | null;
  respondent: string | null;
  hearing_date: string;
}

// Hook to get cases that need post-court capture
export function usePendingCaptures() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['pending-captures', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get today's and yesterday's docket items that are matched to user
      const { data: docketItems, error: docketError } = await supabase
        .from('daily_court_docket')
        .select('id, case_number, case_fingerprint, court_room_no, item_no, petitioner, respondent, date')
        .eq('matched_profile_id', user.id)
        .in('date', [today, yesterday])
        .not('case_fingerprint', 'is', null);

      if (docketError) throw docketError;
      if (!docketItems || docketItems.length === 0) return [];

      // Get existing notes for these cases
      const fingerprints = docketItems.map(d => d.case_fingerprint).filter(Boolean);
      const { data: existingNotes, error: notesError } = await supabase
        .from('post_court_notes')
        .select('case_fingerprint, hearing_date')
        .eq('author_id', user.id)
        .in('case_fingerprint', fingerprints)
        .in('hearing_date', [today, yesterday]);

      if (notesError) throw notesError;

      // Filter out cases that already have notes
      const notedSet = new Set(
        (existingNotes || []).map(n => `${n.case_fingerprint}-${n.hearing_date}`)
      );

      const pending: PendingCapture[] = docketItems
        .filter(d => !notedSet.has(`${d.case_fingerprint}-${d.date}`))
        .map(d => ({
          docket_id: d.id,
          case_number: d.case_number,
          case_fingerprint: d.case_fingerprint!,
          court_room_no: d.court_room_no,
          item_no: d.item_no,
          petitioner: d.petitioner,
          respondent: d.respondent,
          hearing_date: d.date
        }));

      return pending;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to save a post-court note
export function useSavePostCourtNote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (note: {
      case_fingerprint: string;
      docket_id?: string;
      hearing_date: string;
      what_happened?: string;
      next_direction?: string;
      note_for_next?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('post_court_notes')
        .upsert({
          case_fingerprint: note.case_fingerprint,
          docket_id: note.docket_id,
          hearing_date: note.hearing_date,
          what_happened: note.what_happened || null,
          next_direction: note.next_direction || null,
          note_for_next: note.note_for_next || null,
          author_id: user.id,
        }, {
          onConflict: 'case_fingerprint,hearing_date,author_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-captures'] });
      queryClient.invalidateQueries({ queryKey: ['post-court-notes'] });
      queryClient.invalidateQueries({ queryKey: ['case-history'] });
    }
  });
}

// Hook to get post-court notes for a specific case (by fingerprint)
export function usePostCourtNotes(caseFingerprint?: string | null) {
  return useQuery({
    queryKey: ['post-court-notes', caseFingerprint],
    queryFn: async () => {
      if (!caseFingerprint) return [];

      const { data, error } = await supabase
        .from('post_court_notes')
        .select('*')
        .eq('case_fingerprint', caseFingerprint)
        .order('hearing_date', { ascending: false });

      if (error) throw error;
      return data as PostCourtNote[];
    },
    enabled: !!caseFingerprint
  });
}

// Hook to check if a case has a recent capture (for Morning Brief indicator)
export function useCaseHasRecentCapture(caseFingerprint?: string | null) {
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['recent-capture', caseFingerprint],
    queryFn: async () => {
      if (!caseFingerprint) return { hasCaptured: false, lastCapture: null };

      const { data, error } = await supabase
        .from('post_court_notes')
        .select('*')
        .eq('case_fingerprint', caseFingerprint)
        .in('hearing_date', [today, yesterday])
        .order('hearing_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return {
        hasCaptured: !!data,
        lastCapture: data as PostCourtNote | null
      };
    },
    enabled: !!caseFingerprint
  });
}

// Hook to skip capture for today
export function useSkipCapture() {
  return {
    skipAll: () => {
      localStorage.setItem('skip-capture-date', format(new Date(), 'yyyy-MM-dd'));
    },
    isSkipped: () => {
      const skipDate = localStorage.getItem('skip-capture-date');
      return skipDate === format(new Date(), 'yyyy-MM-dd');
    }
  };
}