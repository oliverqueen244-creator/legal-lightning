import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface IndianKanoonResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  court?: string;
  judges?: string[];
}

interface SearchParams {
  query?: string;
  judgeName?: string | null;
  court?: string | null;
  maxResults?: number;
}

interface SearchResponse {
  results: IndianKanoonResult[];
  query: string;
  source: string;
  error?: string;
}

export function useIndianKanoonSearch({ 
  query, 
  judgeName, 
  court, 
  maxResults = 10 
}: SearchParams) {
  const [isSearching, setIsSearching] = useState(false);

  const searchQuery = useQuery({
    queryKey: ['indian-kanoon-search', query, judgeName, court],
    queryFn: async (): Promise<SearchResponse> => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke('search-indian-kanoon', {
          body: {
            query,
            judgeName,
            court,
            maxResults
          }
        });

        if (error) throw error;
        return data as SearchResponse;
      } finally {
        setIsSearching(false);
      }
    },
    enabled: !!(query || judgeName), // Only search if we have query or judge name
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1
  });

  return {
    results: searchQuery.data?.results || [],
    isLoading: searchQuery.isLoading || isSearching,
    error: searchQuery.error?.message || searchQuery.data?.error,
    refetch: searchQuery.refetch
  };
}

// Manual search trigger (for button-click searches)
export async function searchIndianKanoon(params: SearchParams): Promise<SearchResponse> {
  const { data, error } = await supabase.functions.invoke('search-indian-kanoon', {
    body: params
  });

  if (error) throw error;
  return data as SearchResponse;
}
