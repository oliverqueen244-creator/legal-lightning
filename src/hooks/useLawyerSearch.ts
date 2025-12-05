import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const RECENT_SEARCHES_KEY = 'lawyer-search-recent';
const MAX_RECENT_SEARCHES = 5;

export function useLawyerSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: results, isLoading, refetch, isFetched } = useQuery({
    queryKey: ['lawyer-search', searchTerm, today],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('date', today)
        .or(`petitioner_lawyer.ilike.%${searchTerm}%,respondent_lawyer.ilike.%${searchTerm}%`)
        .order('court_room_no')
        .order('item_no');

      if (error) throw error;
      return data ?? [];
    },
    enabled: false,
  });

  const search = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setSearchTerm(term.trim());
    
    // Save to recent searches
    const recent = getRecentSearches();
    const filtered = recent.filter(r => r.toLowerCase() !== term.toLowerCase());
    const updated = [term.trim(), ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    
    // Wait for state update then refetch
    setTimeout(() => refetch(), 0);
  }, [refetch]);

  const getRecentSearches = (): string[] => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const clearRecentSearches = () => {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const getMatchedSide = (item: { petitioner_lawyer: string | null; respondent_lawyer: string | null }): 'petitioner' | 'respondent' | 'both' => {
    const term = searchTerm.toLowerCase();
    const matchesPetitioner = item.petitioner_lawyer?.toLowerCase().includes(term);
    const matchesRespondent = item.respondent_lawyer?.toLowerCase().includes(term);
    
    if (matchesPetitioner && matchesRespondent) return 'both';
    if (matchesPetitioner) return 'petitioner';
    return 'respondent';
  };

  return {
    searchTerm,
    setSearchTerm,
    results: results ?? [],
    isLoading,
    isFetched,
    search,
    getRecentSearches,
    clearRecentSearches,
    getMatchedSide,
  };
}
