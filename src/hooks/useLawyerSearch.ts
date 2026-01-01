import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useRateLimit } from './useRateLimit';
import { toast } from 'sonner';

const RECENT_SEARCHES_KEY = 'lawyer-search-recent';
const MAX_RECENT_SEARCHES = 5;

/**
 * Lawyer Search Hook
 * 
 * @param selectedDate - Optional date to search. If not provided, defaults to today.
 * This fixes the audit issue where search was hardcoded to today's date 
 * instead of using the user's selected date from DateSelector.
 */
export function useLawyerSearch(selectedDate?: string) {
  const [searchTerm, setSearchTerm] = useState('');
  // Use provided selectedDate or fall back to today
  const searchDate = selectedDate || format(new Date(), 'yyyy-MM-dd');
  const { isLimited, remainingRequests, checkAndRecord } = useRateLimit('search');

  const { data: results, isLoading, refetch, isFetched } = useQuery({
    queryKey: ['lawyer-search', searchTerm, searchDate],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('date', searchDate)
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
    
    // Rate limit check
    if (!checkAndRecord()) {
      toast.error('Too many searches. Please wait a moment.');
      return;
    }
    
    setSearchTerm(term.trim());
    
    // Save to recent searches
    const recent = getRecentSearches();
    const filtered = recent.filter(r => r.toLowerCase() !== term.toLowerCase());
    const updated = [term.trim(), ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    
    // Wait for state update then refetch
    setTimeout(() => refetch(), 0);
  }, [refetch, checkAndRecord]);

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
    isRateLimited: isLimited,
    remainingSearches: remainingRequests,
  };
}
