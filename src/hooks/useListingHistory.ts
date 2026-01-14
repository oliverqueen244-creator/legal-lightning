/**
 * useListingHistory Hook
 * 
 * SEMANTIC CORRECTION: Replaces useCaseHistory semantically.
 * 
 * This hook fetches CAUSE LIST LISTINGS (not confirmed hearings).
 * A listing represents a case appearing on a cause list for a given date.
 * A hearing is a CONFIRMED event derived from post-court notes or manual marking.
 * 
 * This distinction is critical for Indian court workflows:
 * - Listings are system-ingested, objective facts
 * - Hearings are lawyer-confirmed, semantic events
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CaseDocument, CaseArgument } from '@/types/database';
import type { CaseHearing } from './useHearings';

export interface PostCourtNoteEntry {
  id: string;
  hearing_date: string;
  what_happened: string | null;
  next_direction: string | null;
  note_for_next: string | null;
}

export interface ListingEntry {
  date: string;
  docket_id: string;
  item_no: number;
  court_room_no: string;
  status: string;
  judge_names: string | null;
  documents: CaseDocument[];
  arguments: CaseArgument[];
  // Hearing overlay - populated if lawyer confirmed hearing for this date
  hearing?: CaseHearing;
  postCourtNote?: PostCourtNoteEntry;
}

export interface ListingHistory {
  fingerprint: string;
  case_number: string;
  first_listing: string;
  total_listings: number;
  confirmed_hearings: number;
  entries: ListingEntry[];
  all_documents: CaseDocument[];
  all_arguments: CaseArgument[];
}

/**
 * Fetch all cause list listings for a case, with hearing overlays
 */
export function useListingHistory(docketId: string) {
  return useQuery({
    queryKey: ['listing-history', docketId],
    queryFn: async (): Promise<ListingHistory> => {
      // Get the current docket item to find fingerprint
      const { data: currentDocket, error: docketError } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('id', docketId)
        .single();

      if (docketError) throw docketError;

      const fingerprint = (currentDocket as any).case_fingerprint;
      
      if (!fingerprint) {
        // No fingerprint, return single listing
        return {
          fingerprint: '',
          case_number: currentDocket.case_number || '',
          first_listing: currentDocket.date,
          total_listings: 1,
          confirmed_hearings: 0,
          entries: [{
            date: currentDocket.date,
            docket_id: currentDocket.id,
            item_no: currentDocket.item_no || 0,
            court_room_no: currentDocket.court_room_no || '',
            status: currentDocket.status || 'pending',
            judge_names: currentDocket.judge_names || null,
            documents: [],
            arguments: [],
          }],
          all_documents: [],
          all_arguments: [],
        };
      }

      // Get all listings with the same fingerprint
      const { data: allListings, error: listingsError } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('case_fingerprint', fingerprint)
        .order('date', { ascending: true });

      if (listingsError) throw listingsError;

      const docketIds = allListings?.map((d) => d.id) || [];

      // Fetch documents, arguments, hearings, and notes in parallel
      const [docsResult, argsResult, hearingsResult, notesResult] = await Promise.all([
        supabase
          .from('case_documents')
          .select('*')
          .in('docket_id', docketIds)
          .order('uploaded_at', { ascending: false }),
        supabase
          .from('case_arguments')
          .select('*')
          .in('docket_id', docketIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('case_hearings')
          .select('*')
          .eq('case_fingerprint', fingerprint)
          .order('hearing_date', { ascending: true }),
        supabase
          .from('post_court_notes')
          .select('*')
          .eq('case_fingerprint', fingerprint)
          .order('hearing_date', { ascending: false }),
      ]);

      if (docsResult.error) throw docsResult.error;
      if (argsResult.error) throw argsResult.error;
      if (hearingsResult.error) throw hearingsResult.error;
      if (notesResult.error) throw notesResult.error;

      const allDocuments = docsResult.data || [];
      const allArguments = argsResult.data || [];
      const allHearings = (hearingsResult.data || []) as CaseHearing[];
      const allNotes = notesResult.data || [];

      // Build listing entries with hearing overlays
      const entries: ListingEntry[] = (allListings || []).map((listing) => {
        const hearing = allHearings.find(h => h.hearing_date === listing.date);
        const note = allNotes.find(n => n.hearing_date === listing.date);
        
        return {
          date: listing.date,
          docket_id: listing.id,
          item_no: listing.item_no || 0,
          court_room_no: listing.court_room_no || '',
          status: listing.status || 'pending',
          judge_names: listing.judge_names || null,
          documents: allDocuments.filter((d) => d.docket_id === listing.id) as CaseDocument[],
          arguments: allArguments.filter((a) => a.docket_id === listing.id) as CaseArgument[],
          hearing: hearing || undefined,
          postCourtNote: note ? {
            id: note.id,
            hearing_date: note.hearing_date,
            what_happened: note.what_happened,
            next_direction: note.next_direction,
            note_for_next: note.note_for_next,
          } : undefined,
        };
      });

      const confirmedHearings = entries.filter(e => e.hearing?.was_heard).length;

      return {
        fingerprint,
        case_number: currentDocket.case_number || '',
        first_listing: entries[0]?.date || currentDocket.date,
        total_listings: entries.length,
        confirmed_hearings: confirmedHearings,
        entries,
        all_documents: allDocuments as CaseDocument[],
        all_arguments: allArguments as CaseArgument[],
      };
    },
    enabled: !!docketId,
  });
}

/**
 * Check if a case has previous listings
 * (Semantic replacement for useCaseHasHistory)
 */
export function useCaseHasListings(docketId: string) {
  return useQuery({
    queryKey: ['case-has-listings', docketId],
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
        return { hasListings: false, previousCount: 0 };
      }

      // Count previous listings
      const { count, error: countError } = await supabase
        .from('daily_court_docket')
        .select('*', { count: 'exact', head: true })
        .eq('case_fingerprint', fingerprint)
        .lt('date', docket.date);

      if (countError) throw countError;

      return {
        hasListings: (count || 0) > 0,
        previousCount: count || 0,
      };
    },
    enabled: !!docketId,
  });
}
