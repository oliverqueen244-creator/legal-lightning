import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineCache } from './useOfflineCache';
import { useAuth } from './useAuth';
import type { CaseDocumentExtended } from '@/types/documents';

export interface CourtroomCase {
  id: string;
  case_number: string;
  court_location: string;
  court_room_no: string;
  item_no: number;
  petitioner: string | null;
  respondent: string | null;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
  judge_names: string | null;
  matched_as: 'petitioner' | 'respondent' | null;
  
  // Primary approved documents only
  documents: CourtroomDocument[];
  arguments: CourtroomArgument[];
  
  // Warnings
  warnings: string[];
}

export interface CourtroomDocument {
  id: string;
  document_type: string;
  file_url: string;
  language: string;
  format: string;
  legibility: string;
  is_primary: boolean;
}

export interface CourtroomArgument {
  id: string;
  title: string;
  linked_page_number: number;
}

export interface CourtroomSnapshot {
  generated_at: string;
  date: string;
  user_id: string;
  cases: CourtroomCase[];
  total_cases: number;
  is_stale: boolean;
}

const SNAPSHOT_CACHE_KEY = 'courtroom-snapshot';

// Generate and store courtroom snapshot
export function useCourtroomSnapshot() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { 
    isOnline, 
    cacheDocketItems, 
    getCachedDocketItems,
    cacheDocument,
    getCachedDocument 
  } = useOfflineCache();

  // Load snapshot from IndexedDB or generate new one
  const { data: snapshot, isLoading, refetch } = useQuery({
    queryKey: ['courtroom-snapshot', user?.id],
    queryFn: async (): Promise<CourtroomSnapshot | null> => {
      if (!user) return null;

      // Try to load from localStorage first (for quick access)
      const cachedSnapshot = localStorage.getItem(SNAPSHOT_CACHE_KEY);
      if (cachedSnapshot) {
        const parsed = JSON.parse(cachedSnapshot) as CourtroomSnapshot;
        // Check if snapshot is from today
        const today = new Date().toISOString().split('T')[0];
        if (parsed.date === today && parsed.user_id === user.id) {
          // Check staleness (older than 2 hours)
          const generatedAt = new Date(parsed.generated_at);
          const hoursSince = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
          return { ...parsed, is_stale: hoursSince > 2 };
        }
      }

      // If online, generate fresh snapshot
      if (isOnline) {
        return await generateSnapshot(user.id);
      }

      // Offline - try to use cached docket items
      const cachedItems = await getCachedDocketItems();
      if (cachedItems && cachedItems.length > 0) {
        return {
          generated_at: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          user_id: user.id,
          cases: cachedItems.map(mapToCourtroomCase),
          total_cases: cachedItems.length,
          is_stale: true,
        };
      }

      return null;
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Generate fresh snapshot
  const generateSnapshot = async (userId: string): Promise<CourtroomSnapshot> => {
    const today = new Date().toISOString().split('T')[0];

    // Get user's aliases
    const { data: aliases } = await supabase
      .from('lawyer_aliases')
      .select('alias_name')
      .eq('profile_id', userId);

    const aliasNames = aliases?.map((a) => a.alias_name.toLowerCase()) || [];

    // Fetch today's matched cases
    const { data: docketItems, error } = await supabase
      .from('daily_court_docket')
      .select('*')
      .eq('date', today)
      .eq('matched_profile_id', userId)
      .order('item_no', { ascending: true });

    if (error) throw error;

    let cases = docketItems || [];

    // If no matched cases, try alias matching
    if (cases.length === 0 && aliasNames.length > 0) {
      const { data: allCases } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('date', today);

      cases = (allCases || []).filter((c) => {
        const petLawyer = c.petitioner_lawyer?.toLowerCase() || '';
        const resLawyer = c.respondent_lawyer?.toLowerCase() || '';
        return aliasNames.some(
          (alias) => petLawyer.includes(alias) || resLawyer.includes(alias)
        );
      });
    }

    // Fetch documents and arguments for each case
    const courtroomCases: CourtroomCase[] = await Promise.all(
      cases.map(async (docket) => {
        // Fetch only approved primary documents
        const { data: docs } = await supabase
          .from('case_documents')
          .select('*')
          .eq('docket_id', docket.id)
          .eq('review_status', 'approved');

        const documents: CourtroomDocument[] = (docs || [])
          .filter((d) => (d as any).is_primary || (d as any).review_status === 'approved')
          .map((d) => ({
            id: d.id,
            document_type: (d as any).document_type || 'UNKNOWN',
            file_url: d.file_url || '',
            language: (d as any).language || 'UNKNOWN',
            format: (d as any).format || 'TYPED',
            legibility: (d as any).legibility || 'CLEAR',
            is_primary: (d as any).is_primary || false,
          }));

        // Fetch arguments
        const { data: args } = await supabase
          .from('case_arguments')
          .select('*')
          .eq('docket_id', docket.id)
          .order('created_at', { ascending: true });

        const arguments_list: CourtroomArgument[] = (args || []).map((a) => ({
          id: a.id,
          title: a.title,
          linked_page_number: a.linked_page_number || 1,
        }));

        // Determine matched_as
        const petLawyer = docket.petitioner_lawyer?.toLowerCase() || '';
        const resLawyer = docket.respondent_lawyer?.toLowerCase() || '';
        let matched_as: 'petitioner' | 'respondent' | null = null;
        if (aliasNames.some((a) => petLawyer.includes(a))) matched_as = 'petitioner';
        else if (aliasNames.some((a) => resLawyer.includes(a))) matched_as = 'respondent';

        // Generate warnings
        const warnings: string[] = [];
        if (documents.length === 0) warnings.push('No approved documents');
        if (documents.some((d) => d.legibility === 'POOR')) warnings.push('Poor legibility document');
        if (documents.some((d) => d.format === 'HANDWRITTEN')) warnings.push('Handwritten document');
        if (documents.some((d) => d.language === 'UNKNOWN')) warnings.push('Unknown language');
        if (arguments_list.length === 0) warnings.push('No arguments prepared');

        return {
          id: docket.id,
          case_number: docket.case_number || 'Unknown',
          court_location: docket.court_location || 'Unknown',
          court_room_no: docket.court_room_no || '',
          item_no: docket.item_no || 0,
          petitioner: docket.petitioner,
          respondent: docket.respondent,
          petitioner_lawyer: docket.petitioner_lawyer,
          respondent_lawyer: docket.respondent_lawyer,
          judge_names: docket.judge_names,
          matched_as,
          documents,
          arguments: arguments_list,
          warnings,
        };
      })
    );

    const snapshotData: CourtroomSnapshot = {
      generated_at: new Date().toISOString(),
      date: today,
      user_id: userId,
      cases: courtroomCases,
      total_cases: courtroomCases.length,
      is_stale: false,
    };

    // Cache to localStorage
    localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(snapshotData));

    // Cache docket items to IndexedDB
    await cacheDocketItems(cases);

    // Pre-cache primary documents for offline use
    for (const caseItem of courtroomCases) {
      for (const doc of caseItem.documents.filter((d) => d.is_primary)) {
        await cacheDocument(doc.id, doc.file_url);
      }
    }

    return snapshotData;
  };

  // Regenerate snapshot
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!user || !isOnline) throw new Error('Cannot regenerate offline');
      return await generateSnapshot(user.id);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['courtroom-snapshot', user?.id], data);
    },
  });

  // Get cached document URL (for offline)
  const getDocumentUrl = useCallback(async (docId: string, onlineUrl: string) => {
    if (isOnline) return onlineUrl;
    const cachedUrl = await getCachedDocument(docId);
    return cachedUrl || onlineUrl;
  }, [isOnline, getCachedDocument]);

  return {
    snapshot,
    isLoading,
    isOnline,
    regenerate: regenerateMutation.mutateAsync,
    isRegenerating: regenerateMutation.isPending,
    getDocumentUrl,
    refetch,
  };
}

// Helper to map docket item to courtroom case
function mapToCourtroomCase(item: any): CourtroomCase {
  return {
    id: item.id,
    case_number: item.case_number || 'Unknown',
    court_location: item.court_location || 'Unknown',
    court_room_no: item.court_room_no || '',
    item_no: item.item_no || 0,
    petitioner: item.petitioner,
    respondent: item.respondent,
    petitioner_lawyer: item.petitioner_lawyer,
    respondent_lawyer: item.respondent_lawyer,
    judge_names: item.judge_names,
    matched_as: null,
    documents: [],
    arguments: [],
    warnings: ['Offline mode - limited data'],
  };
}
