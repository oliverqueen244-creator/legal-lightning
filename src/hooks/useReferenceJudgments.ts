import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveCaseType, getCategorySearchTerms, getCourtId } from '@/lib/caseTypeMapping';
import { rankJudgments, type RankedJudgment } from '@/lib/judgmentRanking';

interface SearchParams {
  caseNumber?: string | null;
  judgeName?: string | null;
  court?: string | null;
  petitionerLawyer?: string | null;
  respondentLawyer?: string | null;
  userAliases?: string[];
  enabled?: boolean;
}

interface SearchResponse {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    date?: string;
    court?: string;
    judges?: string[];
    searchVector?: string;
  }>;
  vectors: Array<{ type: string; query: string }>;
  source: string;
  lastChecked?: string;
  error?: string;
}

export function useReferenceJudgments({
  caseNumber,
  judgeName,
  court,
  petitionerLawyer,
  respondentLawyer,
  userAliases = [],
  enabled = true,
}: SearchParams) {
  // Resolve case type from case number
  const caseTypeResolution = useMemo(() => {
    if (!caseNumber) return null;
    return resolveCaseType(caseNumber);
  }, [caseNumber]);

  // Build advocate names list
  const advocateNames = useMemo(() => {
    const names: string[] = [];
    if (petitionerLawyer) names.push(petitionerLawyer);
    if (respondentLawyer) names.push(respondentLawyer);
    names.push(...userAliases);
    return names.filter(Boolean);
  }, [petitionerLawyer, respondentLawyer, userAliases]);

  // Get category search terms
  const categoryTerms = useMemo(() => {
    if (!caseTypeResolution?.category) return [];
    return getCategorySearchTerms(caseTypeResolution.category);
  }, [caseTypeResolution]);

  // Main search query
  const searchQuery = useQuery({
    queryKey: [
      'reference-judgments',
      judgeName,
      court,
      caseTypeResolution?.abbreviation,
      caseTypeResolution?.category,
      advocateNames.slice(0, 2), // Limit to first 2 for cache key
    ],
    queryFn: async (): Promise<SearchResponse> => {
      const { data, error } = await supabase.functions.invoke('search-indian-kanoon', {
        body: {
          judgeName,
          court,
          caseType: caseTypeResolution?.fullName,
          category: caseTypeResolution?.category,
          advocateNames: advocateNames.slice(0, 3),
          keywords: categoryTerms.slice(0, 3),
          maxResults: 15,
          multiVector: true,
        }
      });

      if (error) throw error;
      return data as SearchResponse;
    },
    enabled: enabled && !!(judgeName || court),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  // Rank the results
  const rankedJudgments = useMemo((): RankedJudgment[] => {
    if (!searchQuery.data?.results) return [];

    const judgments = searchQuery.data.results.map((r, idx) => ({
      id: `search-${idx}`,
      title: r.title,
      url: r.url,
      court: r.court,
      judge: r.judges,
      date: r.date,
      snippet: r.snippet,
      searchVector: r.searchVector,
      source: 'live-search' as const,
    }));

    return rankJudgments(judgments, {
      judgeName,
      court,
      caseType: caseTypeResolution?.fullName,
      category: caseTypeResolution?.category,
      advocateNames,
    });
  }, [searchQuery.data, judgeName, court, caseTypeResolution, advocateNames]);

  return {
    // Ranked results
    judgments: rankedJudgments,
    
    // Case type info
    caseType: caseTypeResolution,
    
    // Search metadata
    searchVectors: searchQuery.data?.vectors || [],
    lastChecked: searchQuery.data?.lastChecked,
    
    // Loading/error states
    isLoading: searchQuery.isLoading,
    isError: searchQuery.isError,
    error: searchQuery.error?.message || searchQuery.data?.error,
    
    // Refetch
    refetch: searchQuery.refetch,
  };
}

// Hook to fetch saved references from database
export function useSavedReferences({
  judgeName,
  court,
  advocateNames = [],
  enabled = true,
}: {
  judgeName?: string | null;
  court?: string | null;
  advocateNames?: string[];
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['saved-references', judgeName, court, advocateNames],
    queryFn: async () => {
      let query = supabase
        .from('judge_judgment_references')
        .select('*')
        .order('judgment_date', { ascending: false });

      if (judgeName) {
        query = query.ilike('judge_name', `%${judgeName}%`);
      }

      if (court) {
        const courtMapping: Record<string, string[]> = {
          'JAIPUR': ['Rajasthan High Court - Jaipur', 'Rajasthan High Court'],
          'JODHPUR': ['Rajasthan High Court - Jodhpur', 'Rajasthan High Court']
        };
        
        const courtNames = courtMapping[court] || [court];
        query = query.or(courtNames.map(c => `court.ilike.%${c}%`).join(','));
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Process with advocate matching and ranking
      const normalizedAdvocates = advocateNames.map(name => 
        name.toLowerCase().replace(/\s+/g, ' ').trim()
      );
      
      const processedRefs = (data || []).map((ref, idx) => {
        const advocateMatched = ref.lawyer_names?.some((lawyer: string) => {
          const normalizedLawyer = lawyer.toLowerCase().replace(/\s+/g, ' ').trim();
          return normalizedAdvocates.some(advocate => 
            normalizedLawyer.includes(advocate) || advocate.includes(normalizedLawyer)
          );
        }) || false;

        return {
          id: ref.id,
          title: `${ref.case_type} - ${ref.court}`,
          url: ref.indian_kanoon_url,
          court: ref.court,
          judge: ref.judge_name,
          date: ref.judgment_date,
          lawyerNames: ref.lawyer_names || [],
          advocateMatched,
          source: 'saved' as const,
        };
      });

      // Rank saved references too
      return rankJudgments(processedRefs, {
        judgeName,
        court,
        advocateNames,
      });
    },
    enabled: enabled && !!(judgeName || court),
  });
}
