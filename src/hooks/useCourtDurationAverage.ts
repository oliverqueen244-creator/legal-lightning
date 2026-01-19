/**
 * COURT DURATION AVERAGE HOOK
 * 
 * Fetches court-specific average case duration from the last 10-15 cases.
 * Uses real-time data from case_item_durations table.
 * Falls back to pre-computed averages or default values when insufficient data.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CourtDurationAverage {
  avgSecondsPerCase: number;
  sampleCount: number;
  isReliable: boolean;
  lastUpdated: string | null;
  source: 'recent_cases' | 'historical' | 'default';
}

// Default fallback: 5 minutes per case
const DEFAULT_AVG_SECONDS = 300;
const RECENT_CASES_COUNT = 15; // Last 15 cases for rolling average
const MIN_RECENT_SAMPLES = 5; // Need at least 5 recent cases

/**
 * Fetch court-specific average duration from last 10-15 cases
 */
export function useCourtDurationAverage(
  courtLocation: string | undefined,
  courtNo: string | undefined
): CourtDurationAverage {
  const { data } = useQuery({
    queryKey: ['court-recent-duration', courtLocation, courtNo],
    queryFn: async () => {
      if (!courtLocation || !courtNo) return null;
      
      // First, try to get the last 15 completed cases for this court
      const { data: recentCases, error: recentError } = await supabase
        .from('case_item_durations')
        .select('duration_seconds, ended_at')
        .eq('court_location', courtLocation)
        .eq('court_no', courtNo)
        .not('duration_seconds', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(RECENT_CASES_COUNT);
      
      if (recentError) {
        console.warn('Failed to fetch recent case durations:', recentError);
      }
      
      // If we have enough recent cases, use them
      if (recentCases && recentCases.length >= MIN_RECENT_SAMPLES) {
        const totalSeconds = recentCases.reduce(
          (sum, c) => sum + (c.duration_seconds || 0), 
          0
        );
        const avgSeconds = totalSeconds / recentCases.length;
        
        return {
          avgSecondsPerCase: avgSeconds,
          sampleCount: recentCases.length,
          lastUpdated: recentCases[0]?.ended_at || null,
          source: 'recent_cases' as const,
        };
      }
      
      // Fallback: try the pre-computed averages table
      const { data: historicalData, error: historicalError } = await supabase
        .from('court_avg_duration')
        .select('avg_seconds_per_case, sample_count, last_updated')
        .eq('court_location', courtLocation)
        .eq('court_no', courtNo)
        .maybeSingle();
      
      if (historicalError) {
        console.warn('Failed to fetch historical average:', historicalError);
      }
      
      if (historicalData?.avg_seconds_per_case && historicalData.sample_count >= 10) {
        return {
          avgSecondsPerCase: Number(historicalData.avg_seconds_per_case),
          sampleCount: historicalData.sample_count,
          lastUpdated: historicalData.last_updated,
          source: 'historical' as const,
        };
      }
      
      // No data available
      return null;
    },
    enabled: !!courtLocation && !!courtNo,
    staleTime: 60 * 1000, // 1 minute (refresh more often for real-time data)
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
  
  // Return data if available
  if (data?.avgSecondsPerCase) {
    return {
      avgSecondsPerCase: data.avgSecondsPerCase,
      sampleCount: data.sampleCount,
      isReliable: data.sampleCount >= 10,
      lastUpdated: data.lastUpdated,
      source: data.source,
    };
  }
  
  // Fallback to default
  return {
    avgSecondsPerCase: DEFAULT_AVG_SECONDS,
    sampleCount: 0,
    isReliable: false,
    lastUpdated: null,
    source: 'default',
  };
}

/**
 * Get confidence level description for UI
 */
export function getDurationConfidenceLevel(
  sampleCount: number
): 'high' | 'medium' | 'low' {
  if (sampleCount >= 12) return 'high';
  if (sampleCount >= 8) return 'medium';
  return 'low';
}

/**
 * Get confidence color class
 */
export function getDurationConfidenceColor(
  level: 'high' | 'medium' | 'low'
): string {
  switch (level) {
    case 'high':
      return 'text-court-success';
    case 'medium':
      return 'text-court-warning';
    case 'low':
      return 'text-muted-foreground';
  }
}
