/**
 * useListingHistory Hook
 * 
 * CANONICAL MODEL: Listing = History, Meaning = Notes
 * 
 * This hook fetches CAUSE LIST LISTINGS as the sole source of truth for history.
 * Each row in daily_court_docket represents:
 * "This case was listed before this court on this date."
 * 
 * NyayHub does NOT infer:
 * - Whether the case was heard
 * - What happened in court
 * - What the judge ruled
 * 
 * Those belong ONLY to post-court notes (lawyer-authored, optional).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CaseDocument, CaseArgument } from '@/types/database';

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
  judge_names: string | null;
  documents: CaseDocument[];
  arguments: CaseArgument[];
  // Post-court note - lawyer-authored meaning layer
  postCourtNote?: PostCourtNoteEntry;
}

export interface ListingHistory {
  fingerprint: string;
  case_number: string;
  first_listing: string;
  total_listings: number;
  entries: ListingEntry[];
  all_documents: CaseDocument[];
  all_arguments: CaseArgument[];
}

/**
 * Fetch all cause list listings for a case
 * Listings are the history. Post-court notes provide meaning.
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
          entries: [{
            date: currentDocket.date,
            docket_id: currentDocket.id,
            item_no: currentDocket.item_no || 0,
            court_room_no: currentDocket.court_room_no || '',
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

      // Fetch documents, arguments, and post-court notes in parallel
      const [docsResult, argsResult, notesResult] = await Promise.all([
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
          .from('post_court_notes')
          .select('*')
          .eq('case_fingerprint', fingerprint)
          .order('hearing_date', { ascending: false }),
      ]);

      if (docsResult.error) throw docsResult.error;
      if (argsResult.error) throw argsResult.error;
      if (notesResult.error) throw notesResult.error;

      const allDocuments = docsResult.data || [];
      const allArguments = argsResult.data || [];
      const allNotes = notesResult.data || [];

      // Build listing entries with post-court notes as meaning layer
      const entries: ListingEntry[] = (allListings || []).map((listing) => {
        const note = allNotes.find(n => n.hearing_date === listing.date);
        
        return {
          date: listing.date,
          docket_id: listing.id,
          item_no: listing.item_no || 0,
          court_room_no: listing.court_room_no || '',
          judge_names: listing.judge_names || null,
          documents: allDocuments.filter((d) => d.docket_id === listing.id) as CaseDocument[],
          arguments: allArguments.filter((a) => a.docket_id === listing.id) as CaseArgument[],
          postCourtNote: note ? {
            id: note.id,
            hearing_date: note.hearing_date,
            what_happened: note.what_happened,
            next_direction: note.next_direction,
            note_for_next: note.note_for_next,
          } : undefined,
        };
      });

      return {
        fingerprint,
        case_number: currentDocket.case_number || '',
        first_listing: entries[0]?.date || currentDocket.date,
        total_listings: entries.length,
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
