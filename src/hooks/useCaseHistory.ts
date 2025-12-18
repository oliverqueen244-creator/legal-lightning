import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DocketItem, CaseDocument, CaseArgument } from '@/types/database';

export interface CaseHistoryEntry {
  date: string;
  docket_id: string;
  item_no: number;
  court_room_no: string;
  status: string;
  documents: CaseDocument[];
  arguments: CaseArgument[];
}

export interface CaseHistory {
  fingerprint: string;
  first_appearance: string;
  total_appearances: number;
  entries: CaseHistoryEntry[];
  all_documents: CaseDocument[];
  all_arguments: CaseArgument[];
}

// Fetch all case history based on fingerprint
export function useCaseHistory(docketId: string) {
  return useQuery({
    queryKey: ['case-history', docketId],
    queryFn: async () => {
      // First, get the current docket item to get its fingerprint
      const { data: currentDocket, error: docketError } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('id', docketId)
        .single();

      if (docketError) throw docketError;

      const fingerprint = (currentDocket as any).case_fingerprint;
      
      if (!fingerprint) {
        // No fingerprint, return empty history
        return {
          fingerprint: '',
          first_appearance: currentDocket.date,
          total_appearances: 1,
          entries: [{
            date: currentDocket.date,
            docket_id: currentDocket.id,
            item_no: currentDocket.item_no || 0,
            court_room_no: currentDocket.court_room_no || '',
            status: currentDocket.status || 'pending',
            documents: [],
            arguments: [],
          }],
          all_documents: [],
          all_arguments: [],
        } as CaseHistory;
      }

      // Get all docket entries with the same fingerprint
      const { data: allDockets, error: allDocketsError } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('case_fingerprint', fingerprint)
        .order('date', { ascending: true });

      if (allDocketsError) throw allDocketsError;

      const docketIds = allDockets?.map((d) => d.id) || [];

      // Fetch all documents for these dockets
      const { data: allDocuments, error: docsError } = await supabase
        .from('case_documents')
        .select('*')
        .in('docket_id', docketIds)
        .order('uploaded_at', { ascending: false });

      if (docsError) throw docsError;

      // Fetch all arguments for these dockets
      const { data: allArguments, error: argsError } = await supabase
        .from('case_arguments')
        .select('*')
        .in('docket_id', docketIds)
        .order('created_at', { ascending: false });

      if (argsError) throw argsError;

      // Group by date
      const entries: CaseHistoryEntry[] = (allDockets || []).map((docket) => ({
        date: docket.date,
        docket_id: docket.id,
        item_no: docket.item_no || 0,
        court_room_no: docket.court_room_no || '',
        status: docket.status || 'pending',
        documents: (allDocuments || []).filter((d) => d.docket_id === docket.id) as CaseDocument[],
        arguments: (allArguments || []).filter((a) => a.docket_id === docket.id) as CaseArgument[],
      }));

      return {
        fingerprint,
        first_appearance: entries[0]?.date || currentDocket.date,
        total_appearances: entries.length,
        entries,
        all_documents: (allDocuments || []) as CaseDocument[],
        all_arguments: (allArguments || []) as CaseArgument[],
      } as CaseHistory;
    },
    enabled: !!docketId,
  });
}

// Check if a case has history (appeared before)
export function useCaseHasHistory(docketId: string) {
  return useQuery({
    queryKey: ['case-has-history', docketId],
    queryFn: async () => {
      const { data: docket, error } = await supabase
        .from('daily_court_docket')
        .select('case_fingerprint, fingerprint_matched_at, date')
        .eq('id', docketId)
        .single();

      if (error) throw error;

      const fingerprint = (docket as any).case_fingerprint;
      const matchedAt = (docket as any).fingerprint_matched_at;

      if (!fingerprint || !matchedAt) {
        return { hasHistory: false, previousCount: 0 };
      }

      // Count previous appearances
      const { count, error: countError } = await supabase
        .from('daily_court_docket')
        .select('*', { count: 'exact', head: true })
        .eq('case_fingerprint', fingerprint)
        .lt('date', docket.date);

      if (countError) throw countError;

      return {
        hasHistory: (count || 0) > 0,
        previousCount: count || 0,
      };
    },
    enabled: !!docketId,
  });
}
